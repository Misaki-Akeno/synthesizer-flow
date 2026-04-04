---
config:
  layout: elk
---
graph LR
  classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
  classDef server fill:#fff3e0,stroke:#e65100,stroke-width:2px;
  classDef db fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px;
  classDef audio fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;

  subgraph C["Client (Browser)"]
    UI["UI: Canvas + Chat + Panels"]
    Store["Zustand Store (Flow/Project/Settings)"]
    Audio["Audio Engine (Tone.js/WebAudio)"]
    UI <--> Store
    Store <--> Audio
  end

  subgraph S["Server (Next.js + Agent)"]
    Actions["Server Actions"]
    Agent["LangGraph Agent"]
    Tools["Tools: Canvas / Module / Connect / RAG"]
    Actions --> Agent --> Tools
  end

  subgraph D["PostgreSQL + Drizzle"]
    Auth["Auth Data"]
    Projects["Project Data"]
    Memory["Agent Memory (Checkpoints)"]
    RAG["RAG Documents (Vector)"]
  end

  UI -->|"chat request + canvas snapshot"| Actions
  Actions -->|"client operations"| UI
  Store <-->|"load/save project"| Actions

  Actions <--> Auth
  Actions <--> Projects
  Agent <--> Memory
  Tools <--> RAG

  class UI,Store client
  class Audio audio
  class Actions,Agent,Tools server
  class Auth,Projects,Memory,RAG db
