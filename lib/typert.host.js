/* Hand-written typert host manifest for dsh-model-fit (strict face). */
import { z } from 'zod'

const sourceRequestSchema = z.object({
	provider: z.string().min(1),
	model: z.string().min(1)
})

const sourceResultSchema = z.object({
	input: z.array(z.string()),
	levels: z.array(z.string()),
	wire: z.record(z.string(), z.union([z.string(), z.null()])).nullable(),
	compat: z.record(z.string(), z.unknown()).nullable(),
	exact: z.boolean()
}).nullable()

export const TYPERT = {
	package: 'dsh-model-fit',
	face: 'host',
	schemas: [],
	invocations: [
		{
			id: 'dsh-model-fit#modelCapability/source',
			service: 'modelCapability',
			namespace: 'modelCapability',
			method: 'source',
			invocation: { kind: 'direct' },
			parameters: [
				{
					name: 'request',
					wire: 'request',
					source: 'json',
					codec: {
						mode: 'strict',
						typeSymbol: 'dsh-model-fit#modelCapability/source:request',
						schema: sourceRequestSchema
					}
				}
			],
			result: {
				mode: 'strict',
				typeSymbol: 'dsh-model-fit#modelCapability/source:result',
				schema: sourceResultSchema
			},
			sourceLocation: { file: 'lib/index.js', line: 1, column: 1 }
		}
	],
	model: {
		services: [
			{
				description: 'Reads a source model capability for one-click inheritance.',
				summary: 'Reads a source model capability for one-click inheritance.',
				jsDoc: '/** Reads a source model capability for one-click inheritance. */',
				tags: [],
				key: 'modelCapability',
				exportName: 'ModelCapabilityService',
				members: [
					{
						kind: 'method',
						name: 'source',
						signature: 'async source(request: { provider: string; model: string }): Promise<{ input: string[]; levels: string[]; wire: Record<string, string | null> | null; compat: Record<string, unknown> | null; exact: boolean } | null>',
						description: 'Resolve input modalities, reasoning levels, wire spellings and compat of a source model.',
						summary: 'Resolve a source model capability.',
						jsDoc: '/** Resolve a source model capability. */',
						tags: []
					}
				],
				types: []
			}
		],
		events: [],
		objects: []
	}
}
