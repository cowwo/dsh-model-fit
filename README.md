# dsh-model-fit

**模型能力管理** —— 为 DSH 的自定义（手动添加）模型设置「图片输入」与「推理强度」，并支持**一键继承**目录模型的精确能力（含线上取值与 compat），解决手动添加模型时无法配置推理强度、以及最新模型不显示图片输入的问题。

- 包名 / 行 ID：`dsh-model-fit` / `model-fit`
- 当前版本：`0.1.8`
- 类型：DSH Web Profile Bundle（正式插件，非动态调试插件）
- 依赖：`@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-typert-protocol`、`@earendil-works/pi-ai`（运行时由 DSH 安装目录级联解析）

---

## 为什么做这个插件

DSH 的模型供应方有两类：**内置**（自带完整目录，含推理强度/图片能力）和**手动添加**（只填 Provider ID/地址/协议，模型列表自行填写）。

手动添加的模型有两个痛点：

1. **推理强度** —— 界面无法为手写模型选择推理等级，模型不显示 reasoning 能力。
2. **图片输入** —— 较新模型（如 `glm-5.3`、`deepseek-v4-flash-vision-exp` 等）在模型选择器里不显示图片输入，导致 `model-unavailable: ... does not accept image input`。

本插件直接把这些能力写入 `llm-pi-ai` 设置命名空间的模型配置（`input`、`reasoningEfforts`、`compat`），运行时由 pi-ai 适配器解析生效，因此请求时图片/推理真正可用。

---

## 功能总览

### 1. 全模型平铺列表
- 不再按供应商选择 —— **所有供应商的所有模型平铺展示**，每个模型卡片上显示所属供应商徽章（如 `ocgo-01`）。
- 顶部统计：`N 个供应商 · N 个模型`。
- 卡片两行布局（允许换行，**模型名永不截断**）。

### 2. 图片输入开关
- 每个模型一个「图片」复选框，勾选 = `input: ['text','image']`，取消 = `input: ['text']`。
- 选中后模型选择器会显示图片能力、请求可携带图片。

### 3. 推理强度等级
- 每个模型一组**等级 pill**：`off / high / max`（主力）＋ 更多（`minimal / low / medium / xhigh`）。
- 点击切换开关；选中的等级显示为品牌色描边。
- **线上值可编辑**：选中某个等级后，pill 内出现一个小输入框，可直接改真实请求串（例如 `high` ↔ 等价的 `high`/其它字符串）。
- 工具条提供 **「全部收起 / 全部展开」** 一键切换所有行的等级显示；收起后每行仍保留「更多…」单独展开。

### 4. 一键继承（核心）
- 每个模型的「继承自…」按钮打开选择弹窗，列出**所有有模型的目录供应商**（无模型供应商自动隐藏）。
- 选择一个来源模型后，插件通过运行时 RPC `modelCapability/source` 读取其精确能力，并整体覆盖到当前模型：
  - 图片输入模态（`input`）
  - 推理等级（`reasoningEfforts`，含**线上取值**）
  - 兼容配置（`compat`，例如 deepseek 系的 `thinkingFormat:'deepseek'`、`maxTokensField` 等 — 这正是让真实请求可用的关键）
- 若目录无该模型精确条目（如自定义的 `deepseek-v4-flash-vision-exp`），会自动按**同族模型**（`deepseek-v4-flash`）或等级名继承，并在提示里注明。

### 5. 批量操作
- **批量开视觉**：把所有 `vision/omni` 命名的模型自动设为支持图片。
- **批量开推理**：把所有尚无推理配置的模型设为 `off/high/max`。
- **清空能力**：清空当前所有模型的 `input / reasoningEfforts / compat`（还原为未设置）。

### 6. 搜索与过滤
- 搜索框：同时匹配**模型名 / 模型 id / 供应商名**。
- 「只看已设置」：只显示已配置能力（图片/推理/compat 任一）的模型。

