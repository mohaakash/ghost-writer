# Development Roadmap

## Phase 0 — Foundation

Goal: establish repository quality before product features.

Tasks:

- initialize Tauri 2 + React + TypeScript
- configure pnpm
- configure ESLint/Prettier
- configure rustfmt/Clippy
- establish Rust module boundaries
- add logging
- add SQLite migrations
- set up CI for Windows and Linux

Deliverable:

A window that builds and runs correctly on both platforms.

## Phase 1 — Launcher Shell

Goal: make the application feel like a launcher.

Tasks:

- frameless launcher window
- global keyboard shortcut
- show/hide/focus behavior
- close on Escape
- hide on focus loss if desired
- keyboard navigation
- result row component
- basic theming

Deliverable:

A launcher UI with mocked results.

## Phase 2 — Application Search

Goal: launch installed applications.

Tasks:

- define `ApplicationEntry`
- Linux `.desktop` discovery
- Windows app discovery
- application cache
- fuzzy/prefix matching
- native launching
- app icons

Deliverable:

Type application name → launch application.

## Phase 3 — File/Folder Indexer

Goal: build reliable local metadata indexing.

Tasks:

- configurable roots
- recursive scanner
- default ignore rules
- metadata extraction
- SQLite item repository
- FTS table
- index progress events
- rebuild index

Deliverable:

Search indexed files and folders.

## Phase 4 — Incremental Watcher

Goal: keep the index fresh without rescanning everything.

Tasks:

- filesystem watcher
- event normalization
- debounce/coalescing
- rename handling
- delete handling
- batched database writes

Deliverable:

New/renamed/deleted files appear correctly without manual rebuild.

## Phase 5 — Ranking Quality

Goal: make results feel intelligent.

Tasks:

- exact/prefix/fuzzy signals
- result type weighting
- usage events
- recency model
- frequency model
- pinned items
- ranking diagnostics

Deliverable:

Frequently selected items naturally rise in results.

## Phase 6 — Actions

Goal: make search results actionable.

Tasks:

- open
- reveal in folder
- copy path
- open containing terminal
- action menu
- keyboard shortcuts for secondary actions

Deliverable:

A useful daily-driver launcher.

## Phase 7 — Settings and Reliability

Goal: production readiness.

Tasks:

- index root settings
- exclusions
- startup behavior
- shortcut customization
- clear history
- clear/rebuild index
- crash-safe database handling
- recovery from corrupted entries

Deliverable:

First beta release.

## Phase 8 — Built-In Providers

Add selectively:

- calculator
- commands
- clipboard history
- browser bookmarks
- system settings
- aliases

## Phase 9 — Plugin Foundation

Goal: external extensibility.

Tasks:

- stable plugin result API
- manifest format
- sandbox/runtime decision
- permissions
- timeout model
- plugin settings

## Phase 10 — Advanced Intelligence

Only after the conventional launcher is strong:

- natural-language actions
- semantic local search
- AI commands
- content summarization
- workflow chaining

## Suggested MVP Definition

A sensible first public MVP is reached after Phase 7.

Do not wait for plugins or AI before releasing. Search quality, speed, reliability, and native behavior are the core product.
