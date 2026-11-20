# Codex — V6 continuation and release validation

## Start from this repository
**Do not regenerate the project.** Preserve V1–V5 features, the production V4 canonical semantic graph and Python analyzer, source-backed Git, Sankey and the V6 visual architecture.

1. Install Node 22, Python 3.13 and VS Code >=1.96. Generate and commit a genuine `package-lock.json` using `npm install --no-audit --no-fund` (never fabricate lockfile integrity hashes). Subsequently run `npm ci`.
2. Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:visual-smoke`, `npm run test:visual-v6`, `npm run test:python`, `npm run test:canvas-e2e`, `npm run build`, `npm run test:extension`. Fix every actual compilation or integration problem. `npm run test:desktop-e2e` must run on a Windows desktop/runner with graphical UI access.
3. Verify after node expansion, blame and source preview: card DOM size is measured, nearby cards do not overlap, no unrelated nodes jump, and manual pins/layout snapshots remain stable. Test all four modes with 100, 1,000 and 5,000 symbols.
4. Verify source-backed edges use correct relationship-type ports and unique method-level ports where evidence permits. Multi-method bundles must use class-level ports, never arbitrary method targets. Validate global hover-label positioning with crowded edges.
5. Test normal wheel scroll, Ctrl/Cmd+wheel pointer zoom, keyboard focus/selection/menus, symbol-search focus, native editor navigation/return, Git modes, Sankey selection, all supported themes, 125–200% DPI and screen-reader labels.
6. Capture screenshots from a **running extension**. Use artifacts from `tests/browser/v6-polish.spec.ts` and Windows desktop tests; inspect visually and use them as visual-regression baselines only after actual approval. Static design previews in `docs/visual` are **not** runtime screenshot baselines.
7. Run `npm run package`, install the VSIX in a clean VS Code profile, document the observed feature behavior and pass/fail evidence. Update `docs/VALIDATION_REPORT.md` only with tests truly executed. Do not implement `specs/AI_DEFERRED.md`.

## Current known limits
The npm registry limitation was resolved during the Windows continuation. A genuine lockfile, full semantic typechecks, builds, unit/Python/Playwright suites, extension-host tests, installed desktop tests and VSIX packaging have now been executed. `docs/VALIDATION_REPORT.md` records current results and distinguishes browser device scaling from unexecuted physical Windows DPI checks. The checklist above remains the UX/release contract; it is not evidence that every manual scenario has passed.
