# V5 — Core usability, visual semantics, and Git attribution contract

Additive to `specs/CORE_V3.md`, `specs/PRODUCTION_ARCHITECTURE_V4.md`, and `specs/V4_VISUAL_IMPLEMENTATION.md`. If instructions conflict, retain the existing single-active-view/native-editor behavior; V5 adds no AI functionality.

## Design invariants

1. One native VS Code editor group at a time. Canvas and standard source editor are mutually navigated tabs.
2. One consistent gesture model: scroll to pan (or scroll source within code), Ctrl/Cmd+wheel to zoom canvas, empty-space drag to pan, node drag to move, no wheel-mode switching based on hover.
3. Structural UML colors, Git status markers, blame author colors, source anatomy colors and relationship certainty are independent visual channels.
4. All edges must retain graph evidence. Blame and AST anatomy are independently sourced annotations, **not new confirmed call edges**.
5. Git blame is on-demand and strictly HEAD-based. If source is dirty, staged, untracked, stale, or unsaved, refuse positional attribution rather than mapping old commits to new lines.
6. Dynamic panels are context overlays within the existing tab and must be keyboard dismissible. No third permanent panel.
7. Layout reserves vertical space for code anatomy and blame summaries and keeps manual pins authoritative.
8. Source region navigation must revalidate the current document SHA-256 against the analyzed node before selecting a range.
9. Do not implement the separately deferred AI roadmap, add model dependencies, or send source code to external services.

## Required V5 interactions

| Interaction | Expected |
|---|---|
| Select symbols A then B, Back, Forward | Restore A then B with their focused file and methods visible |
| Choose parent breadcrumb | Select that actual indexed graph symbol |
| Open blame on a clean Git-tracked function | Show author share, number of distinct commits and HEAD-based line gutter |
| Open blame with edited/unsaved file | Show a readable mapping-unavailable explanation, no misleading attribution |
| Select a line blame mark | Show commit hash/author/date/subject locally; compare action explicitly says workspace comparison |
| Zoom into function | Display source-backed control regions; no fake data-flow or execution-frequency claim |
| Click a control region | Navigate to its exact source location in native VS Code editor after hash verification |
| Select Git commit baseline | Display direct-change versus possible-impact emphasis without rewriting the canonical graph |
| Move/resize code cards | Edges remain attached, graph locations persist, auto-layout reserves sizes |

## Source-derived visualization taxonomy

| Syntax | Role | Design |
|---|---|---|
| `if`, `match`, `assert` | branch | violet inset bar |
| `for`, `async for`, `while` | loop | blue inset bar |
| `try`, `except` | exception | amber inset bar |
| `with`, `async with` | context | green inset bar |
| `return`, `yield` | exit | muted yellow inset bar |
| `raise` | error exit | amber inset bar |

Each block shows its derived source line and an affordance to open the corresponding code. Width is normalized to source span, never a runtime metric. Large source nodes cap the number of rendered blocks; truncation should eventually be indicated explicitly (follow-up item).

## Test gates

- Python AST and scope tests including nested functions, try/except, Unicode UTF-16 coordinates, extraction cap.
- Git porcelain parser tests including multiple authors and malformed output.
- Git subprocess integration tests with clean, staged, modified, unsaved, moved and deleted paths.
- Browser tests for Back/Forward, selected Git emphasis, control-region click-through and blame display.
- VS Code extension-host/desktop tests for source hash validation, native-editor return, and no extra split.
- Accessibility and performance verification at realistic repository sizes.

A feature is not release-qualified solely because its source passes syntax parsing. Record genuinely executed tests and blocked gates in `docs/VALIDATION_REPORT.md`.
