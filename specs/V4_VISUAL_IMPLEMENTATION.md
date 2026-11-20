# V4 Visual Product Requirements — Non-AI Core

This document is an **additive, normative extension** of `CORE_V3.md`, `PRODUCTION_ARCHITECTURE_V4.md`, and `UI_VISUAL_SYSTEM_V3.md`. In case of a visual styling conflict, the newer V4 visual system takes precedence without reducing V3 functionality. The semantic graph, worker, Git, native-editor and test requirements remain unchanged. **`AI_DEFERRED.md` must not be implemented.**

Deliverable V4 implementation requirements:

1. Progressive visual representation of indexed Python constructs across zoom tiers. Compact anatomy strips → UML compartments → nested, source-ordered colored construct blocks → read-only syntax-highlighted source for the selected/expanded node. Preserve independent architecture/package/module/code navigation.
2. Consistent structure colors for modules, classes, callables, and data. All meanings must also be available through textual labels, icons, confidence shapes, tooltips and keyboard/a11y descriptions. Git state is a separate channel, never a replacement for structural color.
3. Connection-aware selection. Clicking an indexed method/child must make its actual existing graph edges available; do not invent direct relationships for decorative blocks. Preserve UML edge semantics, sourced evidence and current overlap-avoidance work.
4. File-focused grouping and source-order auto-layout, with optional source boundary frame and manual drag/pin precedence. Retain Ctrl/Cmd+wheel zoom vs normal-wheel scrolling policy.
5. Add a full-canvas toggleable Sankey analysis lens, using **only source-backed static relationship counts** with explicit units, totals and denominators; callers and dependencies are distinct sides. No claim of runtime behavior or program throughput. Support calls, imports, creates and references separately, source-based confidence, filtering, peer focus and keyboard navigation. Never create unsupported edges.
6. V4 pure model files must be independent of VS Code and React for unit testing. The live Python graph and native editor remain the source of truth; no AI services or APIs required.
7. Preserve V3 Git timeline/semantic diff overlays, single active editor surface, file focus, visual accessibility, and source synchronization.
8. Keep test coverage for the analyzer, graph contracts, zoom/flow models, browser canvas interactions, native editor integration, and CI/VSIX packaging. In this starter, unexecuted tests must be clearly labeled, not assumed passing.

Acceptance: `npm run verify` on a connected build machine, visual review on Windows VS Code (dark, light, high contrast), integration into a real multi-file Python project, and comparison with the previous V3 feature set. See `docs/UI_VISUAL_SYSTEM_V4.md` for precise mapping, limitations and research sources.
