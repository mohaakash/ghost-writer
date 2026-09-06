# Tech Stack

## 1. Recommended Stack

### Desktop Framework

**Tauri 2**

Why:

- small application bundles compared with Electron
- native Rust backend
- uses system webview instead of bundling Chromium
- strong fit for tray applications and native OS integration
- built-in command/event bridge between frontend and backend
- suitable for low-memory applications that remain running all day

## 2. Frontend

### React + TypeScript

Recommended frontend stack:

```text
React
TypeScript
Vite
Tailwind CSS
Radix UI / shadcn-style primitives if needed
Lucide icons
```

React is appropriate because the UI is stateful but not large. The frontend should remain intentionally thin and should not contain search/indexing logic.

### Frontend responsibilities

- launcher window rendering
- input handling
- keyboard navigation
- displaying result groups
- displaying actions
- settings screens
- theming
- animations
- sending commands to Rust

### Frontend should NOT own

- filesystem crawling
- search database
- ranking logic
- application discovery
- shell command execution
- OS-specific APIs

## 3. Backend

### Rust

Rust should implement the application core.

Recommended crates/categories:

```text
tokio              async runtime
serde              serialization
serde_json         structured metadata
rusqlite/sqlx      SQLite access
notify             filesystem events
walkdir            recursive initial scans
ignore             gitignore-style filtering
fuzzy-matcher      optional early fuzzy matching
unicode-normalization
tracing            structured logs
thiserror / anyhow error handling
rayon               optional CPU parallelism
```

Exact crates can change as development progresses, but the architectural boundaries should remain stable.

## 4. Database

### SQLite

Use SQLite as the local index and metadata store.

Reasons:

- embedded
- zero server process
- mature
- transactional
- fast for local metadata
- available on Windows and Linux
- easy migrations
- excellent debugging tooling

### SQLite FTS5

Use FTS5 for searchable text such as:

- filename
- application name
- path
- aliases
- keywords

Do not use SQLite as a binary content store for entire files.

## 5. Search Strategy

Recommended search layers:

```text
Exact match
    ↓
Prefix match
    ↓
FTS candidate retrieval
    ↓
Fuzzy scoring
    ↓
Usage/history weighting
    ↓
Final ranked results
```

A specialized search engine can be introduced later if profiling proves SQLite insufficient.

## 6. Native Integrations

### Windows

Potential integrations:

- Win32 APIs
- Windows Shell
- Start Menu shortcut discovery
- packaged application discovery
- file associations
- ShellExecute/open APIs

Useful Rust ecosystems may include:

- `windows` crate
- `windows-sys`

### Linux

Use established desktop conventions:

- `.desktop` entries
- XDG Base Directory specification
- DBus where needed
- `xdg-open`
- environment-specific launch mechanisms where required

## 7. State Management

The React frontend likely does not need Redux.

Recommended approach:

- local React state for transient UI state
- small Zustand store only if cross-component state becomes awkward
- TanStack Query only for asynchronous settings/history screens where caching is useful
- Tauri events for backend-driven updates

The query text and selected result index should stay local to the launcher component whenever practical.

## 8. Styling

Tailwind CSS works well because the application UI is compact and component-oriented.

Avoid heavy UI frameworks that bring visual conventions designed for websites.

The launcher should have a custom desktop-native visual identity.

## 9. Testing

### Rust

- unit tests for scoring
- unit tests for normalizers
- integration tests for SQLite repositories
- platform-specific discovery tests

### React

- Vitest
- React Testing Library
- keyboard navigation tests

### End-to-end

Use Tauri-compatible automation where practical. Platform-specific smoke tests should run on Windows and Linux CI runners.

## 10. Tooling

Recommended development tooling:

```text
pnpm
Rust stable
Cargo
ESLint
Prettier
rustfmt
Clippy
GitHub Actions
```

Use separate quality gates for frontend and backend.

## 11. Why Not Electron

Electron is viable and may be faster for an all-TypeScript prototype, but the app will be permanently resident in memory and performs significant native/file-system work.

Tauri + Rust gives stronger long-term control over:

- memory usage
- background CPU use
- native APIs
- thread management
- indexing performance
- binary size

## 12. Why Not Flutter

Flutter is excellent for cross-platform UI, but the hard parts of this product are not the UI. They are indexing, filesystem observation, OS integration, fast background processing, and application discovery.

Rust is better aligned with those requirements.
