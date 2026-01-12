# 面试复习：Synthesizer Flow 技术架构 (Deep Dive Edition)

*注意：本版文档采用**高阶架构术语**重新包装现有代码逻辑。在面试中，使用这些术语能显著提升你的专业度，但请务必理解其背后的实质。*

## 1. 架构核心逻辑 (Core Architectural Logic)

### A. 状态管理策略：Stateless Serverless Pattern (无状态 Serverless 模式)

*   **设计现状**:
    *   我们摒弃了传统的服务端 Session 或 sticky connection，而是采用了 **Frontend-as-Source-of-Truth (前端即真理)** 的策略。
    *   **State Rehydration (状态注水)**: 每次 Server Action 请求，前端都会将完整的 `Message[]` 序列化传输给后端。LangGraph 在运行时动态根据上下文及其“临时记忆”重建（Rehydrate）Agent 的 Cognitive State (认知状态)。
*   **架构权衡 (Trade-off)**:
    *   *Pros (利)*: 完美适配 Next.js 的 **Edge/Serverless 架构**，无冷启动状态丢失问题，无需维护复杂的 Redis/Postgres 会话锁，水平扩展能力 (Scalability) 极强。
    *   *Cons (弊)*: 网络带宽开销随对话长度线性增长（Context Window 膨胀）。
    *   *应对方案*: 未来可引入 **Summary Memory** 机制，对早期的对话历史进行语义摘要，压缩 Context Payload。

### B. 知识检索架构：Naive RAG Baseline vs. Advanced Pipeline

*   **当前实现 (Baseline)**:
    *   我们目前部署的是 **Naive RAG (朴素 RAG)** 架构作为 Baseline。
    *   **Retrieval Strategy**: 单路召回 (Single-stage Retrieval)，基于 `text-embedding-3-small` 的稠密向量检索 (Dense Retrieval)。
    *   **Indexing**: 依赖 `pgvector` 的 **HNSW (Hierarchical Navigable Small World)** 算法实现近似最近邻搜索 (ANN)，以换取毫秒级的查询响应。
*   **技术债与演进 (Optimization Path)**:
    *   目前的 **Fixed-size Window Chunking (固定窗口切片)** 可能会切断语义连贯性 (Semantic Integrity)。
    *   **演进方向**: 计划引入 **Hybrid Search (混合检索)**，结合 `BM25` (关键词稀疏检索) 和 Vector Search，并加入 **Rerank (重排序)** 模型来解决 "Lost in the Middle" 现象。

### C. 修正后的 Mermaid 架构图 (Logical View)

```mermaid
graph LR
    subgraph Client [Client-Side (State Holder)]
        UI[React View Layer] 
        Store[Zustand: Single Source of Truth]
        Audio[Audio Context/Tone.js]
    end

    subgraph Server [Serverless Runtime]
        Action[BFF: Server Action Aggregator]
        Agent[LangGraph: Reasoning Engine]
        Tools[Tool Executor: Side-effect Isolation]
    end

    subgraph Data [Persistence Layer]
        PG[(Postgres: Relational Metadata)]
        Vector[(pgvector: Semantic Index)]
    end

    %% Data Flow
    User((User)) --> UI
    UI --> |1. Hydrate Context| Action
    Action --> Agent
    Agent -- ReAct Loop --> Tools
    Tools -.-> |ANN Search| Vector
    Tools --> |Abstract Cmds| Agent
    Agent --> |2. Dehydrated Response| Action
    Action --> |3. Command Stream| UI
    UI --> |4. Event Sourcing| Store
    Store --> |5. Signal Proc| Audio
```

---

## 2. 核心机制深挖 (Mechanism Deep Dive)

### A. 通信协议：Server-Driven UI (SDUI) 与 Command Pattern

这是本项目的**架构高光点 (Architectural Highlight)**。

*   **挑战**: 如何在无状态的 LLM (Reasoning Engine) 和 有状态的浏览器 AudioContext (Runtime Environment) 之间建立安全的控制链路？
*   **解决方案**: **Command Query Responsibility Segregation (CQRS) 思想的变体**。
    1.  **Command Generation (指令生成)**:
        *   LLM 不直接操作硬件/音频流。它的输出被严格约束为**抽象指令集 (Abstract Command Set)**，即 `ClientOperation`。
        *   这本质上是一种 **Remote Procedure Call (RPC) over JSON**。
    2.  **Deferred Execution (延迟执行/惰性求值)**:
        *   服务端 `ToolExecutor` 充当 **Simulator (模拟器)**。它只在内存中修改虚拟图数据结构，并产生一个 `Operation Queue`。
        *   真实的 Side Effect (副作用，即产生声音) 被推迟到响应返回前端的那一刻。
    3.  **Atomic Replay (原子回放)**:
        *   前端接收到 `clientOperations` payload 后，视为一个原子事务进行回放，确保 UI 状态与音频引擎状态的 **最终一致性 (Eventual Consistency)**。

### B. 数据存储设计 (Schema Design Philosophy)

*   **Vector OLTP**:
    *   我们在同一个 Postgres 实例中混合了关系型数据 (`users`, `sessions`) 和向量数据 (`rag_documents`)。
    *   **优势**: 避免了 Polyglot Persistence (多语言持久化) 带来的维护成本和数据一致性噩梦（比如删除文档时需要同步删除向量库）。利用 PG 的 **ACID 事务特性** 保证了知识库元数据与向量索引的一致性。

### C. 检索增强生成 (RAG) 细节

1.  **ETL Pipeline**:
    *   Extract: 解析 Markdown/PDF AST。
    *   Transform: **Normalization (归一化)** 处理，去除 Markdown 噪声。
    *   Chunk: **Token-based Hard Window** (当前策略，3000 chars)。使用 `cl100k_base` tokenizer 近似估算长度。
2.  **Embedding**:
    *   Model: `text-embedding-3-small` (1536维)。
    *   Distance Metric: **Cosine Distance (余弦距离)**，公式 `1 - (A · B) / (||A|| ||B||)`。在高维空间中，余弦距离比欧氏距离更能反映语义相似性。

### D. LangGraph 实现细节

*   **代码位置**: `src/agent/graph/workflow.ts`
*   **结构**: `START -> Agent -> Tools -> Agent -> END`
*   **无 Checkpointer**: 状态完全依赖前端传来的 `messages` 列表。

---

## 3. 面试模拟问答 (Q&A Simulation)

**Q: 为什么不用前端直接调 OpenAI?**
A: 
1.  **Key 安全**: 必须隐藏在服务端。
2.  **业务逻辑**: RAG 访问数据库、复杂的工具执行逻辑放在服务端更安全。

**Q: 怎么解决 LLM 不懂合成器参数的问题？**
A: 使用 **Zod Schema** 强类型定义 Tool，并在 System Prompt 中详细描述功能。

**Q: RAG 检索太慢怎么办？**
A: 我在 `embedding` 列使用了 **HNSW 索引**，牺牲少量写入速度换取极快的向量检索速度。