### 7. 跨供应商一次保存
- 底部保存条统计：`将修改 N 个模型（M 个供应商）`。
- 点「保存」把**所有有变更的供应商**合并成一次 `settings.mutate`（多个 ops + 同一个 `expectedRevision`，原子提交）。
- 「撤销修改」一键还原到打开时的基线。
- 保存成功/失败以绿/红横幅提示。

### 8. 原生 UI 风格
- 完全复用官方主题变量 `var(--dsw-alias-*)`（卡片、边框、文字、品牌色、状态色），**自动适配浅色/深色主题**。
- 卡片式布局、pill 徽章、ghost/主按钮，与 DSH「模型」原生设置页同一套视觉语言。

---

## 工作原理（架构）

```
浏览器端（client/client.js）
  ├─ connection.api.settings.describe({})   读取 llm-pi-ai 原始配置（含每个供应商的 models）
  ├─ connection.api.llm.providers / models  读取目录（供“继承”选择来源）
  ├─ connection.api.settings.mutate({ns, ops, expectedRevision})   跨供应商一次保存
  └─ connection.rpc.call("/api","modelCapability/source",{args:{request}})
        │
        ▼
主机端（lib/index.js + lib/typert.host.js）
  └─ ModelCapabilityService.source(request)
        ├─ this.ctx.llm.resolveModelInfo(provider, model)   → inputModalities + 推理等级 ids
        └─ @earendil-works/pi-ai/providers/all 目录          → thinkingLevelMap(线上取值) + compat
```

- 主机暴露一个 typert 主机端点 `modelCapability/source`（严格 manifest，`lib/typert.host.js`），浏览器端通过网关调用。
- 保存走的是官方 `api.settings.mutate`（主 realm），避免动态插件沙箱 realm 的序列化问题。
- 写入的数据位于 `llm-pi-ai` 设置命名空间的 `providers.<id>.models`：`input` / `reasoningEfforts` / `compat`，由 pi-ai 适配器在运行时解析生效。

### 目录结构

```
dsh-model-fit/
├── package.json          # 包描述 + dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml      # 向 profile 插入行：model-fit
├── lib/
│   ├── index.js          # host 端 ModelCapabilityService（source：读取来源能力）
│   └── typert.host.js    # 手写 typert 主机 manifest（modelCapability/source）
└── client/
    └── client.js         # 设置页 section UI（纯浏览器，__ModuleLoader__ 格式）
```

---

## 安装 / 卸载 / 还原

> 插件作为 **profile bundle** 安装，改动 profile 的 `package.json` 与 `dsh.profile.bundles`，**需重启 dsh web 生效**。

```sh
# 安装（首次/更新）
dsh plugin --profile web add dsh-model-fit
# 重启 dsh web 生效

# 卸载（完全还原）
dsh plugin --profile web remove dsh-model-fit
# 重启 dsh web 后插件行消失、UI 分区消失
```

**还原说明**：
- 卸载插件只移除 UI 与行；已写入的模型能力数据（`input`/`reasoningEfforts`/`compat`）会保留在 `settings.yaml`，且仍正常生效（无害）。
- 若想连数据一起清掉，先在插件里「清空能力」并保存，或手动编辑 `llm-pi-ai` 配置。

---

## 使用流程（快速上手）

1. 打开 **设置 → 模型能力管理**。
2. 在列表里找到目标模型（供应商徽章标识归属，如 `ocgo-01`）。
3. 需要图片 → 勾选「图片」；需要推理 → 点选对应等级（可改线上值）。
4. 或点「继承自…」，选一个目录中的同模型，一键带出全部能力。
5. 底部点「保存」。绿色横幅即成功。
6. 回到「模型」页/模型选择器确认该模型已显示图片与推理强度。

---

## 已知限制

- 继承时若目录没有该模型的**精确**条目（如自造的 `*-vision-exp`），会按同族/等级名继承并提示 —— 这是目录数据缺失所致，非插件 bug。
- 无模型的目录供应商在“继承”弹窗中不显示（无来源可继承）。
- 对个别需要特定 `compat` 才能跑通的第三方网关，若默认继承后仍请求异常，可在等级 pill 的小输入框手动调整线上值。

---

## License

MIT
