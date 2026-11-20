# V6 visual workstreams — source traceability

Validation was continued on Windows on 2026-11-19. Automated results below are executed evidence, with detailed scope and remaining manual gates in `docs/VALIDATION_REPORT.md`. All non-AI V1–V5 features and specifications are retained. This is additive to `docs/TRACEABILITY.md`.

| Workstream | Implementation | Verification |
|---|---|---|
| P0 — four layouts | `src/webview/layout/LayoutOrchestrator.ts`, `App.tsx`, state contracts | **PASS**: unit/visual smoke, browser cyclic graphs at 100/1,000/5,000 symbols, installed Windows webview |
| P0 — measured collision correction | `settleMeasuredLayout`, React Flow dimension event listener | **PASS**: pure 1,500-node benchmark and browser source-expansion DOM overlap check |
| P0 — per-layout positions and explicit pins | `src/webview/store.ts`, `src/core/contracts/viewState.ts` | **PASS**: unit contracts and browser drag/persistence; exhaustive manual snapshot review remains open |
| P0 — adaptive cards and theme tokens | `UmlNode.tsx`, `UmlCardHeader.tsx`, `styles/{tokens,nodes}.css` | **PASS**: browser dark/light token screenshots, forced colors, device scales 1.25/1.5/2; installed desktop runtime captures |
| P1 — compact toolbar/advanced controls | `CanvasToolbar.tsx`, `styles/chrome.css` | **PASS**: running browser interactions and 960/1440px overflow checks |
| P1 — contextual UML controls | `components/ui/UmlCardHeader.tsx`, `UmlNode.tsx` | **PASS**: source expansion, blame request and native editor opening |
| P1 — ranked keyboard search | `navigation/symbolRanking.ts`, `components/ui/SymbolSearch.tsx` | **PASS**: ranking units and keyboard browser selection at device scales 1.25/1.5/2 |
| P1 — source-backed relationship ports | `graph/MemberPortProjection.ts`, `graph/EdgeRoutingService.ts`, `graph/EstimatedHandles.ts`, `UmlNode.tsx` | **PASS**: member/bundle algorithm contracts, rendered SVG path checks and virtualized large graph runs |
| P1 — collision-avoiding labels and reduced offscreen rendering | `EdgeRoutingService.ts`, `UmlEdge.tsx`, `App.tsx` | **PASS**: pure label geometry and 5,000-symbol browser run; exhaustive crowded-label visual review remains open |
| P2 — contextual Git modes and blame | `components/ui/GitCommandStrip.tsx`, `GitTimeline.tsx`, `CanvasInspector.tsx` | **PASS**: unit/browser contracts plus full-history Flask service and installed UI tests: clean/dirty/unsaved/staged rename, actual blame/code provenance, history and comparisons; see `docs/validation/flask` |
| P2 — semantic colors/Sankey | `styles/{git,sankey,edges}.css`, `SankeyLens.tsx` | **PASS**: browser UML/Sankey switching and relationship-kind selection; static counts remain source based |
| P3 — visual/regression test sources | `tests/unit/v6*.test.ts`, `tests/browser/v6*.spec.ts`, `.github/workflows/ci.yml` | **PASS**: 61 unit, 23 Playwright, 38 Python, 2 basic + 7 Flask extension-host and 2 basic + 3 Flask installed desktop tests; hosted CI execution itself not claimed |
| P3 — dark/light/narrow/200% design compositions | `docs/visual/`, `scripts/render-v6-prototype.py` | Static render **TESTED**; not running extension |
| AI roadmap | `specs/AI_DEFERRED.md` | Deliberately **NOT IMPLEMENTED** |
