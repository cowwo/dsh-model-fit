# dsh-model-fit

**模型能力管理** —— 为 DSH 的自定义（手动添加）模型设置「图片输入」与「推理强度」、为每条线路设置「系统消息角色」，并支持**一键继承**目录模型的精确能力（含线上取值与 compat），解决手动添加模型时无法配置推理强度、以及最新模型不显示图片输入的问题。

- 包名 / 行 ID：`dsh-model-fit` / `model-fit`
- 当前版本：`0.2.2`
- 类型：DSH Web Profile Bundle（正式插件，非动态调试插件）
- 依赖：
  - **`zod@^4`（真实 dependency，随插件自动安装）** —— `lib/typert.host.js` 直接 `import { z } from 'zod'`，而 DSH 的 typert 校验要求 schema 必须是 **zod v4**（判据是内部标记 `_zod`）。声明为 dependency 才能保证解析到 v4，详见下方 0.1.10 变更记录。
  - `@deepseek-ai/cordis`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-typert-protocol`、`@earendil-works/pi-ai`（peer，运行时由 DSH 安装目录级联解析；范围统一为 `*`，跟随运行时、不写死上界，详见下方 0.2.1 变更记录）

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

### 9. 线路系统消息角色（`compat.supportsDeveloperRole`）
- 在模型列表上方按**线路**列出「系统消息角色」下拉：`自动（交给 pi-ai 推断）` / `强制 system` / `强制 developer`。
- 写入的是 `providers.<id>.compat.supportsDeveloperRole`，即**线路级默认值**；pi-ai 合并顺序是 `模型 compat > 线路 compat > 安装目录条目 > 自身探测`，所以单个模型自己写了同名字段时以模型为准（界面上会提示）。
- 用途：某些中转/上游只认 `system`，而 DSH 对推理模型默认发 OpenAI 的 `developer` 角色，会间歇性 422（错误形如 `unknown variant 'developer'`）。选「强制 system」就写 `false`，从源头绕开，不必手改 `settings.yaml`。
- 「自动」= 删除该字段（`compat` 里只剩这一个键时整块删除，不留空的 `compat: {}`），交回 pi-ai 按 baseURL/协议推断。
- 只收这个字段的协议（`openai-completions` / `openai-responses` / `azure-openai-responses` / `openai-codex-responses`）才可编辑；其它协议的线路（如 `anthropic-messages`）下拉置灰并给出原因 —— 线路级写了协议不认的 compat 字段会被设置层**整条拒绝**，所以这里提前拦掉。

---

## 工作原理（架构）

```
浏览器端（client/client.js）
  ├─ connection.remote.settings.describe()                读取 llm-pi-ai 原始配置（含每个供应商的 models）
  ├─ connection.remote.session.modelCatalog()              读取目录（供“继承”选择来源）
  ├─ connection.remote.settings.mutate(ns, ops, revision)  跨供应商一次保存
  └─ connection.rpc.call("/api","modelCapability/source",{args:{request}})
        │
        ▼
主机端（lib/index.js + lib/typert.host.js）
  └─ ModelCapabilityService.source(request)
        ├─ this.ctx.llm.resolveModelInfo(provider, model)   → inputModalities + 推理等级 ids
        └─ @earendil-works/pi-ai/providers/all 目录          → thinkingLevelMap(线上取值) + compat
