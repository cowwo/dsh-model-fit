import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all'

/**
 * Look up a source model in the pi-ai built-in catalog, preferring the exact
 * provider route, then any route, then a suffix-stripped sibling
 * (e.g. `deepseek-v4-flash-vision-exp` → `deepseek-v4-flash`).
 * @returns the catalog model plus an `exact` flag, or null.
 */
function catalogLookup(provider, model) {
	try {
		const own = getBuiltinModels(provider).find((m) => m.id === model)
		if (own) return { model: own, exact: true }
	} catch { /* best-effort */ }
	try {
		for (const p of getBuiltinProviders()) {
			const m = getBuiltinModels(p).find((x) => x.id === model)
			if (m) return { model: m, exact: true }
		}
	} catch { /* best-effort */ }
	const stripped = model.replace(/(?:-vision-exp|-exp|-preview|-latest|-v[0-9]+)$/, '')
	if (stripped !== model) {
		try {
			for (const p of getBuiltinProviders()) {
				const m = getBuiltinModels(p).find((x) => x.id === stripped)
				if (m) return { model: m, exact: false }
			}
		} catch { /* best-effort */ }
	}
	return null
}

/**
 * 模型能力服务：为继承对话框读取来源模型的精确能力
 * （输入模态、推理等级、线上取值与 compat）。通过 typert
 * `modelCapability/source` 端点暴露给浏览器端。
 */
export class ModelCapabilityService extends TypertRemoteService {
	static inject = ['llm']

	constructor(ctx, config) {
		super(ctx, 'modelCapability')
	}

	/**
	 * @param request - { provider, model } of the source model.
	 * @returns null when the source is unknown, else
	 *   { input, levels, wire, compat, exact }.
	 */
	async source(request) {
		const provider = request && request.provider
		const model = request && request.model
		if (!provider || !model) throw new Error('modelCapability/source: provider and model are required')
		const info = await this.ctx.llm.resolveModelInfo(provider, model)
		if (!info) return null
		const levels = []
		if (info.reasoning && Array.isArray(info.reasoning.efforts)) {
			for (const effort of info.reasoning.efforts) levels.push(effort.id)
		}
		let wire = null
		let compat = null
		let exact = true
		const found = catalogLookup(provider, model)
		if (found) {
			exact = found.exact
			const catalogModel = found.model
			if (catalogModel.thinkingLevelMap && typeof catalogModel.thinkingLevelMap === 'object') {
				wire = {}
				for (const [key, value] of Object.entries(catalogModel.thinkingLevelMap)) {
					if (value !== undefined) wire[key] = value
				}
			}
			if (catalogModel.compat && typeof catalogModel.compat === 'object') {
				compat = { ...catalogModel.compat }
			}
		}
		return {
			input: info.inputModalities && info.inputModalities.includes('image') ? ['text', 'image'] : ['text'],
			levels,
			wire,
			compat,
			exact
		}
	}
}

export default ModelCapabilityService
