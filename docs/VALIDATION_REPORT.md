# V6.1 integration — executed validation

> Historical V6.1 record. Current V8.1 integration, executed tests, performance and release limits are in [VALIDATION_V8_1.md](VALIDATION_V8_1.md).

Date: 2026-11-20. Version: **0.6.1**. Branch: `codex/v6-1-usability`, based on current main `efc0274` (fast-forward pull reported up to date). The feature archive was reconciled by file/hunk; main's analyzer, lockfile dependencies, worker, layout readiness, search, Git and packaging fixes were preserved. AI features remain deferred.

| Gate | Executed result |
|---|---|
| Dependencies | npm clean install completed; lockfile changes only root version to 0.6.1. Windows denied the initial sandbox esbuild access; elevated retry succeeded. |
| TypeScript / ESLint | PASS — full semantic checks and lint, `v61-fast-final.log`. |
| Unit / algorithms | PASS — 16 files, 66 tests; shared coverage 93.32% statements, 85.85% branches, 97.22% functions. Both existing visual smoke suites and new feature smoke passed. |
| Python | PASS — 38 tests each on 3.11.9 and 3.13.0, 91% branch-aware coverage. Local test dependencies require PYTHONPATH; the first resumed run without it failed and was rerun successfully. |
| Playwright | PASS — all 25 tests, 26.5 seconds. Includes 584-symbol readable recovery, exact nested-token UTF-16 cursor with emoji/CRLF, actual resize drag, saved dimensions across collapse/reopen, and existing 100/1,000/5,000-symbol and visual checks. Host messages are mocked. |
| Fixture extension host | PASS — 3 tests: commands, native contribution manifest, exact editor line/column and fallback, source preservation. |
| Fixture Windows installed VSIX | PASS — 2 tests, 13 seconds: analyzed cards, all five layouts, native editor and return. |

Real Flask validation **PASS**: final corrected run `v61-real-corrected.log` completed **8 extension-host tests and 4 installed-VSIX desktop tests** (32 seconds for desktop). The actual dedicated Activity Bar icon was clicked, native modules and HEAD commits appeared, Spread showed its minimap, and History opened the populated timeline. The clone remained clean. Retained screenshots are in `docs/validation/flask/v61-*`; the earlier container fallback and inherited Git environment failures are not counted as passes.

Final package: `npm run package`, `npm run test:package`, isolated VS Code CLI installation, and byte-for-byte installed runtime verification are recorded in `v61-package-final.log`, `v61-install-final.log` and `docs/validation/v61-vsix.json`. The package verifier checks ZIP integrity, version, analyzer modules, ELK worker, all new sidebar icons and exclusion of local test artifacts.

Integration corrections: resolved new/shared layout types and cursor protocol, deduplicated initialization, queued sidebar actions until webview readiness, preserved method reveal, normalized CRLF and blank preview offsets, kept dimensions bounded and the source/context scroll regions inside resized cards, and prevented stale React Flow wrapper sizes after collapse. Visual inspection found VS Code rejected dots in the supplied Activity Bar container ID; changed it to `xpCodeCanvas-sidebar` and strengthened the installed test to click the actual Activity Bar icon. An unrelated Dev Containers notification obstructed the history comparison button; the desktop fixture now dismisses notifications. The real-repository launcher clears inherited counted Git config overrides because VS Code can strip their empty values.

The V6 report below is historical evidence for 0.6.0, not a claim that its counts describe 0.6.1. Its unexecuted physical DPI, screen-reader, Linux/minimum-version and hosted CI gates remain **NOT EXECUTED**. No blocked or unexecuted check is treated as passing.

---

# XP Python UML Canvas V6 — Executed validation report

**Date:** 2026-11-19 (America/Los_Angeles). **Version:** 0.6.0. Validation continued from the existing V6 implementation on Windows. Results below are executed checks, not authored-test claims. Earlier sandbox DNS, socket and Windows file-lock failures were retried; those failed attempts were not counted as passes.

