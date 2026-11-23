# V8.1 local validation — 2026-11-22

This report supersedes the reference ZIP's partial validation. The authoritative local tree started clean at **5e450885d98e4cea0e389f2e6c43ca76b14d9af1**, branch `codex/v6-1-usability`, version 0.6.1. The supplied V8.1 patch targets the **V8 reference**, not GitHub main or this checkout; its applicability check failed as expected. The cumulative V8.1 source contains V7/V7.1/V7.2/V8. It was merged using the supplied V6.1 source as common ancestor. Eight file conflicts were reconciled, preserving local analyzer, worker, virtualization, Spread, refresh, source-cursor and sidebar fixes. No reset, clean, pull, checkout, rebase, commit, push or publication was performed on the authoritative repository.

Environment: Windows, Node 24.14.1, npm 11.11.0, Python 3.11.9; cached VS Code/Extension Tester 1.147.0. Browser profiling reports **ANGLE SwiftShader**, not a physical GPU.

## Executed gates

| Command / gate | Result |
|---|---|
| `npm install --fetch-retries=0 --fetch-timeout=20000` | PASS; dependencies and lockfile reconciled. Initial restricted-sandbox attempt failed DNS; retry succeeded. |
| `npm ci --fetch-retries=0 --fetch-timeout=20000` | PASS; clean lockfile installation, followed by typecheck, lint and all 103 unit tests. `npm-ci-v81.log`, `unit-v81-clean-install.log`. |
| `npm run typecheck` | PASS; full semantic checks for extension, webview and tests. |
| `npm run lint` | PASS; zero errors/warnings. |
| `npm run test:unit` | PASS; **28 files / 103 tests**; 95.84% statements, 89.09% branches, 98.52% functions in the configured shared-code coverage scope. `unit-v81-complete-final.log`. |
| `$env:PYTHONPATH='python/src;.python-test-deps'; npm run test:python` | PASS; **39 tests**, 91% branch-aware coverage. `python-v81-final.log`. |
| `test:visual-smoke`, `test:visual-v6`, `test:feature-smoke` | PASS; retained visual/routing/layout/cursor contracts, 1,500-node collision and 584-node Spread regressions. |
| `test:review:smoke`, `test:v72-smoke`, `test:v72-study` | PASS; review persistence/API contracts, 5,000-symbol cognition and offline scorer. Remote writes are mocked; **no human study conducted**. |
| `test:spatial-v8`, `test:spatial-v81` | PASS; eight organizations, deterministic partitions, shared styles, flattened 2D layouts and UTF-16 cursor contracts. |
| `npm run build` | PASS; local WebGL/ELK chunks and one CSS entry containing lazy renderer styles. Large-chunk advisory remains. |
| `npx playwright install chromium` | PASS; browser available. |
| `npm run test:canvas-e2e -- --workers=2`, isolated `XP_CANVAS_PORT=5193` | PASS; **44 tests**, 1.5 minutes, including all retained 2D regressions and 50–10,000-symbol WebGL profiles. `browser-v81-complete.log`. Real WebGL; mocked host bridge. |
| `npm run test:extension` | PASS; **4 fixture Extension Host tests**, including the previously omitted inline-edit guard. `extension-v81.log`. |
| `npm run test:desktop-e2e` | PASS; **3 installed Windows tests**: real analysis/native navigation, all spatial organizations/presets, verified native dark/light/high-contrast theme classes and closed theme picker. `desktop-v81-runtime.log`. |
| `npm run test:real-repo` | PASS; **10 real Flask Extension Host + 4 installed desktop tests**. `real-v81-release.log`. |
| `node scripts/test-unborn-repository.mjs` | PASS; actual index before first commit, staged Python/docs, untracked documentation, unsaved-buffer separation. `unborn-v81.log`. |
| `node scripts/test-multiroot-repository.mjs` | PASS; separate source IDs/partitions for identical symbols in two actual workspace roots; explicit cross-root Git-review guard. `multiroot-v81.log`. |

