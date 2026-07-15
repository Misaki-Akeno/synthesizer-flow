# Agent Golden Set 评测

## 目标

Agent bench 用一组版本化的真实任务持续检查行为质量，而不是只验证函数能否运行。当前评测覆盖：

- 是否选择正确工具及调用顺序
- 工具参数是否包含关键字段
- 是否产生预期的画布 `ClientOperation`
- 删除、断开等操作是否正确进入 HIL 审批
- 回答是否包含或避开指定文本
- 多次运行的稳定性、平均得分和延迟

## 运行

在 `.env.local` 或当前 shell 中配置：

```bash
AGENT_EVAL_PROVIDER=modelscope
AGENT_EVAL_MODEL=Qwen/Qwen3.5-35B-A3B
AGENT_EVAL_API_KEY=your-token
AGENT_EVAL_REPETITIONS=3
```

然后运行：

```bash
npm run agent:bench
```

自定义 OpenAI 兼容服务还需要：

```bash
AGENT_EVAL_PROVIDER=custom
AGENT_EVAL_MODEL=your-model
AGENT_EVAL_API_ENDPOINT=https://example.com/v1
```

JSON 报告默认写入 `artifacts/agent-evals/latest.json`。可以用 `AGENT_EVAL_REPORT_PATH` 修改路径。API Key 不会进入报告。

## Golden Set 格式

数据集位于 `src/agent/evals/golden-set.json`，当前 schema 版本为 `1`。最小 case：

```json
{
  "id": "inspect-empty-canvas",
  "description": "检查空画布",
  "tags": ["inspection", "smoke"],
  "messages": [{ "role": "user", "content": "当前画布有什么？" }],
  "initialState": { "nodes": [], "edges": [] },
  "expected": {
    "tools": {
      "mode": "contains",
      "names": ["canvas_inspect"]
    },
    "approvalRequired": false
  },
  "threshold": 1,
  "minSamplePassRate": 1
}
```

工具匹配模式：

- `exact`：实际序列必须完全一致。
- `ordered`：期望工具必须按顺序出现，允许中间出现额外工具。
- `contains`：只要求包含全部期望工具，不限制顺序。

工具参数和客户端操作使用局部对象匹配，因此可断言关键字段，同时忽略运行时生成的 node id、位置等不稳定值。

## 评分与质量门槛

每个独立断言产生一个通过或失败结果，case 得分为通过断言数除以总断言数：

1. 单次得分达到 `threshold` 才算该 sample 通过。
2. sample 通过率达到 `minSamplePassRate` 才算该 case 通过。
3. 数据集的 `qualityGate.minCasePassRate` 和 `minAverageScore` 决定整个 bench 是否通过。
4. 未通过质量门槛时命令返回非零退出码，可直接作为 CI gate。

## 隔离策略

live bench 使用真实 Agent Graph、Prompt、Tools 和 Skills，但 checkpoint 存在内存中，知识检索也不会连接数据库。因此运行 bench 不需要执行迁移，也不会写入开发数据库。需要评测 RAG 时，应创建带固定测试语料的独立 target，避免把开发库状态引入 Golden Set。
