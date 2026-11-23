# XP Code Canvas V7.1 — Visual Review, Inline Editing & Semantic Zoom

This document describes an additive feature layer on the V7 visual review reference. **The authoritative development baseline is the user's UNPUSHED local V6.1 + Codex fixes + any integrated V7 features**. Do not reset it to the public GitHub main branch or replace it with this reference source. See `CODEX_INTEGRATE_XP_VISUAL_REVIEW_V7_1.md` for instructions.

## Usability rationale and research

Large AI-authored changes are difficult to evaluate as a flat alphabetized file list, especially when an agent modifies production code, tests, lockfiles, READMEs, and configuration together. The following public designs informed the changes:

- CodeRabbit **Change Stack** (May 2026): layer and group a PR by related changes, not file names. https://www.coderabbit.ai/blog/introducing-atlas-the-first-ai-native-code-review-interface
- Graphite **Code Tours** (April 2026): keep a coherent navigation path while retaining access to exact code diffs. https://www.graphite.com/blog/code-tours
- GitHub **Files Changed** updates (Jan–Mar 2026): resizable file tree, line comments beyond the changed hunk, alerts and review state. https://github.blog/changelog/2026-01-22-improved-pull-request-files-changed-page-on-by-default/
- Etchpad: a progressive spatial-code representation, with actual source appearing at higher zoom. https://www.etchpad.ai/

We adapt the interaction ideas, not the competitors' implementation or identity. **No LLM inference is necessary or implemented.** V7.1 is review-centric for code *produced by AI*, not an AI reviewer. All call graph, file, relationship, Git and test-file statements remain source-backed; test-file changes are not equated with test execution or coverage.

## Feature A — Change Atlas

The existing Review dock adds an **Atlas** tab as the default. Directly changed Python symbols form groups connected by same-file ownership or direct graph edges; each visible chapter presents a compact architecture map and lists the concrete changed symbols and real changed paths. Chapter detail includes added, modified, removed and relationship counts, possibly affected neighboring symbols, and open discussion counters. Clicking a symbol focuses it on the *existing* graph. Clicking a file opens V7's native diff.

Documentation, tests and configuration are listed separately even if they have no UML symbol. Unmatched files are explicitly called out rather than omitted. Chapters are capped at 14 symbols and rendered incrementally (24 at a time) to avoid a single giant scroll column. Group ordering is a deterministic review heuristic, **not a chronological or runtime call order**.

The main graph retains V7's faded unchanged nodes, highlighted changed nodes, relationship changes, and discussion badges.

## Feature B — Review-line evidence in UML source

For source that exactly matches the opened review snapshot, the node's *read-only* code preview can overlay lines introduced/modified relative to the chosen Git baseline, and display actual added/removed line counts. An on-demand local service reads `git show` and compares the current **VS Code document text** against the baseline with `git diff --no-index --unified=0`. This includes unsaved editor content in the current document, not just bytes on disk.

- Line bars are **line-level diff evidence**, not inferred semantic intent.
- Historical nodes, stale buffers, missing baseline revisions and files outside the opened Git workspace show a limited/unavailable state instead of inventing changed lines.
- The native side-by-side diff remains the authoritative full before/after review surface. The overlay does **not** pretend to show removed source content that no longer exists inside the selected class.
- Git commands use argument arrays (no shell interpolation), bounded output, temporary files outside the repository and guaranteed cleanup.

## Feature C — Inline source editing

Expanded current Python class/function/method/property nodes offer **Edit here**, in addition to **Native editor**. Edit here renders a resizable, scrollable textarea editing surface with a Prism syntax-highlighted mirror, keyboard selection, indentation insertion via Tab, clipboard/IME support and native text undo. Ctrl+S/Cmd+S saves the draft; **Discard** explicitly abandons it; Native editor continues at the current cursor position. This is not a new permanent panel.

A save is a guarded `vscode.WorkspaceEdit` to the original source range. The host verifies workspace trust, live local symbol, exact SHA-256 document hash, exact original range text, source size, and file workspace membership before writing. It never stages, commits, posts review comments or modifies a remote PR. The native editor remains the full-featured environment for language services and complex refactoring.

Editing is denied for historical/staged/PR snapshots or truncated (>20,000 characters) source views. Working and unstaged reviews may permit an edit only if the live document's full hash matches the source-backed symbol. Volatile per-node drafts survive graph virtualization during the current webview session; drafts are **not** persisted to disk or telemetry. Refresh the local review (Review dock refresh button) to recalculate changed symbol and relationship overlays after editing.

**Editor limitation:** this lightweight editor is a text viewport with syntax highlighting, not a true VS Code editor embedded inside a webview. It does not promise Pylance completion, multi-cursor, debugger integration, formatting commands or extension decorations. CodeMirror 6 could be adopted in a later release after npm/VS Code runtime validation, but it is not needed to compile these features.

## Feature D — Three adjustable semantic zoom boundaries

The small **Detail zoom** button on the left canvas edge opens a vertical rail with three draggable markers and keyboard arrow access. These set the zoom values at which compact boxes become UML detail, UML detail becomes code anatomy, and a *selected* node becomes a source viewport. Markers use log-scaled track positions and cannot cross each other. Defaults: **64%, 113%, 188%**. `semanticZoomStops` persists in existing `CanvasState` through the V7 view-state validation path.

Ctrl/Cmd+wheel still controls physical canvas zoom, ordinary wheel still scrolls source or pans, and explicitly expanded source nodes remain open regardless of thresholds. Changing a threshold updates node detail without destroying manual positions or deliberately triggering global ELK re-layout.

## Current implementation boundaries

- Entire V7 Graph/UML/Sankey/Git history/blame/comment/PR capability is preserved in the reference source. No PR comment is automatically posted by V7.1.
- This is an additive **source integration**, not a verified Windows VSIX. The npm dependency tree was unavailable in the execution environment; full TypeScript semantic checks, React/extension builds, browser and installed VS Code interaction tests must still execute on the user's local checkout.
- The public GitHub repository is NOT the authoritative V6.1/V7 baseline because those changes were described as unpublished. Merge individually and run full regression tests before a release.
