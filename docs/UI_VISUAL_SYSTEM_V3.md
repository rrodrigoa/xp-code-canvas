# XP Python UML Canvas — V3 visual design and interaction contract

Status: **implemented in source; visual runtime verification pending npm install / VS Code Extension Host**. This document is an additive UI contract to `specs/CORE_V3.md` and `specs/PRODUCTION_ARCHITECTURE_V4.md`. The latter remain authoritative for product completeness and source analysis. AI features remain excluded.

## Product philosophy

- **One workspace, not three panels:** UML, scrollable inline source, and the standard editor are the levels of one navigation experience. Node inspection, relationship filters, help, and Git history are transient in-canvas overlays. Open in Editor uses the normal VS Code editor group; Return to UML restores the canvas.
- **Visually faithful relationships:** UML class structure, stereotypes, inheritance, dependencies, call links, and uncertainty retain their semantic meaning. Changes in appearance must not invent semantic facts or replace explicit source evidence.
- **Position is not structure:** drag/pin state is stored separately from the code graph; automatic reflow must never alter source code or canonical identities.
- **Theme first:** use VS Code CSS tokens for all primary surfaces, buttons, text and focus states. Semantic palette tokens are adjustable, non-essential cues. Keep textual badges for source changes.
- **No unnecessary UI weight:** toolbar + restrained context header + optional inspector/filters/Git drawer; no permanently open side panels.

## Mouse and keyboard controls (normative)

| Input | Target | Behavior |
|---|---|---|
| Wheel without modifiers | Canvas background, card heading, empty card | Pan the canvas vertically (no zoom) |
| Wheel without modifiers | Scrollable Python source preview | Scroll within the source box; no zoom and no canvas pan |
| Ctrl+wheel (Windows/Linux) | Anywhere inside the canvas, including source previews | Zoom the entire canvas around the pointer |
| Cmd+wheel (macOS) | Anywhere inside the canvas | Zoom around pointer; prevent accidental browser zoom |
| Left drag | Empty canvas | Pan graph freely in both axes |
| Left drag | UML card heading/body outside controls | Move card; edge handles follow; preserve position |
| Click | UML card | Select card and open transient inspector |
| Click | Expand source | Expand only that card; request a lazy source preview, maintain layout spacing |
| Click | Open in Editor | Native VS Code editor in same group at real symbol range |
| Click | Zoom ±, Fit, Minimap | Equivalent explicit alternative to wheel/keyboard |
| Click | Align focused file | Restore the focused file's source-order central lane, preserving other manual positions |
| Click | Auto-layout | Reapply global ELK (or focused-lane) layout to unpinned nodes |
| Click | Reset manual positions | Explicitly remove all manual pins and reflow |

Wheel control is implemented at the **graph container capture phase**, not conditionally by node hover: the only exception to ordinary wheel panning is independent source text scrolling. Ctrl/Cmd+wheel always takes priority even over a source preview. Zoom factor and pointer anchor are pure tested functions in `src/webview/interaction.ts`.

The unmodified wheel does **not** change semantic zoom. Semantic zoom levels remain overview/structure/source, driven by canvas zoom and explicit per-node expansion. The layout reserves space for the source preview before rendering it.

## Visual tokens, density and accessibility

All tokens live in `src/webview/app.css` and are named `--xp-*`. Use VS Code variables as the primary source; fallback values support the standalone preview. Keep the token roles distinct:

- Surface 0: editor canvas/background; Surface 1: UML cards, flyouts; Surface 2: toolbar and source headers.
- Text: `--xp-text` / `--xp-muted` and theme-specific syntax colors.
- Borders: `--xp-border` / `--xp-border-subtle`; selected focus `--xp-accent` with a translucent focus ring.
- Relationship semantics: call=blue, import=purple, inherits/realizes=warm amber, constructs=green, reference=neutral, containment=muted.
- Git change semantics: added=green, modified=amber, removed=red, impacted=info blue, ambiguous=warning amber. Preserve a **text label** in the node, not just a colored strip.
- Git history graph: six repeated lane colors with **solid** colored tracks, hollow/outlined commit dots, smooth branch junctions and explicit HEAD/tag chips.
- Font: VS Code UI font, code/signatures in VS Code editor monospace; consistent 9–13 px metadata and 11–13 px primary UI typography. Native 26–30px icon buttons with discoverable accessible labels.

Themes: dark and light use the same components with VS Code CSS tokens. High contrast uses explicit thicker borders and focus indicators. Reduced-motion disables transitions. Buttons, fields, graph controls, and source preview are keyboard focusable and display a visible focus outline. The mini-map is opt-in to avoid redundant chrome.

## UML card anatomy

1. **Port**: 10px circular handle attached at center left/right; visible more strongly on hover/selection. Port means connectivity, not another decorative node icon.
2. **Header**: 31px semantic Codicon badge; secondary stereotype/async caption; primary symbol name; right-aligned 26px action buttons (source, pin, native editor). Hover/focus reveals actions; selected cards retain them.
3. **Git semantic change**: a narrow colored vertical border plus separate status text and dot; historical ghosts use dashed lower-opacity boundaries.
4. **Attributes/operations**: UML compartments with subtle dividers, section labels, standard `+/#/-` Python visibility conventions, and click-through operations. Overflow scrolls locally without expanding indefinitely.
5. **Source preview**: code preview is read-only, lazily fetched, syntax highlighted and independently scrollable; explicit **Edit →** opens the native editor. No second CodeMirror/Monaco editor.
6. **Footer**: source filename and 1-based line number. Never store source body in the canonical graph for preview rendering.

