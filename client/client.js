window.__ModuleLoader__.load({
	id: "dsh-model-fit",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let React = require("react");

		//#region 模型能力管理页（原生 UI 风格，仅样式，功能不变）
		/** 本插件读写的能力设置命名空间。 */
		const NS = "llm-pi-ai";
		const MAIN_LEVELS = ["off", "high", "max"];
		const EXTRA_LEVELS = ["minimal", "low", "medium", "xhigh"];
		const ALL_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
		const stable = (v) => JSON.stringify(v);
		/** 剥离 schema 解析默认值，只把用户真实写下的字段带回编辑。 */
		function cleanEntry(m) {
			const c = { ...m };
			if (Array.isArray(c.input) && c.input.length === 0) delete c.input;
			if (c.compat && typeof c.compat === "object" && (Object.keys(c.compat).length === 0 || Object.keys(c.compat).every((k) => {
				const v = c.compat[k];
				return v !== null && typeof v === "object" && Object.keys(v).length === 0;
			}))) delete c.compat;
			return c;
		}
		function reOf(m) {
			return m.reasoningEfforts && typeof m.reasoningEfforts === "object" && !Array.isArray(m.reasoningEfforts) ? { ...m.reasoningEfforts } : null;
		}
		function imgOn(m) {
			return Array.isArray(m.input) ? m.input.includes("image") : false;
		}
		function hasReason(m) {
			const re = reOf(m);
			return !!(re && Object.keys(re).some((k) => k !== "off"));
		}
		function compatTag(m) {
			return m.compat && m.compat.thinkingFormat && typeof m.compat.thinkingFormat === "string" ? m.compat.thinkingFormat : null;
		}
		// 原生风格样式
		const S = {
			card: { background: "var(--dsw-alias-bg-layer-1)", border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 12, padding: "12px 14px" },
			ghost: { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: "5px 12px", background: "transparent", color: "var(--dsw-alias-label-secondary)", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" },
			primary: { background: "var(--dsw-alias-label-primary)", color: "var(--dsw-alias-bg-layer-3)", border: "none", borderRadius: 8, padding: "5px 16px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 },
			input: { border: "1px solid var(--dsw-alias-border-l2)", borderRadius: 8, padding: "6px 10px", fontSize: 13, background: "var(--dsw-alias-bg-layer-1)", color: "var(--dsw-alias-label-primary)", outline: "none" },
			badge: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-3)", border: "1px solid var(--dsw-alias-border-l2)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }
		};
		function chipStyle(on) {
			return {
				display: "inline-flex", alignItems: "center", gap: 2,
				border: "1px solid " + (on ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-border-l2)"),
				borderRadius: 999, padding: "0 9px", height: 22, cursor: "pointer",
				background: "transparent", color: on ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-label-tertiary)",
				fontSize: 12, userSelect: "none"
			};
		}

		function ModelCapabilitiesPage(props) {
			const bridge = props.bridge;
			const [providers, setProviders] = React.useState(null);
			const [catalog, setCatalog] = React.useState([]);
			const [drafts, setDrafts] = React.useState({});
			const [baseline, setBaseline] = React.useState({});
			const [revision, setRevision] = React.useState(undefined);
			const [busy, setBusy] = React.useState(false);
			const [result, setResult] = React.useState(null);
			const [picker, setPicker] = React.useState(null); // {pid, index}
			const [query, setQuery] = React.useState("");
			const [srcQuery, setSrcQuery] = React.useState("");
			const [onlySet, setOnlySet] = React.useState(false);
			const [openMore, setOpenMore] = React.useState({}); // 每行独立的"更多等级"开关
			const [less, setLess] = React.useState(false); // false = 全部展开（默认），true = 全部收起

			const load = () => {
				setBusy(true);
				Promise.all([
					bridge.describe(),
					bridge.catalog()
				]).then(([describeRes, catalogRes]) => {
					let list = [];
					if (describeRes && describeRes.ok) {
						const view = describeRes.value;
						const doc = ((view && view.namespaces) || []).find((n) => n.ns === NS);
						setRevision(doc ? doc.revision : undefined);
						const raw = (doc && doc.user) || {};
						for (const [id, profile] of Object.entries((raw && raw.providers) || {})) {
							if (!profile || !Array.isArray(profile.models)) continue;
							list.push({ id, displayName: profile.displayName || id, models: profile.models.map(cleanEntry) });
						}
					} else {
						const err = describeRes && describeRes.error;
						setResult({ ok: false, error: "读取设置失败：" + ((err && (err.message || err.code)) || "未知错误") });
					}
					setProviders(list);
					const d = {};
					const b = {};
					for (const p of list) {
						d[p.id] = p.models.map((m) => ({ ...m }));
						b[p.id] = p.models.map((m) => ({ ...m }));
					}
					setDrafts(d);
					setBaseline(b);

					const groups = catalogRes && catalogRes.ok && catalogRes.value ? catalogRes.value.groups || [] : [];
					setCatalog(groups.map((g) => ({
						provider: g.id,
						displayName: g.name || g.id,
						models: (g.models || []).map((m) => ({ id: m.id, name: m.name || m.id, reasoning: m.reasoning }))
					})));
				}).catch((e) => setResult({ ok: false, error: String(e && e.message || e) })).finally(() => setBusy(false));
			};
			React.useEffect(() => { load(); }, []);

			const upd = (pid, index, patch) => {
				setDrafts((prev) => {
					const next = { ...prev };
					next[pid] = (next[pid] || []).map((m, i) => (i === index ? { ...m, ...patch } : m));
					return next;
				});
			};
			const toggleLevel = (pid, index, level) => {
				const m = (drafts[pid] || [])[index];
				if (!m) return;
				const re = reOf(m);
				if (re && level in re) {
					delete re[level];
					if (Object.keys(re).length === 0) { upd(pid, index, { reasoningEfforts: undefined }); return; }
					upd(pid, index, { reasoningEfforts: re });
				} else {
					upd(pid, index, { reasoningEfforts: { ...(re || {}), [level]: level === "off" ? null : level } });
				}
			};
			const setWire = (pid, index, level, value) => {
				const m = (drafts[pid] || [])[index];
				if (!m) return;
				const re = reOf(m) || {};
				re[level] = level === "off" ? (value === "" ? null : value) : value;
				upd(pid, index, { reasoningEfforts: re });
			};
			const toggleImage = (pid, index) => {
				const m = (drafts[pid] || [])[index];
				if (!m) return;
				upd(pid, index, { input: imgOn(m) ? ["text"] : ["text", "image"] });
			};
			const inheritTo = (pid, index, srcProvider, srcModel) => {
				bridge.source({ provider: srcProvider, model: srcModel })
					.then((resp) => {
						setPicker(null);
						setSrcQuery("");
						if (!resp || !resp.ok || !resp.value) {
							setResult({ ok: false, error: "来源模型无能力信息（" + (resp && resp.error ? (resp.error.message || resp.error.code) : "未知错误") + "）" });
							return;
						}
						const s = resp.value;
						const patch = {};
						patch.input = Array.isArray(s.input) && s.input.includes("image") ? ["text", "image"] : ["text"];
						const levels = (s.levels || []).filter((l) => ALL_LEVELS.includes(l));
						if (levels.length > 0) {
							const re = {};
							for (const l of levels) {
								if (l === "off") re[l] = null;
								else if (s.wire && typeof s.wire[l] === "string" && s.wire[l].length > 0) re[l] = s.wire[l];
								else re[l] = l;
							}
							patch.reasoningEfforts = re;
						} else {
							patch.reasoningEfforts = false;
						}
						if (s.compat && typeof s.compat === "object" && Object.keys(s.compat).length > 0) patch.compat = { ...s.compat };
						upd(pid, index, patch);
						setResult({ ok: true, error: "已从 " + srcProvider + "." + srcModel + " 继承能力" + (s.exact ? "" : "（目录无精确条目，已按同族/等级名继承）") + "。点击「保存」写入。" });
					})
					.catch((e) => { setPicker(null); setResult({ ok: false, error: String(e && e.message || e) }); });
			};

			// 扁平行：所有供应商的模型平铺
			const flat = (providers || []).flatMap((p) => (drafts[p.id] || []).map((m, i) => ({ pid: p.id, pname: p.displayName, i, m })));
			const q = query.trim().toLowerCase();
			const shown = flat
				.filter(({ m, pname }) => !q || (m.id || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q) || (pname || "").toLowerCase().includes(q))
				.filter(({ m }) => !onlySet || imgOn(m) || m.reasoningEfforts !== undefined || (m.compat && Object.keys(m.compat).length > 0));
			// 变更统计（按供应商）
			const changedPids = (providers || []).filter((p) => stable(drafts[p.id] || []) !== stable(baseline[p.id] || [])).map((p) => p.id);
			let diffCount = 0;
			for (const pid of changedPids) {
				const b = baseline[pid] || [];
				const d = drafts[pid] || [];
				for (let i = 0; i < Math.max(b.length, d.length); i++) if (stable(b[i]) !== stable(d[i])) diffCount++;
			}
			const doSave = () => {
				setBusy(true);
				const ops = changedPids.map((pid) => ({ op: "set", path: ["providers", pid, "models"], value: drafts[pid] || [] }));
				bridge.mutate(ops, revision).then((resp) => {
					if (resp && resp.ok) {
						setResult({ ok: true, error: "已保存。模型选择器与对话请求将使用新的能力配置。" });
						load();
					} else {
						const err = resp && resp.error;
						setResult({ ok: false, error: (err && (err.message || err.code)) || "保存失败（响应无错误信息）" });
					}
				}).catch((e) => {
					setResult({ ok: false, error: String(e && e.message || e) });
				}).finally(() => setBusy(false));
			};
			const bulkImage = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					for (const pid of Object.keys(next)) next[pid] = (next[pid] || []).map((m) => {
						const hasImg = Array.isArray(m.input) && m.input.includes("image");
						return /vision|omni/i.test(String(m.id || "")) && !hasImg ? { ...m, input: ["text", "image"] } : m;
					});
					return next;
				});
			};
			const bulkReason = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					for (const pid of Object.keys(next)) next[pid] = (next[pid] || []).map((m) => hasReason(m) ? m : { ...m, reasoningEfforts: { off: null, high: "high", max: "max" } });
					return next;
				});
			};
			const bulkClear = () => {
				setDrafts((prev) => {
					const next = { ...prev };
					for (const pid of Object.keys(next)) next[pid] = (next[pid] || []).map((m) => {
						const c = { ...m };
						delete c.input;
						delete c.reasoningEfforts;
						delete c.compat;
						return c;
					});
					return next;
				});
			};
			const sq = srcQuery.trim().toLowerCase();
			// 只显示有模型的供应商（无模型=无来源可继承，不占用弹窗空间）
			const fCatalog = catalog
				.filter((p) => p.models.length > 0)
				.map((p) => {
					const pm = p.displayName.toLowerCase().includes(sq) || p.provider.toLowerCase().includes(sq);
					const models = p.models.filter((m) => (m.name || m.id).toLowerCase().includes(sq));
					return { ...p, models: pm ? p.models : models };
				})
				.filter((p) => p.models.length > 0);

			const chip = (pid, index, level) => {
				const m = (drafts[pid] || [])[index];
				const re = reOf(m);
				const on = !!(re && level in re);
				const showWire = on && level !== "off";
				return React.createElement("span", { key: level, style: chipStyle(on) },
					React.createElement("span", { onClick: () => toggleLevel(pid, index, level) }, level),
					showWire ? React.createElement("input", { value: re[level] || "", size: 5, style: { width: 52, border: "none", borderBottom: "1px solid var(--dsw-alias-border-l3)", background: "transparent", borderRadius: 0, padding: "0 2px", fontSize: 12, color: "var(--dsw-alias-label-primary)", outline: "none" }, onChange: (e) => setWire(pid, index, level, e.target.value) }) : null
				);
			};

			return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12, maxWidth: "100%", paddingBottom: 88 } },
				// 标题区
				React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } },
					React.createElement("h2", { style: { margin: 0, fontSize: 17, fontWeight: 600, color: "var(--dsw-alias-label-primary)" } }, "模型能力管理"),
					React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } }, "为自定义模型设置图片输入与推理强度，可一键继承目录模型的精确能力")
				),
				// 工具条卡片
				React.createElement("div", { style: { ...S.card, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
					React.createElement("input", { type: "text", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "搜索模型 / 供应商…", style: { ...S.input, flex: "1 1 160px", minWidth: 130, maxWidth: 320 } }),
					React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--dsw-alias-label-secondary)", cursor: "pointer", whiteSpace: "nowrap" } }, React.createElement("input", { type: "checkbox", checked: onlySet, onChange: (e) => setOnlySet(e.target.checked) }), "只看已设置"),
					React.createElement("span", { style: { flex: 1 } }),
					React.createElement("button", { type: "button", onClick: () => { setLess(!less); setOpenMore({}); }, style: S.ghost }, less ? "全部展开" : "全部收起"),
					React.createElement("button", { type: "button", onClick: bulkImage, style: S.ghost }, "批量开视觉"),
					React.createElement("button", { type: "button", onClick: bulkReason, style: S.ghost }, "批量开推理"),
					React.createElement("button", { type: "button", onClick: bulkClear, style: S.ghost }, "清空能力")
				),
				React.createElement("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } }, (providers || []).length + " 个供应商 · " + flat.length + " 个模型" + (busy ? " · 加载中…" : "")),
				result ? React.createElement("div", { style: { fontSize: 13, padding: "8px 12px", borderRadius: 8, background: result.ok ? "var(--dsw-alias-state-success-tertiary)" : "var(--dsw-alias-state-error-secondary)", color: result.ok ? "var(--dsw-alias-state-success-primary)" : "var(--dsw-alias-state-error-primary)" } }, result.ok ? result.error : ("保存失败：" + result.error)) : null,
				// 平铺模型卡片（允许换行，不截断）
				shown.length === 0
					? React.createElement("p", { style: { fontSize: 13, color: "var(--dsw-alias-label-tertiary)" } }, "没有匹配的模型。")
					: React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, shown.map(({ pid, pname, i, m }) => {
						const rowKey = pid + ":" + i;
						const more = !less || !!openMore[rowKey];
						return React.createElement("div", { key: rowKey, style: { ...S.card, display: "flex", flexDirection: "column", gap: 8 } },
							// 第一行：供应商徽章 + 模型名（可换行，永不截断）
							React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 } },
								React.createElement("span", { style: S.badge }, pname),
								React.createElement("span", { style: { fontWeight: 600, fontSize: 14, color: "var(--dsw-alias-label-primary)", wordBreak: "break-all", lineHeight: 1.35 } }, m.name || m.id),
								m.name && m.name !== m.id ? React.createElement("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", wordBreak: "break-all" } }, m.id) : null,
								compatTag(m) ? React.createElement("span", { style: { fontSize: 11, color: "var(--dsw-alias-label-secondary)", background: "var(--dsw-alias-bg-layer-3)", padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap" } }, "compat·" + compatTag(m)) : null
							),
							// 第二行：控件组（可换行）
							React.createElement("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" } },
								React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--dsw-alias-label-secondary)", cursor: "pointer", whiteSpace: "nowrap" } }, React.createElement("input", { type: "checkbox", checked: imgOn(m), onChange: () => toggleImage(pid, i) }), "图片"),
								React.createElement("div", { style: { display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" } },
									MAIN_LEVELS.map((lvl) => chip(pid, i, lvl)),
									!more ? React.createElement("button", { key: "more", type: "button", onClick: () => setOpenMore((prev) => ({ ...prev, [rowKey]: true })), style: { border: "none", background: "none", color: "var(--dsw-alias-brand-primary)", cursor: "pointer", fontSize: 12, padding: "0 4px", whiteSpace: "nowrap" } }, "更多…") : null,
									more ? EXTRA_LEVELS.map((lvl) => chip(pid, i, lvl)) : null
								),
								React.createElement("button", { type: "button", onClick: () => setPicker({ pid, index: i }), style: { ...S.ghost, fontSize: 12, padding: "3px 10px", marginLeft: "auto" } }, "继承自…")
							)
						);
					})),
				// 底部保存条
				React.createElement("div", { style: { position: "sticky", bottom: 0, background: "color-mix(in srgb, var(--dsw-alias-bg-layer-1) 96%, transparent)", backdropFilter: "blur(4px)", borderTop: "1px solid var(--dsw-alias-border-l2)", padding: "10px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 } },
					React.createElement("span", { style: { fontSize: 13, color: diffCount === 0 ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-state-error-primary)" } }, diffCount === 0 ? "没有未保存的修改" : ("将修改 " + diffCount + " 个模型（" + changedPids.length + " 个供应商）")),
					React.createElement("span", { style: { flex: 1 } }),
					React.createElement("button", { type: "button", onClick: () => { setDrafts({ ...baseline }); setResult(null); }, disabled: busy || diffCount === 0, style: { ...S.ghost, opacity: busy || diffCount === 0 ? 0.45 : 1 } }, "撤销修改"),
					React.createElement("button", { type: "button", onClick: doSave, disabled: busy || diffCount === 0, style: { ...S.primary, opacity: busy || diffCount === 0 ? 0.45 : 1 } }, "保存")
				),
				// 继承弹窗
				picker !== null ? React.createElement("div", { style: { position: "fixed", inset: 0, background: "var(--dsw-alias-bg-mask-drop)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 } },
					React.createElement("div", { style: { ...S.card, width: "min(640px, 92vw)", maxHeight: "72vh", display: "flex", flexDirection: "column", gap: 10, borderRadius: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.18)" } },
						React.createElement("div", { style: { fontWeight: 600, fontSize: 14, color: "var(--dsw-alias-label-primary)" } }, "选择要继承的模型"),
						React.createElement("input", { type: "text", value: srcQuery, onChange: (e) => setSrcQuery(e.target.value), placeholder: "搜索供应商 / 模型名…", style: S.input }),
						React.createElement("div", { style: { overflow: "auto", minHeight: 0, flex: 1 } },
							fCatalog.length === 0
								? React.createElement("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-tertiary)" } }, catalog.length === 0 ? "没有可用的来源供应商。" : "没有匹配的模型。")
								: fCatalog.map((p) => React.createElement("div", { key: p.provider, style: { marginBottom: 10 } },
									React.createElement("div", { style: { fontWeight: 600, fontSize: 12, color: "var(--dsw-alias-label-secondary)" } }, p.displayName),
									React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 } }, p.models.length === 0
										? React.createElement("span", { style: { color: "var(--dsw-alias-label-tertiary)", fontSize: 12 } }, "（无匹配）")
										: p.models.map((mm) => React.createElement("button", { key: mm.id, type: "button", onClick: () => inheritTo(picker.pid, picker.index, p.provider, mm.id), style: { ...S.ghost, borderRadius: 999, padding: "4px 12px", fontSize: 12 } }, mm.name || mm.id)))
								))
						),
						React.createElement("div", { style: { display: "flex", justifyContent: "flex-end" } },
							React.createElement("button", { type: "button", onClick: () => { setPicker(null); setSrcQuery(""); }, style: S.ghost }, "取消")
						)
					)
				) : null
			);
		}
		//#endregion

		const inject = ["slots", "connection"];
		function apply(ctx) {
			// `connection` 只提供 rpc；设置读写必须走 `remote.settings`
			// （旧的 connection.api.settings/llm 早已不存在，直接访问会让
			//  settings.section 抛错并渲染成空白页）。
			ctx.inject(["slots", "connection", "remote", "remote.settings"], (scoped) => {
				const slots = scoped.slots;
				const rpc = scoped.connection.rpc;
				const settings = scoped.remote.settings;
				// 目录（“继承自…”的来源）是可选依赖：拿不到也要能渲染页面。
				let loadCatalog = null;
				ctx.inject(["remote", "remote.session"], (extra) => {
					loadCatalog = () => extra.remote.session.modelCatalog();
				});
				const bridge = {
					describe: () => settings.describe(),
					mutate: (ops, revision) => revision === undefined
						? settings.mutate(NS, ops)
						: settings.mutate(NS, ops, revision),
					catalog: () => loadCatalog
						? loadCatalog()
						: Promise.resolve({ ok: true, value: { groups: [] } }),
					source: (request) => rpc.call("/api", "modelCapability/source", { args: { request } })
				};
				slots.inject("settings.section", () => slots.register({
					name: "settings.section",
					id: "model-fit",
					order: 12,
					label: "模型能力管理"
				}, (props) => React.createElement(ModelCapabilitiesPage, { ...props, bridge })));
			});
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