| Validation gate | Result | Executed evidence and scope |
|---|---|---|
| Dependencies and lockfile | **PASS** | Genuine npm-generated `package-lock.json`; successful `npm install --no-audit --no-fund` and `npm ci --no-audit --no-fund`. CI now uses `npm ci`. No integrity hashes fabricated. |
| Full TypeScript semantic checks | **PASS** | `npm run typecheck`: extension, webview, shared/core imports, unit and browser test sources, Vite/Vitest/Playwright configs. Added `tsconfig.tests.json`. |
| ESLint | **PASS** | `npm run lint`: no errors or warnings. |
| TypeScript unit tests and coverage | **PASS** | `npm run test:unit`: **14 files, 61 tests**. Shared-code statement/line coverage **93.24%**, branches **85.33%**, functions **97.14%**; configured thresholds passed. This is not whole-extension coverage. |
| Python analyzer | **PASS** | **38 tests**, **91%** aggregate branch-aware coverage on Python **3.11.9** and **3.13.0**. Pinned pytest 9.0.2 / pytest-cov 7.0.0; isolated 3.13 embeddable runtime used pure-Python coverage tracing. |
| V3/V4 visual algorithms | **PASS** | `npm run test:visual-smoke`: wheel policy, Git lanes, file focus, structure tiers, Sankey values and geometry. |
| V6 visual algorithms | **PASS** | `npm run test:visual-v6`: layouts, collision settling, typed/member ports and multi-method fallback, edge labels, search, 1,500-card geometry benchmark. |
| React and extension build | **PASS** | `npm run build`: Vite production bundle, extension bundle and extension-host test bundle. Vite reports large chunks; build succeeds. ELK worker and its import chunk are included. |
| Playwright Chromium | **PASS** | `npm run test:canvas-e2e`: **23 tests**, final run **18.2 seconds**. Navigation, altitudes, source previews, graph delta recovery, wheel/zoom, drag persistence, Git UI contracts, anatomy, Sankey, search, four layouts, responsive screenshots and measured source-expansion overlap check. Host responses in this suite are mocked. |
| Large cyclic browser graphs | **PASS — bounded scenario** | 100, 1,000 and 5,000 synthetic source symbols, one cyclic call edge per symbol, all four modes. Full cases: **5.8s / 3.1s / 7.0s** in the final browser run. These are single-run UI regression timings, not a comprehensive real-repository performance study. |
| Browser theme / scaling / accessibility checks | **PASS — automated scope** | 960x720 and 1440x900, dark/light token compositions, forced colors and reduced motion; actual browser contexts with device scales **1.25, 1.5, 2** and keyboard symbol selection. Physical Windows display scaling and real screen-reader use were not tested. |
| VS Code Extension Host | **PASS** | `npm run test:extension`: **2 tests** on VS Code **1.147.0**, exit 0. Explicit activation verifies command registration; real fixture document focus/return leaves source unchanged. |
| Installed Windows desktop | **PASS — automated scope** | `npm run test:desktop-e2e`: **2 tests**. ExTester installs a genuine VSIX in its isolated VS Code test environment, verifies the canvas tab, real Python-analyzed webview, all four layouts, native Python editor opening and return. Runtime screenshots captured from the installed extension. |
| Real public-repository Git and source integration | **PASS — Flask matrix** | **7 extension-host tests and 3 installed-VSIX desktop tests** against the full pinned Flask history. Real commits/merges, clean HEAD/INDEX, historical snapshots, class/file blame, dirty/unsaved buffers, staged rename, untracked source, incremental indexing, source/anatomy navigation, visible blame code view, comparison actions and Sankey. See [retained evidence](validation/flask/README.md). |
| VSIX generation | **PASS** | `npm run package` produces `dist/xp-code-canvas-0.6.0.vsix`. Packaging metadata and exclusions corrected; test outputs, local validation runtimes, dependencies and nested VSIX files excluded. |
| Separate clean-profile installation | **PASS** | VS Code CLI installed the verified `dist` VSIX using isolated `.validation-runtime/install-profile` and `install-extensions` directories. `--list-extensions --show-versions` reports `xp-libs.xp-code-canvas@0.6.0`. |
| AI deferred roadmap | **INTENTIONALLY EXCLUDED** | `specs/AI_DEFERRED.md` was not implemented. No AI dependency, command or interface added. |

## Corrections verified during this continuation

