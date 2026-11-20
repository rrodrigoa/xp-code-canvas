# XP Python UML Canvas — V6

A **VS Code extension** for exploring Python repositories through interactive, source-backed UML diagrams and Git history. V6 is a visual and interaction engineering release built incrementally on V5. The Windows build, packaged desktop tests and validation limits are recorded in `docs/VALIDATION_REPORT.md`. AI explanations, AI walkthroughs and agent integration remain intentionally deferred.

## What the product does

- **Architecture as a canvas:** navigate packages, modules, classes, functions and methods, with UML-specific connections and source evidence. Select a Python file to align its symbols in source order while retaining caller/dependency context.
- **Semantic zoom and function anatomy:** inspect compact UML boxes, colored constructs and source-backed control-flow regions, then expand an individual box into read-only code. Open that exact source position in the **native VS Code editor in the same group** and return to the canvas.
- **Direct manipulation:** drag connected nodes, pin deliberately, and preserve positions for each layout. Normal wheel scrolls source or pans; Ctrl/Cmd+wheel zooms around the cursor. No separate permanent source/editor panel.
- **Git intelligence:** local semantic comparisons, Git timeline, line-level blame of clean tracked revisions, author summaries and change-versus-possible-impact highlighting. Git attribution identifies the *last modifying commit*, not the original author or a code owner.
- **UML and Flow lenses:** conventional UML links alongside an alternative static-relationship Sankey lens. Ribbon width means source-reference/callsite **counts**, not measured runtime traffic.

## V6 improvements

| Workstream | What changed |
|---|---|
| P0: layout stability | Four named layouts (Architecture, File focus, Investigation, Changes); source-order placement; React Flow DOM measurements with local collision correction; type-aware card widths; saved per-layout positions; explicit pin preservation |
| P1: usability | Compact primary toolbar with optional advanced controls; contextual node actions; keyboard-searchable symbols; focused breadcrumbs; graph-specific typed ports and source-backed member-level attachments; global contextual edge-label placement; offscreen-node rendering optimization |
| P2: visual integration | Unified VS Code theme tokens; separate colors for code kind, Git changes and selection; Git Changes/Blame/History control; contextual attribution; consistent Sankey style; responsive and accessible controls |
| P3: engineering quality | Source-level layout/port/search test contracts; TypeScript/Playwright test sources; responsive/dark/light/200% static design previews; Windows/Linux CI definitions and remaining release gates |

The entire V3/V4/V5 non-AI feature scope remains. The canonical Python analysis graph is separate from visual projections. Layout operations do not edit Python source or change canonical relationship evidence.

## Repository organization

```text
src/extension/         VS Code commands, indexing, Git services, worker and navigation
src/core/              Versioned graph contracts and graph services
src/shared/            Source-backed graph, semantic zoom and Git representations
src/webview/           React Flow UI, interaction controller, layouts and visual layers
src/webview/styles/    V6 focused theme and component CSS modules
python/                Offline Python AST and lexical-scope analyzer, tests and worker
scripts/               Build utilities and visual smoke checks
tests/unit/             Graph/UI algorithms and data-contract tests
tests/browser/          Playwright canvas interaction and screenshot checks
tests/extension/        VS Code Extension Host tests
tests/desktop/          Desktop interaction tests
docs/visual/            Static design compositions (NOT live VS Code screenshots)
specs/                 Core product definitions and separate deferred AI roadmap
```

## Develop on Windows (PowerShell)

Requirements: **Node.js 22**, **Python 3.13**, VS Code **1.96+**, a working npm registry, and Git.

```powershell
# Run in the extracted repository root
npm ci --no-audit --no-fund
python -m pip install -r python/requirements-test.txt
npm run typecheck
npm run lint
npm run test:python
npm run test:visual-smoke
npm run test:visual-v6
npm run test:unit
npm run build
```

Open the repository in VS Code and press **F5** to launch the Extension Development Host. Open a Python workspace, run **Python UML Canvas: Open UML Canvas** from the command palette, and select a file or symbol.

Further verification before release:

```powershell
npx playwright install chromium
npm run test:canvas-e2e
npm run test:extension
npm run test:desktop-e2e
npm run test:real-repo
npm run package
```

A genuine `package-lock.json` was generated with npm and verified with `npm ci`. CI installs the locked dependencies. Use a current Node 22 release (validated with 22.23.5).

`npm run test:real-repo` clones the full public Flask history into ignored `.validation-runtime/temp/flask`, pins revision `49943b5a94413a530761350f04e896f76e8d620e`, and runs real VS Code service and installed desktop tests. It requires network access on first use and an interactive Windows desktop. Flask itself is never imported or executed. The tests restore all temporary edits and require the clone to be clean before and after the run. Results and screenshots are written to `test-results/real-repository`; retained evidence and Flask's license are in `docs/validation/flask`.

## Known validation boundary

**Executed:** full TypeScript semantic checks including browser and unit test sources; lint; 61 unit tests; 38 Python analyzer tests with 91% coverage; both visual algorithm suites; React/extension builds; Playwright interactions and 100/1,000/5,000-symbol cyclic layouts; VS Code extension-host and installed Windows desktop tests; VSIX packaging. See the validation report for final counts and artifact installation evidence.

**Unverified:** physical Windows display scaling, assistive-technology review, Git scenarios beyond the documented Flask matrix, Linux VSIX installation and minimum-version VS Code compatibility. Browser device scaling is tested separately from Windows display scaling. Static preview images remain illustrative; runtime desktop captures are identified separately.

Read [`docs/VALIDATION_REPORT.md`](docs/VALIDATION_REPORT.md) for exact results and [`docs/V6_CODEX_NEXT_STEPS.md`](docs/V6_CODEX_NEXT_STEPS.md) for the Codex continuation checklist. The visual design is described in [`docs/V6_VISUAL_ARCHITECTURE.md`](docs/V6_VISUAL_ARCHITECTURE.md) and prior architecture in [`specs/PRODUCTION_ARCHITECTURE_V4.md`](specs/PRODUCTION_ARCHITECTURE_V4.md).

## Important product constraints

- The code and Git data remain local; the analyzer must not import or execute user projects.
- Unsaved Python text is authoritative for the live graph. Git blame is only attributed to source genuinely matching a historical revision; dirty or unsaved text must not be assigned false authorship.
- Python dynamic dispatch and monkey-patching cannot always be resolved statically. Uncertain relationships must be marked uncertain, not presented as confirmed.
- The standard VS Code editor remains the *only full editing surface*. The graph source viewer is read-only.
- **AI features are excluded:** see `specs/AI_DEFERRED.md` solely for future work. Do not add AI dependencies, agent commands or mock AI interfaces to the core product.

MIT license. Review the validation report and remaining manual release gates before publishing.
