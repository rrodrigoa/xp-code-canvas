# V3 core / V4 architectural traceability (V3 implementation)

Status vocabulary: **IMPLEMENTED** = source feature exists; **TESTED** = executed tests support it; **BLOCKED** = code requires dependencies or actual VS Code environment; **PARTIAL** = known missing scope. A source-level implementation is not proof of end-to-end operation.

| Requirement | Location | Status |
|---|---|---|
| UML syntax and Python nodes | `src/webview/components/UmlNode.tsx`, `UmlEdge.tsx` | IMPLEMENTED; browser verification BLOCKED |
| Architecture/package/module/code levels | `src/shared/graph.ts`, `src/webview/App.tsx` | IMPLEMENTED; browser BLOCKED |
| File focus and vertical alignment | `src/shared/layout.ts`, `src/webview/App.tsx` | IMPLEMENTED; browser BLOCKED |
| Drag, pins, edge attachment, persistence | React Flow, `src/webview/store.ts`, `ViewSessionService.ts` | IMPLEMENTED; desktop BLOCKED |
| Semantic zoom to real source | `SourcePreviewService.ts`, `UmlNode.tsx` | IMPLEMENTED; browser BLOCKED |
| Same-editor native navigation | `NativeEditorNavigator.ts`, `CanvasController.ts` | IMPLEMENTED; desktop BLOCKED |
| Dependency/caller tracing | `src/shared/graph.ts` | IMPLEMENTED; TS tests BLOCKED |
| Source-backed Python AST | `python/src/xp_canvas_analysis` | TESTED |
| Lexical name resolution and dynamic-call caution | `semantics/scopes.py`, `semantics/calls.py` | TESTED on 33 Python tests; type-aware completeness PARTIAL |
| UTF-16 span mapping and decorators | `syntax/source_positions.py`, `symbol_extractor.py` | TESTED |
| Duplicate declarations and ID reconciliation | `graph/identities.py` | TESTED for duplicate/reorder cases |
| Syntax error recovery | `session.py` | TESTED |
| Persistent worker and incremental parsing | `protocol.py`, `PythonWorkerClient.ts`, `IndexCoordinator.ts` | Python TESTED; extension restart BLOCKED |
| Canonical V2 graph and validators | `src/core/contracts/graph.v2.ts`, `GraphStore.ts` | IMPLEMENTED; Vitest BLOCKED |
| Versioned deltas and snapshot recovery | `GraphDelta.ts`, `App.tsx`, `store.ts` | IMPLEMENTED; browser BLOCKED |
| Host-only source snapshots and lazy previews | `VsCodeSourceRepository.ts`, `SourcePreviewService.ts` | IMPLEMENTED; desktop BLOCKED |
| Optional public language-provider enrichment | `VsCodeLanguageProvider.ts` | IMPLEMENTED; real Pylance/provider test BLOCKED |
| Semantic Git diffs, impact, baseline ghosts | `gitSnapshot.ts`, `GitCompareService.ts`, `semanticDiff.ts` | IMPLEMENTED; realistic rename fixture PARTIAL |
| Local Git batch/cached data | `gitSnapshot.ts`, `GitTree.ts` | IMPLEMENTED; Vitest BLOCKED |
| Workspace trust/CSP protections | `package.json`, `WebviewHost.ts` | IMPLEMENTED; VS Code verification BLOCKED |
| Multi-root/remote support | `VsCodeSourceRepository.ts`, `IndexCoordinator.ts` | PARTIAL; workspace folder change restart needed |
| Large workspace progressive rendering | 1,000-file Python tests; React Flow UI | Analyzer TESTED; rendering/virtualization PARTIAL |
| Pinned reproducible TS installs | `package.json`, `.github/workflows/ci.yml` | BLOCKED on npm registry / missing lock |
| Test/CI/VSIX release gates | `tests/`, `.github/`, `docs/VALIDATION_REPORT.md` | Python TESTED; rest BLOCKED |
| AI explanations, walkthroughs, agent CLI | `specs/AI_DEFERRED.md` documentation only | INTENTIONALLY EXCLUDED |

