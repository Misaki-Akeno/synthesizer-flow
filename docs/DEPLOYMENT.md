# Synthesizer Flow 部署运行手册

本文档用于发布前检查、Drizzle 迁移和 Vercel 部署验证。数据库迁移会改变远程状态，执行前必须确认目标环境并保留恢复点。

## 1. 发布前质量门禁

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

仓库的 GitHub Actions 会在 Pull Request，以及 `development`、`main` 分支推送时执行同一组检查。

## 2. 只读数据库预检

确认 `.env.local` 中的 `DATABASE_URL` 指向目标 Neon 环境，然后运行：

```bash
npm run drizzle:check
```

该命令只读取：

- PostgreSQL 版本
- Drizzle 迁移记录
- `projects` 表的必需字段
- pgvector 扩展版本
- 用户、项目、RAG 文档和 Agent 检查点的行数概览（不读取具体内容）

如果迁移落后，命令会返回非零退出码，不会自动修改数据库。

## 3. 执行迁移

1. 在 Neon 确认项目、分支和数据库名称。
2. 为当前数据库创建可恢复分支或快照。
3. 再次核对 `DATABASE_URL`，避免把开发迁移应用到错误环境。
4. 执行迁移：

```bash
npm run drizzle:migrate
```

5. 重新运行只读检查：

```bash
npm run drizzle:check
```

当前 `0007_tricky_wrecker` 会同时更新 projects、checkpoints、LangGraph、RAG、users 和 users_to_projects 等表。不要把它当作仅增加项目描述字段的小迁移。

## 4. 迁移后冒烟验证

至少验证以下路径：

- 项目管理器能返回个人项目和内置预设
- 新项目可以保存、重命名、重新加载和软删除
- 旧项目 JSON 可以正常反序列化
- Agent Checkpoint 可以创建和恢复
- RAG 搜索仍能返回已有文档
- 项目管理器不再显示“云端项目服务需要更新”

### 示例工程数据

先预览目标数据库和即将写入的固定示例：

```bash
npm run db:seed:examples
```

确认输出中的 Neon 主机与数据库名称无误后，再显式写入：

```bash
npm run db:seed:examples -- --apply
```

脚本只 upsert `preset-signal-math-lab-v1` 和 `preset-space-oscillator-v1`，不会删除或复制用户数据；内容没有变化时重复执行不会增加 revision。迁移与示例数据同步应保持为两个独立步骤，避免每次部署覆盖运营数据。

## 5. Vercel 部署核对

在 Vercel 中确认：

- Production / Preview 使用了预期的 Git 分支和提交
- `DATABASE_URL` 指向已经完成迁移的数据库分支
- `NEXTAUTH_URL` 是当前部署域名
- GitHub OAuth 回调地址包含当前部署域名
- RAG Embedding 的模型、维度、Base URL 和密钥互相匹配

部署完成后再次执行项目读取、登录、Agent 和 RAG 冒烟验证。

### Neon 分支隔离建议

不要让 Vercel 的 Production、Preview 和 Development 长期共用同一个 `DATABASE_URL`：

- Production 指向 Neon `main`，只在 main 分支的 Production Deployment 中执行迁移。
- development 分支的 Preview 指向独立的 Neon `dev` 分支。
- 本地 `.env.local` 指向独立的 Neon `localdev` 分支。

不要为了同步内置示例而复制整个 main 数据库；这会同时复制用户、Session、Agent Checkpoint 和 RAG 数据。内置预设由 `db:seed:examples` 独立同步。只有在确认目标分支没有需要保留的测试数据时，才使用 Neon 的 branch reset/restore 功能重建非生产分支。

当前 Vercel Build Command 为：

```bash
npm run drizzle:migrate && next build
```

合并 main 前应先确认 Production 的数据库恢复点；Production Deployment 会先迁移再构建，迁移失败必须阻止发布。

## 6. 失败处理

- 应用部署失败：保留数据库迁移，回退应用到与新 schema 兼容的上一个提交，修复后向前发布。
- 迁移失败：停止部署，不要重复手工执行部分 SQL；先检查 Drizzle 迁移记录和 Neon 恢复点。
- 数据异常：切回迁移前的 Neon 分支或快照，再用向前迁移修复。不要在生产库直接删除新字段来“回滚”。
