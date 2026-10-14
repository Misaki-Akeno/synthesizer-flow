# 已知问题与后续修复

## 2026-10-14：development 合并前审查

- 审查版本：`development` / `0af39aa14b034d0a8246197d945910d0855eae4b`。
- 对比基线：`origin/main` / `e399fbfb5d0733d3df6f5f4bacba408601e0ae6f`，涉及 92 个文件。
- 处理决定：本次先记录以下问题，留待后续修复；不作为本次合并的功能阻断项。
- 本次记录不代表质量检查已全部通过。音频端到端测试仍有失败，若仓库要求该检查通过，合并仍受分支保护规则约束。

### 1. 音频端到端测试的选择器和节点显示条件

- 状态：待修复。
- 位置：`e2e/audio.spec.ts:120–130`。
- 复现：运行生产模式端到端测试，`getByLabel('导入项目 JSON')` 同时匹配文件输入框和按钮，触发 Playwright strict mode 错误。
- 补充验证：在临时测试副本中将选择器限定为文件输入框后，测试在点击“启动音频”时超时；Fit View 会触发精简节点显示，隐藏该按钮。
- 影响：音频测试未能执行完整的发声、释音和停止验证，端到端测试套件无法全部通过。这些失败本身不能证明音频功能异常。
- 修复方向：精确定位文件输入框，并在音频测试中固定完整节点显示档位。

### 2. 撤销 BPM 后音序器按旧速度重建

- 状态：待修复。
- 位置：`src/components/workbench/TransportBar.tsx:218–221`；`src/store/canvas-store.ts` 中的 `applyCanvasSnapshot`。
- 复现：播放音序器，将项目 BPM 从 120 改为 80，再撤销；界面恢复为 120，但重建 Tone.Part 时使用的 Transport BPM 仍为 80。
- 原因：恢复快照时先提交音频图，之后才通过 React effect 同步 BPM。Tone.Part 已按旧 BPM 将秒数换算成事件 tick，后续同步 BPM 不会重新计算这些事件位置。
- 影响：撤销速度修改后，声音节奏与界面 BPM、播放头可能不一致。
- 验证：临时回归用例记录到 Part 创建时 BPM 为 80，预期为 120。
- 修复方向：在恢复快照、重建音序器前同步目标 BPM，并覆盖撤销和重做场景。

### 3. 切换出去的本地草稿缺少重新打开入口

- 状态：待修复。
- 位置：`src/store/projects-store.ts` 中的 `saveLocalDraft`、`getAllProjects`；`src/components/workbench/panels/ProjectManager.tsx` 中的项目列表。
- 复现：新建项目并自动保存为本地草稿，然后切换到其他项目或预设。
- 原因：草稿保存在 `localDrafts`，项目列表和 `getAllProjects()` 只包含云端用户项目与内置预设。
- 影响：原草稿仍在本地存储中，但用户无法通过现有项目列表重新打开或导出它。
- 验证：临时回归用例确认切换成功后，原草稿仍在 `localDrafts`，却不在 `getAllProjects()` 返回结果中。
- 修复方向：在项目管理器中展示本地草稿，并提供打开、导出和清理入口。

### 4. 导入文件未保存上一项目的最新编辑

- 状态：待修复。
- 位置：`src/store/projects-store.ts:1098–1106`，`importProjectFromJson`。
- 复现：已有本地草稿，继续编辑后，在 800ms 自动保存等待期间导入另一个项目 JSON。
- 原因：导入直接替换画布和当前项目，没有像 `loadProject` 一样先保存上一项目的最新内容。
- 影响：上一草稿只保留较旧内容，尚未自动保存的编辑丢失；导入同时清空撤销历史。
- 验证：临时回归用例确认导入成功后，上一草稿中缺少导入前新增的节点。
- 修复方向：导入前保存当前草稿；保存失败时保留当前画布并终止导入。

### 本次验证结果

- `npm run typecheck`：通过。
- `npm run lint`：通过。
- `npm run test`：63 个测试文件、355 个测试通过。
- `npm run build`：通过。
- `E2E_PRODUCTION=1 E2E_BROWSER_CHANNEL=chrome npm run test:e2e`：6 个通过、1 个失败，失败项见问题 1。此命令中的环境变量写法适用于支持该语法的 shell；PowerShell 需先通过 `$env:` 设置。
- 另建的 3 个临时回归用例分别复现问题 2、3、4；这些用例及音频测试临时副本已删除，未纳入仓库测试套件。
- 审查未执行数据库迁移，也未修改产品代码。
