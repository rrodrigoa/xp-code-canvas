# XP Python UML Canvas V4 — implementation status (2026-11-19)

V4 extends the tested V2 Python analyzer and V3 visual starter with four source-backed visual detail tiers, theme-aware structural color, expanded tier-aware layout, file scope frames, and an interactive one-hop static-reference Sankey lens in the same editor tab. No deferred AI features are implemented.

**Executed:** 33 Python tests passed with 91% branch-aware coverage; dependency-light V3/V4 visual smoke passed; 60 TS/TSX source files and V4 CSS parsed without syntax errors. **Not executed:** full TypeScript typechecking, React compilation, Vitest/Playwright, VS Code Extension Host, desktop E2E or VSIX packaging because npm registry access and VS Code runtime were unavailable.

Read [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md), [`TRACEABILITY.md`](TRACEABILITY.md), [`UI_VISUAL_SYSTEM_V4.md`](UI_VISUAL_SYSTEM_V4.md), and [`CODEX_V4_NEXT_STEPS.md`](CODEX_V4_NEXT_STEPS.md) for evidence, visual contracts, residual risks and remaining release work. Retain all V2/V3 non-AI features and the original product specifications in `specs/`.