- Fixed optional VS Code definition selection ranges, React Flow drag event types, typed fallback ports and ESLint errors. Browser/unit test files now receive semantic typechecking too.
- Replaced the initial fit race (one card at 280% zoom) with an explicit readiness phase. Named layout changes fit the resulting graph; normal viewport changes and dragging do not reset layouts.
- Moved browser ELK work into a local worker with a ten-second interactive budget and the existing deterministic source-order fallback. The webview CSP permits the bundled worker and nonce-authorized module loading.
- Large graphs provide estimated offscreen dimensions and typed/member handles. Visible cards replace estimates with DOM measurements, avoiding thousands of eager mounts while preserving canonical source evidence. No analyzer graph is rewritten by layout.
- Corrected source-anatomy controls to expose button semantics. Source expansion is checked against real browser card bounds for overlap.
- Corrected ExTester configuration and asynchronous startup waits, explicit extension-host activation, stale altitude labels and the SVG connector assertion. Horizontal stroked SVG paths legitimately have zero-height bounds; the test now verifies path geometry and stroke.
- Fixed Reset and Align to clear the intended V6 per-layout snapshots; added unit and browser regression coverage. Pre-optimized worker dependencies to prevent development cold-start reloads from discarding host messages.
- Real Flask validation corrected Windows analyzer pipe encoding (explicit UTF-8 for both workers), filesystem-relative source-root selection so clean HEAD does not falsely differ, exact-case class search ranking, search focus after asynchronous placement, and Git mode popovers blocking timeline controls.
- Added repository metadata required by VSCE and excluded local test/runtime artifacts from packaging. All existing non-AI feature paths were retained.

## Evidence and reproduction

Local command transcripts: `npm-ci-node22.log`, `unit-final.log`, `python313-test.log`, `browser-delivery.log`, `extension-delivery.log`, `desktop-delivery.log`, `package-final.log` and `install-final.log`. Logs and generated test resources are ignored by Git; the validation report and selected runtime PNGs are retained in docs. Runtime PNGs are evidence, **not approved visual-regression baselines**. Static compositions in `docs/visual/V6_STATIC_*` remain illustrative.

The real-repository continuation reran the gates in `unit-real.log`, `python-real.log`, `browser-ship.log`, `extension-ship.log`, `desktop-ship.log` and `real-repository-final.log`. The stronger installed flow/navigation case also passes in `real-desktop-flow.log`, with nonempty real import ribbons rather than only a valid empty view. Retained Flask service results include attribution spanning three historical filenames, 480 historical changed/impacted symbols, and a clean final clone. The ship artifact is rebuilt and verified after these checks; temporary clones, logs and test profiles remain ignored.

Visually inspected installed-extension evidence: [Architecture](visual/V6_RUNTIME_WINDOWS_ARCHITECTURE.png), [File mode](visual/V6_RUNTIME_WINDOWS_FILE.png), [Investigation mode](visual/V6_RUNTIME_WINDOWS_INVESTIGATION.png), [Changes mode](visual/V6_RUNTIME_WINDOWS_CHANGE.png). These capture the real fixture workspace in VS Code, including the native workbench. `python scripts/verify-vsix.py` checks ZIP integrity, runtime/analyzer files, identity, worker assets and packaging exclusions, and emits the artifact SHA-256.

Node **22.23.5** and npm **11.11.0** were available for the final target-runtime checks; initial runs used Node 24.14.1. Installed VS Code/ChromeDriver versions: **1.147.0 / 150.0.7871.250**. Python 3.13 test reproduction in this workspace:

```powershell
$env:COVERAGE_CORE='pytrace'
./.validation-runtime/python313/python.exe -m pytest -q python/tests --cov=python/src/xp_canvas_analysis --cov-branch --cov-report=term-missing
```

For a normal Python 3.13 installation, install `python/requirements-test.txt`, set `PYTHONPATH=python/src`, and run `npm run test:python`. Run `npm ci`, `npm run verify:fast`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run test:desktop-e2e`, and `npm run package` for the JavaScript/desktop gates. Windows desktop tests require an interactive desktop.

## Remaining release gates — not counted as passing

- **NOT EXECUTED:** physical Windows display scaling at 125%, 150% and 200%; native high-contrast theme matrix; actual screen-reader review. Browser emulation is not a substitute for those checks.
- **NOT EXECUTED:** Git scenarios beyond the retained Flask matrix, multi-root/nested-repository combinations and every multi-editor-group arrangement. The tested Flask clean/dirty/unsaved/staged-rename/history/blame/comparison cases and explicit group-2 source/anatomy navigation now pass; the installed UI also opens real source and returns to the canvas.
- **NOT EXECUTED:** real 1,000–5,000-symbol repository memory profiling, long-session stability, exhaustive crowded-label inspection and every pin/snapshot/expansion combination. Synthetic graph tests are bounded regression evidence.
- **NOT EXECUTED:** Linux VSIX installation, minimum supported VS Code 1.96 execution, CI jobs on hosted runners, marketplace publishing and approval of screenshot baselines.

The executed automated suite and Windows package checks can pass while these broader release gates remain open. This report does not certify unexecuted scenarios.
