# Repository Structure

## 1. Recommended Layout

```text
project-root/
├── README.md
├── docs/
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── app/
│   ├── components/
│   │   ├── launcher/
│   │   ├── results/
│   │   └── settings/
│   ├── hooks/
│   ├── lib/
│   │   ├── tauri.ts
│   │   └── keyboard.ts
│   ├── stores/
│   ├── styles/
│   └── types/
│
└── src-tauri/
    ├── Cargo.toml
    ├── migrations/
    └── src/
        ├── main.rs
        ├── lib.rs
        │
        ├── app/
        │   ├── search_coordinator.rs
        │   ├── action_coordinator.rs
        │   └── lifecycle.rs
        │
        ├── domain/
        │   ├── query.rs
        │   ├── result.rs
        │   ├── action.rs
        │   └── ranking.rs
        │
        ├── search/
        │   ├── engine.rs
        │   ├── normalizer.rs
        │   ├── scorer.rs
        │   └── ranking.rs
        │
        ├── providers/
        │   ├── mod.rs
        │   ├── applications.rs
        │   ├── files.rs
        │   ├── folders.rs
        │   └── commands.rs
        │
        ├── indexer/
        │   ├── scanner.rs
        │   ├── watcher.rs
        │   ├── metadata.rs
        │   ├── ignore_rules.rs
        │   └── writer.rs
        │
        ├── persistence/
        │   ├── database.rs
        │   ├── items_repository.rs
        │   ├── usage_repository.rs
        │   └── settings_repository.rs
        │
        ├── platform/
        │   ├── mod.rs
        │   ├── windows/
        │   │   ├── apps.rs
        │   │   ├── launch.rs
        │   │   └── shell.rs
        │   └── linux/
        │       ├── apps.rs
        │       ├── launch.rs
        │       └── desktop_entry.rs
        │
        ├── commands/
        │   ├── search.rs
        │   ├── actions.rs
        │   └── settings.rs
        │
        ├── config/
        ├── errors/
        └── telemetry/
```

## 2. Dependency Direction

Dependencies should mostly flow inward:

```text
React UI
   ↓
Tauri commands
   ↓
Application services
   ↓
Domain/search abstractions
   ↓
Repositories + providers + platform adapters
```

The domain layer should not import React/Tauri-specific types.

## 3. Frontend Type Boundaries

Create explicit serialized DTOs for IPC.

Example:

```ts
export interface SearchResultDto {
  id: string;
  title: string;
  subtitle?: string;
  kind: ResultKind;
  icon?: IconDescriptor;
  score?: number;
  actions: ResultActionDto[];
}
```

Do not expose arbitrary internal Rust database models directly to the frontend.

## 4. Rust Domain Models

Keep these independent of SQLite row structures where practical.

```text
SearchQuery
SearchResult
SearchCandidate
ResultAction
ApplicationEntry
IndexedItem
RankingSignals
```

## 5. Feature Flags

Consider Cargo features for platform/experimental functionality later.

Examples:

```text
clipboard
plugins
semantic-search
experimental-wayland
```

Do not overuse feature flags during the MVP.

## 6. Documentation Folder

Keep architecture decisions in the repository:

```text
docs/
├── architecture.md
├── tech-stack.md
├── search-indexing.md
├── platform-integration.md
├── security.md
├── performance.md
└── adr/
```

## 7. Architecture Decision Records

For important irreversible decisions, add ADRs.

Example:

```text
ADR-001-use-tauri.md
ADR-002-use-sqlite-fts5.md
ADR-003-platform-adapter-boundary.md
ADR-004-plugin-isolation-model.md
```

Each ADR should capture:

- context
- decision
- alternatives
- consequences

This will prevent future contributors from repeatedly reopening settled decisions without understanding why they were made.
