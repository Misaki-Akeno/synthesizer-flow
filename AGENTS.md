# Synthesizer Flow - AI Agent Guide

## Project Overview

Synthesizer Flow (合成器流) is a modular synthesizer web application that allows users to build custom audio workflows by connecting different audio modules through a visual node-based interface. Users can create sounds by connecting modules like oscillators, modulators, mixers, and speakers using virtual cables.

**Key Features:**

- Visual node-based editor for audio module connections (powered by React Flow)
- Real-time audio synthesis using Tone.js and Web Audio API
- Reactive programming with RxJS for signal flow between modules
- AI Agent integration using LangChain and Model Context Protocol (MCP)
- RAG (Retrieval-Augmented Generation) system for audio knowledge base
- Multi-language support (English and Chinese)
- User authentication and project persistence

## Technology Stack

### Frontend

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4, Shadcn UI (Radix UI components)
- **State Management**: Zustand
- **Visual Flow**: React Flow (@xyflow/react) for node-based editing
- **Icons**: Lucide React

### Audio Engine

- **Audio Processing**: Tone.js + Web Audio API
- **Reactive Programming**: RxJS for inter-module signal flow
- **MIDI Support**: WebMidi API

### AI & LLM Integration

- **Agent Framework**: LangChain with LangGraph
- **Protocol**: Model Context Protocol (MCP) for LLM-to-App communication
- **Orchestration**: Vercel AI SDK
- **Embeddings**: OpenAI Embeddings with pgvector for RAG

### Backend & Database

- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth.js (Auth.js) with GitHub OAuth
- **Vector Search**: pgvector extension for RAG documents

### Testing & Tooling

- **Testing**: Vitest with jsdom, React Testing Library
- **Linting**: ESLint with Next.js config
- **Formatting**: Prettier
- **Type Safety**: TypeScript strict mode

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── [locale]/          # i18n routing (en-US, zh-CN)
│   │   ├── [[...projectId]]/  # Main synthesizer canvas page
│   │   ├── auth/login/     # Authentication pages
│   │   └── layout.tsx      # Root layout with providers
│   ├── api/               # API Routes
│   │   ├── auth/[...nextauth]/  # NextAuth.js endpoint
│   │   ├── rag/ingest/     # RAG document ingestion
│   │   └── rag/search/     # RAG vector search
│   └── globals.css        # Global styles + Tailwind v4
├── components/
│   ├── audioControls/     # Audio module UI controls
│   ├── layout/            # Layout components (Sidebar, Header)
│   ├── providers/         # Context providers
│   ├── ui/shadcn/         # Shadcn UI components
│   └── workbench/         # Main workbench components
│       ├── panels/        # Side panels (ModuleBrowser, LLM Chat, DevTools)
│       └── contextMenu/   # Right-click context menus
├── core/                  # Core audio engine
│   ├── base/              # Base classes (ModuleBase, AudioModuleBase)
│   ├── modules/           # Audio module implementations
│   │   ├── audio/         # Audio processing modules (Oscillator, Reverb, etc.)
│   │   ├── input/         # Input modules (MIDI, Keyboard, Sequencer)
│   │   ├── logic/         # Utility modules (Calculator, Oscilloscope)
│   │   └── modulation/    # Modulation modules (LFO)
│   ├── services/          # Core services (ModuleManager, SerializationManager)
│   ├── types/             # TypeScript types for serialization
│   └── hooks/             # React hooks for module subscriptions
├── agent/                 # AI Agent system
│   ├── core/              # Agent core (Agent.ts, types.ts)
│   ├── graph/             # LangGraph workflow
│   ├── tools/             # Capability-grouped Agent tools
│   ├── skills/            # Module guides + runtime schema discovery
│   ├── evals/             # Golden Set schema, scorer, runner, live bench
│   ├── prompts/           # System prompts
│   └── drizzleCheckpointer.ts  # State persistence
├── db/                    # Database layer
│   ├── schema.ts          # Drizzle ORM schema
│   ├── client.ts          # Database client
│   └── migrations/        # Database migrations
├── lib/                   # Utility libraries
│   ├── auth/              # Authentication configuration
│   ├── rag/               # RAG system (embeddings, vector store)
│   ├── logger.ts          # Logging utility
│   └── utils.ts           # General utilities
├── store/                 # Zustand stores
│   ├── canvas-store.ts    # Flow canvas state
│   ├── projects-store.ts  # Project management
│   └── settings-store.ts  # User settings
└── i18n/                  # Internationalization
    ├── routing.ts         # i18n routing config
    └── request.ts         # i18n request handler
