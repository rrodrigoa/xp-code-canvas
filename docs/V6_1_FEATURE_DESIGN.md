# XP Python UML Canvas — V6.1 usability repair

## User problems

1. The 584-symbol file-focus view creates an extremely long vertical stack. Fitting the entire canvas produces unreadable nodes, and previously saved manual positions can preserve the trap.
2. There is no discoverable Activity Bar entry for code structure, Git, or UML.
3. Read-only source previews are fixed-size and editing always navigates to the symbol declaration, losing the reader's selected caret position.

## Implemented behavior

### Recover / Spread

- A **Spread & Recover** toolbar button and the `Python UML Canvas: Spread and Recover UML Layout` command enter the `spread` layout.
- Spread resets saved layout positions and pins intentionally, so an old malformed arrangement cannot immediately reappear. Other view state (graph data, filters other than trace, history, Git data) remains intact.
- Source-ordered nodes are packed into a measured two-dimensional grid with bounded columns, rather than a single column. File focus automatically wraps large workspaces (>130 graph nodes or >18 focus nodes) while retaining the classic vertical three-lane layout for smaller projects.
- The view fits the **first six readable nodes** after spread, not 584 nodes at microscopic zoom. A minimap appears to help navigate the overall canvas. Users can manually pan, zoom, switch layout modes, and use search as before.
- `Reset UML Layout` clears stored per-mode positions as well as pinned/manual positions.
- The canonical graph and Git evidence are not modified by layouts.

### Activity Bar

- New **XP Code Canvas** Activity Bar container uses a monochrome custom three-box connected-graph SVG icon.
- Native **Python Structure** tree: Python modules, classes, functions, methods; clicking focuses the real graph symbol. Items are data-bearing, not disguised action buttons.
- Native **Git History** tree: local commit summaries; clicking a commit opens a semantic comparison in the UML editor.
- Native view-title actions: open canvas, spread/recover, refresh, history, changes, and selected-symbol Git blame.
- Both are native VS Code trees, supporting themes, resizing, keyboard navigation and accessibility; no second large React webview in the sidebar.
- Empty states include discoverable actions. Indexing begins on demand when Structure is exposed. Git history is loaded on demand when its tree is visible.

### Selectable source viewport

- When expanded into source, a node exposes a bottom-right resize control. Width/height are persisted per symbol (bounded 340–1400 and 260–1600 pixels); the read-only code viewport scrolls internally.
- Python syntax highlighting continues to use Prism with VS Code theme tokens. It is a viewport of the **actual current VS Code document**, served through the existing source-preview service. It is not a second native editor or an editable document clone.
- Selecting a cursor/word inside any nested Prism span stores its UTF-16 position, including multi-line source and first-line indentation offsets.
- **Edit** opens the native editor at that stored line/column; if no cursor was selected in the preview, it goes to the symbol's first source line at column zero.
- Stale/historical nodes retain existing safety checks. Invalid cursor coordinates never navigate out of the matching symbol.
- The existing node-header Open in Editor button still navigates to the declaration normally.

## UX / engineering trade-offs

- Rendering hundreds of function nodes at readable size necessarily requires scrolling or searching; no automatic layout can display 584 cards at full text size simultaneously. Spread makes the view navigable, not simultaneously legible at arbitrary scale.
- Blame means last modifying commit and remains separated from source structure and layout.
- A native VS Code text editor cannot be embedded directly inside a webview node. We reuse source text + Prism highlighting for read-only inspection, then transfer the cursor to the real editor for editing.
- AI-related functionality remains deferred.

## Verification to run in the actual current GitHub clone

1. `npm ci`; install Python test dependencies.
2. `npm run typecheck && npm run lint && npm run test:unit && npm run test:python && npm run test:feature-smoke`.
3. `npx playwright install chromium && npm run test:canvas-e2e` (new `spreadSourceSidebar.spec.ts`).
4. `npm run test:extension` and `npm run test:desktop-e2e` on Windows.
5. Launch Extension Development Host, open a 584-symbol Python repository, confirm the Spread toolbar and Activity Bar tree.
6. With 500+ nodes, switch between File Focus and Spread, reload VS Code, expand source and resize repeatedly, select a nested keyword, click Edit and verify the caret position.
7. Test a Git project, non-Git project, unsaved Python document, stale document, high-contrast theme and narrow window.
8. `npm run package` and inspect the VSIX for all `media/*.svg`, worker runtime and compiled webview assets; install the VSIX into a clean profile.

See `docs/FEATURE_VALIDATION.md` for the evidence collected in this environment.