## Runtime and real-repository evidence

Browser cases preserve 2D/Sankey/Git functionality and cover partitions, UML→3D→UML viewport restoration, selected symbol/filters, semantic thresholds, resizable inspector, CRLF/emoji UTF-16 native navigation, WebGL disabled, WebGL1-only fallback and context loss. Shared unit/geometry contracts cover all seven relations, uncertainty, markers, Git colors, badges and batched picking. Device scale factors 1.25/1.5/2 are exercised. Camera-facing `THREE.Sprite` cards have no backside.

The screenshot baselines under `docs/validation/v81/` come from the **installed extension**. Native Light Modern and Dark High Contrast were verified by their webview theme class and inspected. An earlier test was corrected after inspection showed it had only opened the theme picker. Class operation compartments now use canonical members, matching 2D.

Real Flask: `49943b5a94413a530761350f04e896f76e8d620e`, 5,566 commits, 83 files, 1,705 symbols, 387 relationships. History, blame, dirty/unsaved rejection, staged rename, untracked source, previews, native editor cursors/group, sidebar, diffs and Sankey passed; the temporary clone was restored clean.

[Flask PR #6176](https://github.com/pallets/flask/pull/6176) was read through the GitHub connector. Exact base `d04a0c15a83c78186cf31dc5d226b3110321b9e5` and head `bfc8f983871dcadf0492578d9ab72d951b34c19c` were analyzed locally using their merge base: one changed file, 40 changed/impacted symbols, 16 structural facts, identical renderer projections. A separate **26-file staged review** included 25 Markdown evidence files; INDEX excluded unsaved edits while unstaged/working included them. No remote write occurred.

## Performance and memory

The checked-in `spatial-*.json` receipts record the final five graph sizes, with cyclic graphs containing two relationships per symbol. FPS is a two-second sample during Fit/camera work, not a statistical hardware certification. Before batching, 1,000 symbols measured about **7 FPS / 5,040 draw calls**. Initial optimized reruns measured **26–33 FPS / 50–103 draw calls**. Latest 10,000-symbol runs use approximately **170 draw calls / 15 MiB estimated textures**. Exact final FPS, load time, worst frame, texture counts, estimated bytes, JS heap and renderer identity are in the receipts. Dense software-WebGL views remain slower; no 60-FPS guarantee is made.

Optimizations batch markers and relationship geometry, bound dash density without dropping relationships/gaps/markers, and use screen-space picking/dragging for large graphs. Card allocation is bounded by count (260) and **32 MiB estimated card textures including mipmaps**; selected cards retain priority. Region/badge textures are additional measured allocations. Stale objects, textures, geometry, listeners and scheduled batch frames are disposed; context loss preserves 2D fallback. This establishes bounded allocations and successful recovery, **not an hours-long leak soak or measured physical VRAM**.

## Explicit limits

- Physical Windows display-scale changes and a hardware-GPU performance matrix were **not executed**. Browser device scaling and native themes were executed.
- Multi-root indexing/layout is tested; cross-root Git review is explicitly rejected to avoid comparing unrelated repositories.
- Authenticated VS Code GitHub sign-in/permissions and live remote mutations were not exercised against a disposable PR. Real PR source comparison passed; mutation contracts use mocks. Nothing was posted or approved.
- 3D objects can occlude one another at some angles; focus/zoom and the DOM source inspector provide readable detail. Zero screen-space overlap for every projection is not asserted.
- Minimum VS Code 1.96 and other operating systems were not validated.

## Delivery

Version **0.8.1**; artifact `dist/xp-code-canvas-0.8.1.vsix`; patch `dist/xp-code-canvas-0.8.1-local.patch` against the exact starting local HEAD. External `dist/` receipts hold final install checks and hashes, avoiding a self-referential VSIX hash inside the VSIX. Changes are staged for review; no commit/push/publication was performed. AI semantic layout remains deferred in `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md`.