```

## Build and Development Commands

```bash
# Development (uses Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Linting
npm run lint

# Code formatting
npm run format

# Testing
npm run test              # Run tests once
npm run test:watch        # Watch mode
npm run test:ui           # UI mode
npm run test:coverage     # With coverage report

# Database migrations
npm run drizzle:generate  # Generate migration files
npm run drizzle:migrate   # Run pending migrations
```

## Module System Architecture

### Declarative Audio Graph

The canvas and audio engine are separated by a React Native/Fabric-inspired
reconciliation boundary:

- `src/core/graph/`: pure `AudioGraphDocument`, module definitions, typed graph
  patches, and the side-effect-free graph reconciler
- `src/core/runtime/AudioGraphController.ts`: owns the last committed graph and
  submits minimal patches
- `src/core/runtime/AudioGraphRuntime.ts`: the only UI-facing service allowed to
  own `ModuleBase`, Tone.js, or Web Audio objects
- `src/core/hooks/useRuntimeModule.ts`: exposes throttled, serializable runtime
  snapshots through `useSyncExternalStore`

React Flow nodes must contain only serializable declaration data (`type`,
`label`, `parameters`, and `enabled`). Never put a `ModuleBase`, AudioNode,
BehaviorSubject, or callback in `node.data`. UI actions must go through
`invokeModuleAction`, and graph mutations must go through the canvas store so
the document, history, and runtime remain consistent.

Agent shadow graphs and Skills must read `ModuleDefinitionRegistry`; they must
not instantiate or retain module runtime objects. The registry contains the
shared parameter and port schema used for UI, validation, Agent tools, and
Skills.

Visual-only changes such as selection and position do not submit audio patches.
Parameter changes should reconcile to one `setParameter` patch; topology changes
should reconcile to the smallest ordered disconnect/create/update/connect patch
set.

### Base Classes

**ModuleBase** (`src/core/base/ModuleBase.ts`):

- Abstract base class for all modules
- Manages parameters, input/output ports using RxJS BehaviorSubject
- Supports three port types: `NUMBER` (blue), `AUDIO` (green), `ARRAY` (purple)
- Handles port connections and reactive data flow
- Parameter types: `number`, `boolean`, `list`, `string`

**AudioModuleBase** (`src/core/base/AudioModuleBase.ts`):

- Extends ModuleBase for audio processing modules
- Manages Tone.js initialization lifecycle
- Provides fade/smooth parameter ramps to avoid audio clicks
- Handles audio context management and resource disposal

### Creating a New Module

1. Create a new file in the appropriate category folder under `src/core/modules/`
2. Extend either `ModuleBase` (for logic modules) or `AudioModuleBase` (for audio modules)
3. Define static `metadata` property with module info
4. Implement required methods (`setupInternalBindings`, `initializeAudio` for audio modules)
5. Register in `src/core/modules/index.ts` `moduleClassMap`

Example structure:

```typescript
export class MyModule extends AudioModuleBase {
  static metadata: ModuleMetadata = {
    type: 'mymodule',
    label: 'My Module',
    description: 'Description of what this module does',
    category: 'audio',
  };

  protected async initializeAudio(): Promise<void> {
    // Initialize Tone.js nodes
  }