```

- 主机暴露一个 typert 主机端点 `modelCapability/source`（严格 manifest，`lib/typert.host.js`），浏览器端通过网关调用。
- 设置读写走官方 **Remote 命名空间** `ctx.remote.settings`（`describe` / `mutate`），与官方「模型」设置页同一条写入路径，因此写入即时生效、无沙箱 realm 序列化问题。
- 目录来源走官方 `ctx.remote.session.modelCatalog()`（与模型选择器同源），拿不到时该依赖可选降级，页面照常渲染。
- 写入的数据位于 `llm-pi-ai` 设置命名空间：**模型级** `providers.<id>.models[]` 的 `input` / `reasoningEfforts` / `compat`，以及**线路级** `providers.<id>.compat.supportsDeveloperRole`（系统消息角色），都由 pi-ai 适配器在运行时解析生效。
- 所有写入都是 `settings.mutate` 的**路径操作**（`set` 深路径会自动创建中间对象，`unset` 精确删叶子），模型能力与线路角色会合并进**同一次** mutate、共用同一个 `expectedRevision`，因此只改角色时不会顺带重写没变化的模型列表。

### 依赖的服务（client 端 inject）

| 服务 | 用途 | 必需 |
| --- | --- | --- |
| `slots` | 注册 `settings.section` 设置分区 | 是 |
| `connection` | `connection.rpc` 调用主机 `modelCapability/source` | 是 |
| `remote` + `remote.settings` | 设置命名空间的读写（`describe` / `mutate`） | 是 |
| `remote.session` | `modelCatalog()` 提供“继承自…”的目录来源 | 否（缺失则来源列表为空） |

> ⚠️ 注意：`ctx.connection` **不提供** `api`。历史上曾有 `connection.api.settings/llm` 这层封装，0.1.5 起已移除；若继续访问 `connection.api.settings`，`settings.section` 会在渲染时抛
> `TypeError: Cannot read properties of undefined (reading 'settings')`，被 slot 错误边界吞掉，表现为**整页空白**。这正是 0.1.8 及更早版本的故障点。

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
- 「自动」**不显示 pi-ai 实际推断出的角色**：推断逻辑（`detectCompat`）在 pi-ai 内部且未导出，浏览器端算不出来。经验上自定义线路（baseURL 不含任何已知厂商特征）会被推断为 `developer`，所以想稳妥就显式选「强制 system」。
- 「继承自…」会**整体覆盖**模型的 `compat`；若来源目录条目的 compat 里带 `supportsDeveloperRole`，它会盖过线路级角色设置。遇到这种情况按线路重设一次，或直接改用线路级开关（模型只要不写该字段就跟随线路）。

---

## 变更记录

### 0.2.2

**修复：0.2.1 放开 peer 后插件终于能加载了，但它的 Typert 清单还是 0.1.x 旧契约 —— 一激活就把整棵插件树带崩，聊天记录都看不到。**

- 现象：0.2.1 之后重启 `dsh web`，界面起来但**整个聊天记录都看不到**；把 `dsh-model-fit` 从 profile 的 `dsh.profile.bundles` 里手工摘掉才恢复。
- 根因：`lib/typert.host.js` 里两处 strict codec 用的是 0.1.x 的裸 `schema` 字段：
  ```js
  codec: { mode: 'strict', typeSymbol: '…:request', schema: sourceRequestSchema }   // 旧
  ```
  0.2.x 的契约要求 `create` 是**工厂函数**（网关按 `codec.create().parse(value)` 调用，registry 把 `create()` 的结果缓存为 schema）：
  ```js
  const X$schema = () => (X$schema$value ??= z.…)                                    // 官方生成物同形
  codec: { mode: 'strict', typeSymbol: '…', create: X$schema }                        // 新
  ```
  判据在 `dsh-typert-loader` 的 `requireStrictCodec`：`typeof codec.create !== "function"` → 抛 `has no create() factory`；`dsh-typert-registry` 的 `validateCodec` 同样要求 `create`。
- **为什么是全局故障而不是只挂一个插件**：loader 的 `apply()` 里 `await Promise.all(flush(...))`，把注册失败汇成 `AggregateError` 抛出 → 这个核心 entry 挂载失败 → 整棵插件树加载失败。清单错误在这个架构里不是局部故障。
- **为什么之前一直没暴露**：0.1.x→0.2.x 的 peer 范围把整个 bundle 挡在门外（`incompatible-version`），插件根本没机会激活 —— 那道检查**意外地掩盖**了清单的旧契约。0.2.1 放开 peer 后掩盖消失，真实不兼容立刻显形。这也是"放开 peer"必须配一次清单复验的原因。
- 改法与验证：
  - 两处 codec 改为 `create: () => <schema>`（惰性工厂，与官方生成物同形）。
  - 用 loader 自己导出的校验器 `validateTypertManifest('dsh-model-fit', TYPERT)` 验证通过 —— 正是当初抛错的那道闸。
  - 复刻 `typert-registry` 的 `validateCodec` / wire 名 / segment 名规则逐条检查通过，并确认清单里不再残留死掉的 `schema` 字段。
  - 按真实调用路径 `codec.create().parse(value)` 实测：参数解析、结果解析、结果 `null`、非法输入被拒；`_zod` v4 标记在位（zod 4.6.5）。
  - 顺带核对同期其它 API 面：`TypertRemoteService` 构造函数逐字未变、`ctx.llm.resolveModelInfo` 仍在、`settings.mutate` 的 `{op:'set'|'unset', path}` 契约未变、client `inject` 的 4 个名字与同 profile 正常工作插件一致、`client/client.js` 语法 OK。
- ⚠️ 教训：**peer 范围是"声明"，不是"兼容性证明"。** 放开它只解决"被误拦"，同时撤掉那道意外保护 —— 以后每次 DSH 大版本升级，都要用官方校验器把 typert 清单重新验一遍，而不是只看"插件能不能加载"。

### 0.2.1

**修复：DSH 升到 0.2.0-rc.1 后插件被整个拦在门外（插件页显示「异常」，`incompatible-version`）。**

- 现象：profile 里 `dsh-model-fit` 被判不兼容 —— `dsh-model-fit@0.2.0 与 DSH 0.2.0-rc.1 不兼容（要求 @deepseek-ai/dsh-typert-protocol ^0.1.1-rc.2）`。真实后果不只是警告：整个 bundle 被跳过，它那层 patch 不加载，`modelCapability` 服务不存在，「一键继承」直接失效。
- 根因：`peerDependencies` 里写死的 `^0.1.1-rc.2` 规范化后是 `>=0.1.1-rc.2 <0.2.0-0` —— 0.x 的 caret 只允许 patch 位浮动。而 DSH 0.2.0-rc.1 自带的 `@deepseek-ai/dsh-typert-protocol` 是 **0.2.0-rc.1**，正好落在上界之外。这个范围从首个 commit 就写死了（当时运行时是 0.1.x），随 DSH 升到 0.2 才引爆。
- 排查要点：
  - 判定发生在**启动时**：`dsh-app-boot` 的 `loadProfileDirectory` 对每个 bundle 跑 `evaluatePluginCompatibility`，不通过就整包跳过（记入 `skippedBundles`），不是只打一条警告。
  - 它只看名字为 `@deepseek-ai/dsh` 或 `@deepseek-ai/dsh-*` 的 peer，用 `semver.satisfies(运行版本, range, { includePrerelease: true })` 比。
  - **`peerDependenciesMeta.optional: true` 不救场**：那段检查完全不读 `peerDependenciesMeta`，标了 optional 照样拦。
- 同时确认 API 其实没变（所以是过期声明，不是真不兼容）：插件对 protocol 的全部用法只有 `TypertRemoteService`（`lib/index.js` 的 import 与 `super(ctx, 'modelCapability')`）；0.2.0-rc.1 仍从包根导出它，构造函数体与 0.1.1-rc.2 逐字一致；且 profile 与插件 `node_modules` 里的 protocol 都指向运行时那一份，不存在双实例。
- 改法：`@deepseek-ai/dsh-typert-protocol` 与 `@earendil-works/pi-ai` 的 peer 范围统一改成 `"*"`（与同作者的 `dsh-provider-info`、同 profile 的 `dsh-icon-custom`/`dsh-notify-p` 一致）。host 提供的依赖跟随运行时，不再写死上界 —— 以后升到 0.5.0 / 1.0.0 也不会再被拦。
  - 顺带修掉一个同类隐患：`@earendil-works/pi-ai` 原写 `^0.84.3`，而运行时实际解析到 0.85.1，同样早已落在范围外（只因它不是 dsh 系 peer 才没被拦）。
- 验证方式：
  - 直接调用 DSH 自己的判定函数，对 `0.1.10 / 0.2.0-rc.1 / 0.2.5 / 0.5.0 / 1.0.0 / 2.0.0-rc.1 / 1.0.0-beta.3` 全部 PASS。
  - 复现启动时的组合逻辑：profile 的 10 个 bundle 全部成层、`skippedBundles` 为空，`dsh-model-fit` 正常贡献出 `model-fit` 行。
  - 单独 `import lib/index.js`，确认在当前运行时 protocol 下加载正常（`TypertRemoteService`、`inject = ['llm']`）。
- ⚠️ 改完需**重启 `dsh web`**（bundle 在启动时组合，改 peer 不会热生效）。

### 0.2.0

**新增：线路级「系统消息角色」—— 不用再手改 `settings.yaml` 绕开 `developer` 422。**

- 背景：DSH 对声明了 `reasoningEfforts` 的模型，会把系统提示词以 OpenAI 的 `developer` 角色发出（`@earendil-works/pi-ai/dist/api/openai-completions.js` 里 `useDeveloperRole = model.reasoning && compat.supportsDeveloperRole`）。部分中转/上游只认 `system`，会返回 422 `invalid_request_error`（DeepSeek 官方原文：`messages[0].role: unknown variant 'developer'`），而 422 不在 DSH 的自动重试名单里，所以表现为「整轮随机失败」。此前的对策是手写一行：
  ```yaml
  providers:
    cmd-01:
      compat:
        supportsDeveloperRole: false
  ```
- 现在在「设置 → 模型能力管理」页的模型列表上方，按线路给出下拉：`自动` / `强制 system` / `强制 developer`，写入同一条线路级 `compat.supportsDeveloperRole`，保存后即时生效。
- 实现要点：
  - 读：`remote.settings.describe()` → `namespaces[llm-pi-ai].user.providers.<id>.compat.supportsDeveloperRole`（`true` → developer，`false` → system，缺失 → 自动）。
  - 写：`remote.settings.mutate('llm-pi-ai', ops, revision)`，op 为 `{op:'set', path:['providers',id,'compat','supportsDeveloperRole'], value:false|true}`；选「自动」用 `{op:'unset', …}`，当 `compat` 里只有这一个键时改成整块 `unset ['providers',id,'compat']`，避免在 `settings.yaml` 里留下空的 `compat: {}`。
  - 与原有的模型能力保存**合并成同一次 mutate、同一个 `expectedRevision`**：只改角色时不再多写一份没变化的 `models` 数组；底部保存条拆成「N 个模型能力 · M 条线路角色」，撤销同时回滚两者。
  - 按协议门控：只有 `openai-completions` / `openai-responses` / `azure-openai-responses` / `openai-codex-responses` 收这个字段；线路 `api` 是别的协议（如 `anthropic-messages`）时下拉置灰并说明原因 —— 线路级写协议不认的 compat 字段会被 `dsh-llm-pi-ai` 的 `assertOfferedCompatFields` / `resolveModelCompat` **整条拒绝**，不是静默忽略。
  - 纯 client 端改动：host 服务、typert manifest、依赖、profile 全部未动。
- 验证方式（不触碰真实配置）：
  - 用真实的 `applyPathOp`（`dsh-settings/lib/index.js`）语义回放四种选择生成的 ops，确认 `set` 建中间对象、`unset` 删叶子、`models` 等其它字段完好、对没有 `compat` 的线路 `unset` 是无操作。
  - 用桩 `React.createElement`/`useState` 直接执行组件函数，断言线路块渲染出的 `select` 数量/选中值/禁用态/提示文案，以及点「保存」后真正发出的 ops 内容与 mutate 次数（1 次、revision 透传、模型 op 与角色 op 数量符合预期）。
  - 远端通道确认：`dsh-api-settings-controller` 的 `settings/mutate` 严格 schema 明确接受 `{op:'unset', path:string[]}` 与布尔 `value`。
- ⚠️ 改完需**重启 `dsh web`**（插件是 link 安装、client bundle 在启动时打包，没有 HMR）。

### 0.1.10

**修复：别人安装后 `dsh web` 直接起不来（`parameter codec is not backed by a zod v4 schema`）。**

- 根因：`lib/typert.host.js` 里 `import { z } from 'zod'`，但 `package.json` **从未声明过 `zod`**（连 `dependencies` 字段都没有）。于是 zod 从哪来完全靠就近解析碰运气：`dsh plugin --profile web add` 装到对方 profile 后，解析命中 profile 里被其它包 hoist 上来的 **zod v3** → schema 没有 v4 的内部标记 `_zod` → typert-loader 校验失败。
- 后果特别重：这是 **boot 阶段**的 manifest 校验，失败会让**整个 dsh 起不来**（不是单个插件降级）。报错形如：
  ```
  Error: dsh: plugin tree failed to load: failed to apply loader entry typert-loader …
    - typert-loader: dsh-model-fit invocation "dsh-model-fit#modelCapability/source" parameter codec is not backed by a zod v4 schema
  ```
- 排查要点：DSH 的判据在 `dsh-typert-loader/lib/index.js` 的 `requireStrictCodec`：
  ```js
  if (typeof schema !== 'object' || schema === null || !('_zod' in schema) || typeof schema.parse !== 'function')
    throw new Error(`… is not backed by a zod v4 schema`)
  ```
  `_zod` 是 **zod v4 独有**的内部标记，zod v3 没有 —— 所以这条报错的唯一含义就是「拿到 v3 了」。
- 改法：`package.json` 补 `"dependencies": { "zod": "^4.4.3" }`，与 DSH 官方包（`dsh-goal`/`dsh-llm`/`dsh-commands` 等同样手写 `typert.host.js` 的包）以及同作者的 `dsh-provider-info` 一致。
- 验证方式：在**复刻了对方环境**的临时工程里（顶层 hoist 一个 zod v3），分别安装 `0.1.9` 与 `0.1.10`：
  - `0.1.9`：manifest 看到的 zod = `3.25.76`，`_zod` = false → **REJECT**（复现同一报错）
  - `0.1.10`：manifest 看到的 zod = 自带的 `4.x`，`_zod` = true → **ACCEPT**（顶层那个 v3 原封不动仍在）
- ⚠️ **教训**：写了 `typert.host.js` 就必须把 `zod` 声明成 dependency；且本地开发时若 `node_modules` 里残留一个 zod 软链，会**完全掩盖**这个 bug（本地能跑、别人装了就崩）。验证必须在干净/敌意环境里做。

### 0.1.9

**修复：设置 → 模型能力管理 整页空白。**

- 根因：client 端仍在访问 `connection.api.settings` / `connection.api.llm`，但 `ctx.connection` 从 0.1.5 起只提供 `rpc`（不提供 `api`）。组件首次渲染即抛
  `TypeError: Cannot read properties of undefined (reading 'settings')`，被 slot 错误边界（`[data-slot-error="settings.section"]`）吸收，页面只剩空白，且控制台仅有一条 console error。
- 改法：改用官方 Remote 命名空间 —— `remote.settings.describe/mutate` 读写 `llm-pi-ai`，`remote.session.modelCatalog()` 读取“继承自…”的目录来源（可选依赖，缺失时降级为空列表而非崩溃）。
- 行为不变：图片开关、推理等级、一键继承、批量操作、跨供应商一次保存、撤销修改均照旧；已验证保存后 `settings.yaml` 真实写入且模型选择器生效。

### 0.1.8

- 模型卡片两行布局、名称不再截断；等级线上取值可编辑；“全部收起/展开”。

---

## License

MIT
