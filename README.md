<div align="center">

# 🎛️ Synthesizer Flow · 合成器流

**在浏览器里搭一台模块化合成器，再让 AI 帮你接线。**

### [🌐 在线体验 · synthesizer-flow.misakif.uk](https://synthesizer-flow.misakif.uk/)

<img src="docs/images/workbench.webp" alt="Synthesizer Flow 工作台：MIDI Clip、图形化包络、滤波、混音与混响" width="100%" />

</div>

---

<a id="features"></a>

## ✨ 一张画布，从声音设计到编曲

### 🔌 接线，就是设计声音

拖出模块，连接彩色端口，实时试听每一步变化。画布支持撤销 / 重做、复制粘贴和选区复制；复杂接线可封装为 Subpatch，再用宏控件调整内部参数。

| 🔵 数值              | 🟢 音频                | 🟣 数组        | 🟠 MIDI              |
| -------------------- | ---------------------- | -------------- | -------------------- |
| 频率、门控、调制信号 | 振荡器与效果器的音频流 | 多个音高或力度 | 音符、力度、MPE 表达 |

缩小画布时，节点会自动切换完整、紧凑、极简三档细节，减少大工程的渲染开销；也可在设置中固定显示档位。

### 🎹 写下音符，留下演奏

MIDI Clip 提供钢琴卷帘编辑、复音与 MPE 表达。你可以使用屏幕钢琴、电脑键盘或外部 MIDI 设备演奏，录制音符并量化，还能用 MIDI Learn 将控制器映射到模块参数。

全局 Transport 统一管理 BPM、拍号、播放和循环区间。参数自动化记录随时间变化的音色，音符事件与循环由音频时钟调度。

### 🔊 雕刻音色，录下结果

21 个模块覆盖振荡器、噪声、滤波器、VCA、混音器、效果器和输出。图形化 ADSR 编辑器直接调整音符包络，平滑参数变化减少电平突变产生的杂音。需要录音时，将主录音机加入输出链，停止录制后导出 16-bit WAV。

### 🤖 用自然语言搭建 Patch

AI 助手可以检查画布、加载模块指南、添加模块、修改参数和接线，也可以诊断音频图并提出修复。删除、断开和诊断修复需要批准；操作批次作为一个可撤销动作应用到画布。

### 💾 让工程继续生长

本地草稿自动保存到 IndexedDB；登录后，已有云端项目的编辑可自动同步。新草稿通过手动保存首次上传。修订号用于检测云端冲突，缓存按账号隔离。工程支持 JSON 导入导出，内置示例随应用提供。

---

<a id="quick-start"></a>

## 🚀 快速开始

使用 **Node.js 22**（与 CI 一致；Next.js 16 至少需要 20.9）、PostgreSQL 和 GitHub OAuth App。数据库需启用 `vector` 扩展。

```bash
git clone https://github.com/Misaki-Akeno/synthesizer-flow.git
cd synthesizer-flow
npm ci
```

在项目根目录创建 `.env.local`：

```ini
DATABASE_URL=postgresql://user:password@localhost:5432/synthesizerflow
NEXTAUTH_SECRET=replace_with_a_random_secret
NEXTAUTH_URL=http://localhost:3000
GITHUB_ID=your_github_app_id
GITHUB_SECRET=your_github_app_secret
```

GitHub OAuth App 的本地回调地址为 `http://localhost:3000/api/auth/callback/github`。AI 供应商和 API Key 在应用设置中配置。

初始化数据库并启动工作台：

```bash
npm run drizzle:migrate
npm run dev
```

