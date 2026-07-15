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

## 5. Vercel 部署核对

在 Vercel 中确认：

- Production / Preview 使用了预期的 Git 分支和提交
- `DATABASE_URL` 指向已经完成迁移的数据库分支
- `NEXTAUTH_URL` 是当前部署域名
- GitHub OAuth 回调地址包含当前部署域名
- RAG Embedding 的模型、维度、Base URL 和密钥互相匹配

部署完成后再次执行项目读取、登录、Agent 和 RAG 冒烟验证。

## 6. 失败处理

- 应用部署失败：保留数据库迁移，回退应用到与新 schema 兼容的上一个提交，修复后向前发布。
- 迁移失败：停止部署，不要重复手工执行部分 SQL；先检查 Drizzle 迁移记录和 Neon 恢复点。
- 数据异常：切回迁移前的 Neon 分支或快照，再用向前迁移修复。不要在生产库直接删除新字段来“回滚”。
