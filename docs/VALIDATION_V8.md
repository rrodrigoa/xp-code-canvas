# XP Code Canvas V8 — executed validation and release gaps

Date: 2026-11-22. Basis: the user-provided **V7.2 reference source ZIP**, *not* their unpublished, Codex-modified local checkout. Version: 0.8.0 (source integration candidate).

## Executed

| Gate | Result | Evidence / limitations |
|---|---|---|
| Python AST/semantic analyzer regressions | **PASS** | `PYTHONPATH=python/src python -m pytest -q python/tests`: **39 passed** |
| Deterministic 3D layout smoke | **PASS** | `NODE_PATH=$(npm root -g) node scripts/v8-spatial-smoke.mjs`: 584 symbols × 5 layouts; 5,000 symbols folder mode; finite placements, change grouping, core metrics and repeatability |
| TS/TSX source syntax | **PASS, syntax only** | TypeScript `transpileModule` parsing of **117** TS/TSX source and test files; **0 syntax errors**. This does **not** test module resolution or types. |
| Git patch syntax | **PASS** | `git diff --check` and apply-to-reference check performed at packaging time |
| ZIP integrity | **PASS** | All generated archives tested at packaging time |

## Not executed / cannot claim release readiness

The source-producing environment cannot resolve the npm registry (DNS `EAI_AGAIN`), and the reference ZIP has neither installed npm dependencies nor a reproducible lockfile. Consequently these gates remain **BLOCKED / NOT RUN**:

- Install `react-force-graph-3d`, `three`, and `@types/three` with `npm install`; commit generated `package-lock.json` and verify `npm ci`.
- Full TypeScript (`npm run typecheck`), ESLint, Vitest, production Vite/extension build, and VSIX packaging.
- Playwright 2D/3D lens switching, WebGL scene, tooltips, drag/persist, camera controls, PR Before/Delta/After, native editor/edit integration, WebGL fallback and GPU context loss.
- Actual VS Code Extension Host and installed Windows desktop validation, VSIX file inspection and clean-profile installation.
- Long-running 3D performance profiling on 500, 1,000 and 5,000 real symbols, GPU/VRAM limits, synthetic and real multi-root folder grouping.
- Physical accessibility (keyboard-only graph selection, high contrast, assistive tech); 3D has HTML list/selection alternatives but this needs hands-on validation.

## Required local Codex continuation

Run in the user's **existing unpublished local V7.2+** repository, not in a reset checkout of GitHub main. First reconcile this patch against that local code, then `npm install`, `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:python`, `npm run test:unit`, `npm run test:spatial-v8`, `npm run build`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run test:desktop-e2e`, `npm run package`, and verify/install the VSIX. Treat any failed or skipped tests as a release blocker until documented and fixed. Verify the actual editor/ReviewDock integration rather than relying on the deterministic layout smoke alone.

## Correctness caveats

- Graph centrality, source size, folder, and static call-depth are deterministic layout inputs; they do not measure runtime criticality or code quality.
- Direct changes and potentially affected symbols stay visually separate; source provenance and confidence remain unchanged by layouts.
- Source previews and edits in historical review frames are disabled. Canonical graph and source bytes are never sent to an external service.
- AI semantic clustering is specified only in `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md`; it is **not implemented**.
