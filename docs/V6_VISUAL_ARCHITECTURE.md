# XP Python UML Canvas V6 — Visual architecture and UX contract

## Core principle
The UML canvas is the primary navigation surface. VS Code's **normal editor** is the full-code surface. Never introduce a third permanent editor column. All new Git, inspection and search tools are contextual overlays or progressive disclosure.

## P0 — stable and coherent presentation
- Source-backed UML node classes and connectors are unchanged. Custom VS Code theme-derived tokens live in `src/webview/styles/tokens.css`; focused CSS modules live in `styles/chrome.css`, `styles/nodes.css`, `styles/edges.css`, `styles/git.css`, and `styles/sankey.css`. The older `app.css` is retained for backwards compatibility, with V6 overrides loaded last.
- Nodes have a bounded, type- and signature-aware width; enlarged source/anatomy views remain compact enough for real graphs. The React Flow DOM is the authority for measured dimensions. ELK and source ordering provide initial placement; `settleMeasuredLayout` corrects overlaps near expansion without resetting every node.
- Layouts are named: `architecture` (ELK graph), `file` (selected module's source-order center lane), `investigation` (selected symbol centered, callers left, callees right), `change` (source-backed added/modified/deleted/impacted columns). Layout-specific positions are persisted separately. Explicit pins are preserved across modes. Dragging alone does **not** pin globally.
- Every graph layout is a visual projection. It must never rewrite the analyzer or semantic graph.

## P1 — interaction, clarity, discoverability
- Default toolbar is one row. Advanced trace/depth/Git baseline controls expand via **More**. Card headers show identity and Open Editor, secondary operations live in **More actions**.
- Ranked symbol search supports arrow keys/Enter/Escape. Selecting a method focuses its real parent file, expands methods as needed, and centers its node.
- Mouse: ordinary wheel scrolls content or pans vertically, Ctrl/Cmd + wheel zooms at cursor. Drag a node to arrange; drag background to pan. Zoom toolbar and fit view remain available. Source preview scrolling is independent of canvas panning.
- Typed ports attach calls, imports, inheritance, realization, references, containment, construction with consistent visual positions. A projected class edge attaches to an individual method only if its real source evidence maps to one unique member; otherwise it uses a class-level typed port. Never fabricate a member identity.
- Global label allocation gives selected/hovered links collision-free space relative to other labels and boxes; labels remain contextual. At low zoom, combine exact duplicate projected relationships of the same kind, retaining source evidence and counts.
- Exploration history, breadcrumbs, filtering and the inspector continue to work. Accessibility includes keyboard focus, icons with names, hover-equivalent focus disclosure, responsive toolbar and forced-color support.

## P2 — Git and Sankey polish
- Git metadata is an orthogonal visual channel to Python kinds: colored timeline lanes/circles for branches, separate added/modified/removed markers, optional per-line attribution and source-backed diffs. A small contextual control offers Changes / Blame / History. Clicking the History mode opens the existing *dismissible* timeline; blame and change overlays still use the selected symbol and the one canvas surface.
- A commit can be compared to current content; changed vs potentially impacted nodes are separately marked. Blame means **last-modified attribution**, not original author or owner. Dirty/unsaved content must not be misattributed.
- Sankey remains an independent view of **static source relationship counts**. Ribbon width is not CPU time, data volume, invocation rate or measured traffic. Selection and focus are shared with UML and preserved when switching views.

## P3 — release gates
1. Python analyzer tests and source-level visual smoke tests pass; use `npm ci` once a real `package-lock.json` is generated from registry-available development.
2. Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:canvas-e2e`, `npm run build`, `npm run test:extension`, `npm run test:desktop-e2e`, `npm run package`; no failures or unexecuted tests can be called passing.
3. Browser tests cover zoom/pan, 4 layouts, search, Git commands, code preview, dynamic node heights, member ports, graph navigation, and themes. Capture dark/light/high-contrast and 960/1440 responsive screenshots as CI artifacts.
4. Run 125%, 150% and 200% display scaling on Windows. Inspect high contrast and reduced motion. Validate 1,000+ symbols and cyclic graphs; the `v6-visual-smoke` source-level benchmark checks 1,500 intersecting cards but is not a substitute for React DOM performance tests.
5. Test VS Code same-group navigation, return-to-canvas, save/unsaved buffer synchronization, Git blame on clean/dirty/renamed files and Windows/Linux VSIX installation.

## Visual-proof limitations
`docs/visual/V6_STATIC_DESIGN_PROTOTYPE.html` and rendered PNGs are **static illustrative design-system previews** using V6 CSS and example data. They are not live extension screenshots and have no claim to runtime correctness. Render using `python scripts/render-v6-prototype.py` with Python Playwright installed; the script also checks dark/light, narrow viewport and 200% device scale.

## No AI
This code does not implement AI explanations, AI-guided architecture walkthroughs or agent/CLI interfaces. See `specs/AI_DEFERRED.md` only for an intentionally separate future roadmap.