## V3 visual quality traceability

| Requirement | Location | Status |
|---|---|---|
| Wheel pans, modifier zoom anchored anywhere | `src/webview/interaction.ts`, `App.tsx` | Implemented; pure algorithm smoke PASS, browser BLOCKED |
| Source preview scroll isolation | `UmlNode.tsx`, `App.tsx` | Implemented; Playwright BLOCKED |
| VS Code-native style tokens, accessible actions | `app.css`, `CanvasToolbar.tsx`, `UmlNode.tsx` | Implemented; desktop/hc visual tests BLOCKED |
| Typed UML edges, contextual labels | `UmlEdge.tsx`, `edgeLabels.ts` | Label collision pure smoke PASS; browser BLOCKED |
| Source-order central file with caller/dependency lanes | `elkLayout.ts` | Pure layout smoke PASS; renderer BLOCKED |
| Global ELK size-aware layout and pin preservation | `elkLayout.ts` | Pin smoke PASS; ELK runtime BLOCKED |
| Git history branch lanes, commit dots, ref chips | `gitHistory.ts`, `GitHistoryService.ts`, `GitTimeline.tsx` | Pure Git topology smoke PASS; real Git/browser BLOCKED |
| Single-surface in-canvas overlays | `App.tsx`, `GitTimeline.tsx`, `CanvasInspector.tsx` | Implemented; desktop BLOCKED |
| V3 visual sample (illustrative only) | `docs/V3_VISUAL_PREVIEW.html`, `.png` | Static screenshot captured; not a VS Code runtime verification |

## V4 semantic anatomy, color and Sankey traceability

| Requirement | Implementation | Status |
|---|---|---|
| Four progressive semantic visual tiers with selected-only source | `src/shared/semanticVisuals.ts`, `src/webview/App.tsx`, `UmlNode.tsx` | Runtime pure tier contract PASS; browser BLOCKED |
| Canonical, source-backed colored construct blocks | `createStructureIndex`, `summarizeStructure`, `StructureMap.tsx` | Index consistency smoke PASS; React renderer BLOCKED |
| Theme-compatible semantic-role colors, separate Git markers | `app.css`, `UmlNode.tsx` | CSS parse PASS; theme/device testing BLOCKED |
| File grouping frames and tier-aware auto-layout | `ScopeFrames.tsx`, `elkLayout.ts` | Geometry smoke PASS; real React/ELK integration BLOCKED |
| One-tab UML ↔ Sankey lens with peer selection | `SankeyLens.tsx`, `CanvasToolbar.tsx`, `App.tsx` | Implemented; Playwright BLOCKED |
| Source-backed relationship concentration and honest units | `flowLens.ts`, `SankeyLens.tsx` | Pure smoke PASS; Vitest blocked on npm |
| Keyboard peers and accessible numeric table | `SankeyLens.tsx` | Implemented; E2E accessibility audit BLOCKED |
| Non-AI scope preserved | `specs/AI_DEFERRED.md` | AI remains documentation-only |


## V5 additive usability and Git attribution (non-AI)

- Navigation history: `src/webview/store.ts`, `CanvasToolbar.tsx`, `App.tsx` (Back/Forward, breadcrumbs).
- Git blame: `src/extension/services/GitBlameService.ts`, `src/shared/blame.ts`, `BlameSummary.tsx` and native source gutter.
- Function internal anatomy: `python/src/xp_canvas_analysis/syntax/anatomy.py`, `FunctionAnatomy.tsx`.
- Verified source-region navigation: `NativeEditorNavigator.ts`, `CanvasController.ts`, `viewState.ts`.
- Change emphasis: `App.tsx`, `app.css` (direct versus impact).
- V5 tests: `python/tests/test_anatomy_v5.py`, `tests/unit/gitBlameV5.test.ts`, V5 unit layout and browser tests.
- Product/UX contract: `specs/V5_CORE_USABILITY.md`, `docs/V5_USER_JOURNEY_AUDIT.md`.
- AI roadmap unchanged and not implemented.