  protected setupInternalBindings(): void {
    // Set up reactive bindings between ports and parameters
  }
}
```

## Code Style Guidelines

### TypeScript

- Strict mode enabled
- Use explicit return types for public methods
- Prefer interfaces over type aliases for object shapes
- Use `unknown` over `any` when type is truly unknown

### Naming Conventions

- Components: PascalCase (e.g., `ModuleButton.tsx`)
- Hooks: camelCase starting with `use` (e.g., `useContextMenu.ts`)
- Utilities: camelCase (e.g., `serializationManager.ts`)
- Types/Interfaces: PascalCase (e.g., `ModuleMetadata`)
- Constants: UPPER_SNAKE_CASE for true constants

### File Organization

- One component per file (generally)
- Co-locate related components in feature folders
- Use barrel exports (`index.ts`) for clean imports

### Comments

- Primary documentation language: **Chinese (中文)**
- Use JSDoc for public API documentation
- Inline comments for complex logic

### ESLint Rules

- `@typescript-eslint/no-unused-vars` configured to ignore `_` prefixed variables
- Next.js core web vitals and TypeScript rules enforced
- Prettier integration for consistent formatting

## Testing Strategy

### Test Setup

- **Framework**: Vitest with jsdom environment
- **React Testing**: @testing-library/react, @testing-library/jest-dom
- **Configuration**: `vitest.config.ts`, `vitest.setup.ts`

### Mocking

- Tone.js is mocked in `vitest.setup.ts` to avoid audio context issues in tests
- Web Audio API is also mocked

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Component Name', () => {
  it('should render correctly', () => {
    render(<Component />);
    expect(screen.getByText('expected')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Debug specific test file
npx vitest run src/path/to/file.test.ts
```

## State Management

### Zustand Stores

**useFlowStore** (`src/store/canvas-store.ts`):

- Owns the pure, serializable React Flow graph document and history
- Handles module creation, deletion, parameter updates through typed commands
- Reconciles document changes into the audio runtime without storing live module
  instances
- Provides pure-data serialization/deserialization methods

**useProjectsStore** (`src/store/projects-store.ts`):

- Manages project list and current project
- Handles saving/loading from database

**useSettingsStore** (`src/store/settings-store.ts`):

- User preferences and AI settings
- UI theme settings

## Database Schema

### Tables

- **users**: User accounts with RBAC roles
- **accounts**: OAuth provider accounts (GitHub)
- **sessions**: NextAuth.js sessions
- **verification_tokens**: Email verification tokens
- **projects**: Saved synthesizer projects with versioned JSON data, optimistic revisions, extensible metadata, and soft archiving
- **users_to_projects**: Many-to-many user-project associations with roles, metadata, and audit timestamps
- **rag_documents**: Namespaced vector documents with source and content-hash tracking
- **checkpoints**: Versioned Agent conversation checkpoints with extensible metadata
- **langgraph_checkpoints/langgraph_writes**: LangGraph state persistence

### Migrations

- Use Drizzle Kit for migration management
- Migrations stored in `src/db/migrations/`
- Run `npm run drizzle:generate` after schema changes
- Prefer evolving `projects.data`, `projects.metadata`, and checkpoint metadata through their schema-version fields before adding feature-specific columns

## AI Agent System

### Architecture

- **Agent.ts**: Singleton agent instance managing LLM interactions
- **Provider Registry**: `src/lib/ai/providers.ts` defines supported providers, endpoints, and curated models
- **Model Factory**: `src/lib/ai/modelFactory.ts` creates provider-specific LangChain models behind `BaseChatModel`
- **Provider Settings**: Versioned per-provider profiles are stored in the existing `users.settings` JSON field; no dedicated provider table is required
- **LangGraph Workflow**: Multi-step agent workflow with registry-driven approval routing
- **Tool Registry**: Tools are grouped into inspection, modules, connections, knowledge, and skills capabilities
- **Agent Skills**: Module guides combine curated usage advice with parameter and port schemas extracted from real module classes
- **Agent Evals**: Golden Set benchmarks score tool traces, arguments, client operations, approvals, and response constraints
- **Checkpointer**: Database-backed state persistence for conversations

### Tool System

