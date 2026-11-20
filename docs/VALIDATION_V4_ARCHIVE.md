# XP Python UML Canvas V4 — actual validation evidence

**Date:** 2026-11-19. Environment: Linux with Python 3.13, Node.js 22.16, global TypeScript and PostCSS. The npm registry is inaccessible (`EAI_AGAIN`), and no VS Code Extension Development Host was available. This archive is source code, not a verified VSIX.

| Gate | Status | Evidence |
|---|---|---|
| Python analyzer, worker and graph regression suite | **PASS** | `python -m pytest -q python/tests --cov=python/src/xp_canvas_analysis --cov-branch --cov-report=term-missing`: **33 passed**, **91% branch-aware coverage** |
| Dependency-light V3/V4 visual algorithm runtime smoke | **PASS** | `NODE_PATH=<global-node-modules> node scripts/visual-smoke.cjs`: wheel modifier and pointer zoom, Git lane topology, label positioning, focused layout, pinned locations, all semantic tiers, selected-only source guard, structure index equivalence, static Sankey accounting and ribbon geometry |
| TS/TSX syntax parsing | **PASS (syntax only)** | Global TypeScript parser: **60 files parsed; zero syntax errors**. Not `tsc --noEmit` |
| CSS syntax parsing | **PASS (syntax only)** | Global PostCSS parsed `src/webview/app.css`; not computed-theme or browser layout verification |
| V4 model-level Vitest tests | **AUTHORED, BLOCKED** | `semanticVisualsV4.test.ts`, `flowLensV4.test.ts` exist but cannot run without npm dependencies |
| V4 webview Playwright tests | **AUTHORED, BLOCKED** | `v4-anatomy-flow.spec.ts` exists but cannot run without React/Playwright dependencies |
| Complete React/TypeScript typecheck and build | **BLOCKED** | npm install cannot resolve packages (`EAI_AGAIN`). No claim of a successful bundling/build |
| Real VS Code extension, native-editor round-trip and Git history UI | **UNVERIFIED** | Requires actual VS Code runtime and real Git project fixtures |
| Windows desktop E2E, high contrast, accessibility, large-repo UI performance | **UNVERIFIED** | Must be run after dependency install and VSIX build |
| VSIX packaging and installation | **BLOCKED** | No complete npm build or installable VSIX has been generated |
| V4 concept PNGs and SVGs | **CREATED, ILLUSTRATIVE** | `docs/V4_UML_CONCEPT.*` and `docs/V4_SANKEY_CONCEPT.*`; static compositions, not captured running extension |
| AI features | **EXCLUDED** | `specs/AI_DEFERRED.md` is roadmap/documentation only |

## What remains for release

1. Install Node 22 dependencies with a working registry and commit a genuinely generated `package-lock.json` (do not fabricate integrity hashes). Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` and fix errors.
2. Run browser and extension-host acceptance tests for zoom thresholds, source preview throttling, positional pins and graph/Flow mode toggling. Capture real dark/light/high-contrast screenshots.
3. Verify module/class containment colors, native editor return, Git compare overlays, keyboard accessible Sankey peers and count semantics against fixture source.
4. Perform large-workspace layout/performance testing, pinned-node collision handling and extension lifecycle/restart tests. Generate and install a real VSIX on Windows and Linux.
5. Update the report with executed evidence; do not treat authored tests or illustrated screenshots as passing acceptance gates.

See [`CODEX_V4_NEXT_STEPS.md`](CODEX_V4_NEXT_STEPS.md) for the follow-up checklist. All previous V2/V3 **non-AI** product requirements are retained.