UI sizes are used by `nodeSize()` in `src/webview/elkLayout.ts`; when changing compartment padding, caps, or preview heights, update the layout dimension estimator and overlap tests in the same change. Source previews reserve up to ~385 px vertical space.

## Auto-layout and relationship routing

- No focused file: run ELK layered RIGHT, with explicit node sizes, directional edges, crossing minimization, inter-layer and node spacing, and orthogonal *layout* routing. React Flow renders live rounded orthogonal/smooth-step paths, so edges continue to follow manual node moves without waiting for ELK.
- Focused file: center the selected module, classes, and top-level functions in source order; arrange direct incoming callers on the left, outgoing dependencies on the right. Rank neighbors by the barycenter of connected focused nodes, reducing crossings. Unrelated nodes go into a peripheral lane. Use variable-height stacking and roomy horizontal clearances.
- Manual/pinned positions win over automatic positions. Re-align File deliberately clears overrides for focused-file top-level nodes only. Reset Layout clears all manual positions. The canvas never auto-reflows while a node is being dragged.
- Expand/collapse and a selected symbol crossing the source-zoom threshold trigger node-size-aware reflow. Temporary graph deltas should not discard pins or the saved camera.
- For large or pathological graphs, keep a deterministic source-ordered collision-free fallback if ELK fails; do not present random overlapping positions.

### Relationships

- Inheritance: solid line + hollow UML triangle pointed to the base class.
- Realization: dashed line + hollow UML triangle pointed toward the protocol/interface.
- Call/import/create/reference: dashed open-arrow dependencies with **different restrained semantic colors**.
- Contains: subtle dotted organizational line; never imply ownership or composition unless the canonical graph establishes it.
- Low-confidence relationships: reduced-opacity dashed lines and clear source evidence in the inspector.
- **No ever-present edge-label cloud:** labels appear on edge hover/selection only. `placeEdgeLabel` tries the route-center location first, then alternative path positions and perpendicular offsets, and hides the label if no non-overlapping location exists. The user can always inspect full relationship evidence from the symbol inspector, so hiding the chip loses no semantic information. Arrows and path styling remain visible at all times.

Open questions for a future performance pass: ELK on a dedicated worker for very large workspace views, true ELK bend-point preservation under constrained edits, label-versus-label collision occupancy for multi-edge selections, and graph viewport virtualization. These are not represented as completed features.

## Git visual language

- History drawer is **dismissible** and inside the same canvas. `GitHistoryService` fetches up to 160 commits using a bounded, argument-array `git log` process, with `--topo-order` and explicit parents/ref fields. Git data is never guessed by AI or parsed from terminal presentation glyphs.
- `layoutGitLanes` computes commit column, active tracks, continuations, and junctions. The UI draws continuous solid lanes and small outlined circles using SVG. Wide histories keep every lane and enable horizontal scrolling instead of silently hiding later branches. The selected commit is highlighted with a narrow accent and a check icon. Branch, tag and HEAD references use separate accessible chips.
- Selecting a commit only changes the baseline selector; **Compare** executes the existing deterministic semantic Git diff, which shows added/changed/deleted/impacted symbols without conflating Git tracks and UML edges.
- History command can fail gracefully when Git is missing, workspace is remote/nonfile, or repository has no history. Never invent history rows or silently fall back to unrelated repository content.
- Color is never the only means of explaining a semantic diff: node status uses text, and source inspector shows evidence.

## Validation requirements

- `tests/unit/visualInteraction.test.ts`: wheel modifier, anchored zoom, clamping, no-overlap label fallback.
- `tests/unit/visualLayout.test.ts`: source order, left/right dependency lanes, expanded heights, pin preservation.
- `tests/unit/gitHistoryVisual.test.ts`: merge parent edges, ref parsing, lane continuity.
- `tests/browser/v3-visual.spec.ts`: browser-level mouse behavior, Git row display/selection, file focus and reflow (requires npm and Playwright).
- `scripts/visual-smoke.cjs`: dependency-light executable runtime assertions for pure TypeScript graph/visual algorithms.
- Browser snapshots need dark/light/high contrast tests, reduced motion and at least 100/200/400% OS scaling prior to release certification.
- Execute VS Code Extension Host and Windows desktop tests before treating visual/UI code as validated.

## Design references consulted

- [VS Code Webview UX guidelines](https://code.visualstudio.com/api/ux-guidelines/webviews)
- [VS Code Webview API and theme colors](https://code.visualstudio.com/api/extension-guides/webview)
- [React Flow viewport and scroll controls](https://reactflow.dev/api-reference/react-flow)
- [React Flow edge labels](https://reactflow.dev/learn/customization/edge-labels)
- [ELK layered layout](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [ELK layered layout phases](https://eclipse.dev/elk/blog/posts/2025/25-08-21-layered.html)
- [Representative Git graph UI patterns](https://marketplace.visualstudio.com/items?itemName=framedparadox.vsgit-vscode)

**Do not add the archived `@vscode/webview-ui-toolkit`**: its repository was archived in January 2025. Our own small theme-token-aligned components are the supported design approach.