`src/agent/tools/definitions.ts` assembles capability groups under `src/agent/tools/groups/`; `ToolExecutor` runs canvas operations against an in-memory shadow state. The public tool protocol is:

- `canvas_inspect`: inspect the full canvas or one module
- `module_add`, `module_update`, `module_delete`: module lifecycle and parameters
- `connection_connect`, `connection_disconnect`: typed port connections
- `knowledge_search`: RAG-backed conceptual and documentation search
- `skill_list`, `skill_load`: discover and load module-specific guides

Destructive approval policy belongs to the tool registry, not the LangGraph workflow. Keep legacy tool aliases execution-only so older checkpoints can resume without exposing deprecated names to new models.

### Agent Skills

- Add curated module advice in `src/agent/skills/module-guides.ts`
- Keep parameter defaults, constraints, and ports in module classes; Skills extract them at load time to avoid schema drift
- Use lightweight `skill_list` summaries for discovery and `skill_load` for progressive disclosure
- `module_add` requires the corresponding `module:<type>` Skill to be loaded in the current request

### Agent Evals

- Keep the versioned Golden Set in `src/agent/evals/golden-set.json`
- Validate all datasets through `parseGoldenSet`; duplicate ids and cases without measurable criteria are invalid
- Use deterministic criteria in `scorer.ts`; do not add LLM-as-judge behavior to the core quality gate
- Run live benchmarks with `npm run agent:bench`; configure them through `AGENT_EVAL_*` environment variables
- The live target uses the production Graph, Prompt, Skills, and Tools, but replaces Drizzle checkpoints with `MemorySaver` and disables database-backed knowledge search
- Reports are written to `artifacts/agent-evals/latest.json`, which must remain untracked

### MCP (Model Context Protocol)

- Custom MCP server implementation
- Allows external LLM clients to interact with the synthesizer
- Located in `src/app/api/mcp/`

## RAG System

### Components

- **markdownSplitter.ts**: Document chunking
- **openaiEmbedder.ts**: Text embedding generation
- **vectorStore.ts**: Vector similarity search

### Usage

1. Ingest documents via `/api/rag/ingest` endpoint
2. Search via `/api/rag/search` endpoint
3. Agent automatically queries RAG for audio synthesis knowledge

## Internationalization

- Supported locales: `en-US`, `zh-CN`
- Default locale: `zh-CN`
- Uses `next-intl` for i18n
- Messages stored in `messages/` directory (en-US.json, zh-CN.json)

## Environment Variables

Required in `.env.local`:

```
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your_secret
GITHUB_ID=your_github_app_id
GITHUB_SECRET=your_github_app_secret
RAG_EMBEDDINGS_BASE_URL=https://...
RAG_EMBEDDINGS_MODEL=text-embedding-v4
RAG_EMBEDDINGS_API_KEY=your_key
RAG_EMBEDDINGS_DIM=1024
```

## Security Considerations

1. **Authentication**: NextAuth.js with secure session handling
2. **RBAC**: Role-based access control (admin/user roles)
3. **Database**: Parameterized queries via Drizzle ORM
4. **CORS**: Configure appropriately for production
5. **Environment Variables**: Never commit `.env.local`
6. **Audio Context**: Requires user interaction to start (browser policy)

## Common Issues & Solutions

### Audio Context

- Browsers require user interaction before audio context can start
- Tone.js initialization is deferred until first user click

### Module Initialization

- Audio modules use `ModuleInitManager` to track initialization state
- Connections are deferred until all modules are initialized

### Hot Module Replacement

- Some audio modules may not clean up properly during HMR
- Refresh page if audio behaves unexpectedly during development

## Deployment

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Configure environment variables
3. Deploy with default Next.js settings

### Database

- Uses PostgreSQL (compatible with Neon, Supabase, etc.)
- Run migrations before first deployment
- Ensure pgvector extension is enabled

## Contributing Guidelines

1. Follow existing code style and naming conventions
2. Add tests for new features
3. Update this AGENTS.md when changing architecture
4. Ensure TypeScript strict mode compliance
5. Test audio functionality in both development and production builds