打开 [本地工作台](http://localhost:3000/zh-CN)，从欢迎窗口加载示例，或从空白画布开始。迁移会修改 `DATABASE_URL` 指向的数据库。

<details>
<summary><strong>📖 可选：RAG 知识检索与示例入库</strong></summary>

知识检索使用 pgvector 向量搜索和 PostgreSQL 全文检索，并通过 RRF 融合结果。在 `.env.local` 添加 embedding 服务配置，输出维度须与数据库向量列一致：

```ini
RAG_EMBEDDINGS_BASE_URL=https://your-embedding-provider.example/v1
RAG_EMBEDDINGS_MODEL=your_embedding_model
RAG_EMBEDDINGS_API_KEY=your_embedding_api_key
RAG_EMBEDDINGS_DIM=1024
```

内置示例无需先入库。如需写入数据库，可先预览，再执行：

```bash
npm run db:seed:examples
npm run db:seed:examples -- --apply
```

</details>

### 🎵 搭出第一条声音链

1. 从模块浏览器添加 **键盘输入器 → 高级振荡器 → 扬声器**。
2. 按下表连接端口。
3. 如果浏览器尚未解锁音频，在扬声器模块点击 **启动音频**，再弹奏屏幕钢琴。
4. 调整波形和 ADSR；在振荡器与扬声器之间插入滤波器或混响，听听音色如何变化。

| 来源                   | 目标                  | 内容                 |
| ---------------------- | --------------------- | -------------------- |
| 键盘输入器`midi`     | 高级振荡器`midi`    | 音符、力度与表达控制 |
| 高级振荡器`audioout` | 扬声器`audioInLeft` | 合成后的音频         |

想自动播放时，用 MIDI Clip 替换键盘输入器，再按顶部 Transport 的播放按钮。

<details>
<summary><strong>⌨️ 画布快捷键</strong></summary>

在画布中操作、且未编辑文本时使用；macOS 可用 `⌘` 代替 `Ctrl`。

| 操作                  | 快捷键                              |
| --------------------- | ----------------------------------- |
| 撤销                  | `Ctrl + Z`                        |
| 重做                  | `Ctrl + Shift + Z` / `Ctrl + Y` |
| 复制 / 粘贴选中模块   | `Ctrl + C` / `Ctrl + V`         |
| 复制选区并生成副本    | `Ctrl + D`                        |
| 将选区封装为 Subpatch | `Ctrl + G`                        |

</details>

<a id="modules"></a>

## 🧩 模块库

| 分类                 | 模块                                                               |
| -------------------- | ------------------------------------------------------------------ |
| **信号源**     | 简单振荡器 · 高级振荡器（复音 + ADSR）· 小号合成器 · 噪声发生器 |
| **输入**       | MIDI Clip · MIDI 输入器 · 键盘输入器                             |
| **音频处理**   | 多模式滤波器 · VCA 放大器 · 四通道混音器                         |
| **效果**       | 混响 · 回声延迟 · 三段均衡器 · 复古破碎                         |
| **调制与逻辑** | LFO · 数字输入 · 计算器 · 示波器                                |
| **输出**       | 扬声器 · 主限幅器 · 主录音机                                     |

选中模块后可在属性面板调整参数。完整注册表见 [`src/core/modules/index.ts`](src/core/modules/index.ts)。

<a id="agent"></a>

## 🤖 AI 合成助手

在聊天面板描述想要的声音，例如：

> 搭一个带 LFO 调制的锯齿波 Pad，接上滤波器和混响。

Agent 按需加载模块 Skill，再使用工具在影子画布中执行操作，将结果交给前端应用。

| 能力       | 工具                                                 |
| ---------- | ---------------------------------------------------- |
| 观察与诊断 | `canvas_inspect`、`canvas_diagnose`              |
| 模块管理   | `module_add`、`module_update`、`module_delete` |
| 信号连接   | `connection_connect`、`connection_disconnect`    |
| 诊断修复   | `canvas_apply_diagnostic_fix`                      |
| 知识检索   | `knowledge_search`                                 |
| 模块指南   | `skill_list`、`skill_load`                       |

支持 ModelScope、DeepSeek、OpenAI、Anthropic、Google Gemini、OpenRouter 和自定义 OpenAI 兼容端点。

- **匿名使用**：固定供应商使用本次请求携带的 API Key，密钥不落库；检查点保存在服务端内存中，最长保留 30 分钟，服务重启后失效。
- **登录使用**：可将 API Key 加密保存在服务端，对话检查点持久化到数据库。自定义端点和知识检索需要登录。
- **审批恢复**：检查点保存影子画布、待执行操作和已加载 Skills，批准后从保存的执行状态继续。

<a id="architecture"></a>

## 🏗️ 声音背后的架构

```mermaid
flowchart LR
  Canvas["React Flow 画布"] <--> Store["Zustand 文档与历史"]
  Store --> Reconciler["音频图调和器"] --> Runtime["AudioGraphRuntime"]
  Runtime --> Audio["Tone.js / Web Audio"]
  Runtime -. "结构快照与端口遥测" .-> Canvas
  Store <-->|"快照与操作批次"| Actions["Server Actions"]
  Actions --> Agent["LangGraph · Tools · Skills"]
  Actions <-->|"项目与修订号"| DB[("PostgreSQL")]
  Agent <-->|"检查点与 RAG"| DB
```

画布只保存可序列化数据。调和器将文档变化转换为最小音频补丁，运行时统一管理 Tone.js 和 Web Audio 对象。拖动、选择节点不会重建音频链。

Transport 是项目级时钟。音符和循环在音频时钟上调度，播放头读取补偿输出延迟后的可听位置。Agent 在服务端操作影子画布，前端通过同一套 Store 应用结果，并检查请求期间画布是否已经变化。

| 层           | 技术                                                                |
| ------------ | ------------------------------------------------------------------- |
| 工作台       | Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui |
| 画布与状态   | React Flow · Zustand                                               |
| 音频与 MIDI  | Tone.js · Web Audio · RxJS · WebMidi                             |
| AI           | LangChain · LangGraph · 模块 Skills                               |
| 数据与认证   | PostgreSQL · pgvector · Drizzle ORM · NextAuth.js / GitHub OAuth |
| 国际化与测试 | next-intl（中文 / English）· Vitest · Playwright                  |

<a id="development"></a>

## 🛠️ 开发与验证

| 命令                                                       | 作用                       |
| ---------------------------------------------------------- | -------------------------- |
| `npm run dev`                                            | 启动开发服务器             |
| `npm run build` / `npm run start`                      | 生产构建与启动             |
| `npm run typecheck`                                      | TypeScript 类型检查        |
| `npm run lint` / `npm run format`                      | 检查 / 格式化代码          |
| `npm run test`                                           | Vitest 单元与集成测试      |
| `npm run test:e2e`                                       | Playwright 浏览器测试      |
| `npm run agent:bench`                                    | 在线 Agent Golden Set 评测 |
| `npm run drizzle:generate` / `npm run drizzle:migrate` | 生成 / 执行数据库迁移      |
| `npm run drizzle:check`                                  | 只读检查数据库兼容性       |
| `npm run db:seed:examples:validate`                      | 校验内置示例               |

<details>
<summary><strong>🧪 质量检查与生产预览</strong></summary>

```bash
npm run typecheck
npm run lint
npm run test
npm run db:seed:examples:validate
npm run build
npx playwright install chromium
npm run test:e2e
```

端到端测试默认启动开发服务器。测试生产构建时，先构建，再设置 `E2E_PRODUCTION=1` 运行测试；PowerShell 使用 `$env:E2E_PRODUCTION='1'`。本机安装 Chrome 时，也可设置 `E2E_BROWSER_CHANNEL=chrome`。

部署前对目标数据库执行 `npm run drizzle:check`，按需要运行迁移。生产环境设置实际站点的 `NEXTAUTH_URL`，同时更新 GitHub OAuth 回调地址。当前验证结果和未完成项见 [已知问题](docs/KNOWN_ISSUES.md)。

</details>

<details>
<summary><strong>🤖 Agent Golden Set</strong></summary>

评测按工具轨迹、参数、客户端操作和审批行为进行确定性评分。数据集见 [`golden-set.json`](src/agent/evals/golden-set.json)，评分器见 [`scorer.ts`](src/agent/evals/scorer.ts)。在线目标运行真实 Agent 流程，禁用数据库知识搜索。

在 `.env.local` 设置 `AGENT_EVAL_API_KEY`，可选设置 `AGENT_EVAL_PROVIDER`、`AGENT_EVAL_MODEL` 和 `AGENT_EVAL_REPETITIONS`，再运行 `npm run agent:bench`。在线评测会调用模型服务，默认报告输出到 `artifacts/agent-evals/latest.json`。

</details>

## 🙏 致谢

感谢 [Tone.js](https://tonejs.github.io/)、[React Flow](https://reactflow.dev/)、[LangChain](https://www.langchain.com/) 和 [shadcn/ui](https://ui.shadcn.com/) 等开源项目。

最后非常感谢陪伴我的 ChatGPT Codex、Claude 3.5 / 3.7 / 4 以及 Gemini 3！
