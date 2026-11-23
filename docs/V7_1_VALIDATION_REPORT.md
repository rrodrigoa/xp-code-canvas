# V7.1 executed validation report

Date: 2026-11-21. Baseline: V7 reference ZIP, built on V6.1 reference. Local user's unpublished Codex checkout was not available in this runtime.

| Test gate | Actual result | Evidence |
|---|---|---|
| Python AST analyzer regressions | **PASS** | `python -m pytest -q python/tests`: **39 passed** |
| TypeScript/TSX syntax parser | **PASS — syntax only** | `node scripts/verify-v71-syntax.cjs`: **105 files, 0 parse errors** |
| Semantic zoom + Change Atlas | **PASS — independent runtime smoke** | `node scripts/v71-smoke.cjs`, including 5,000 changed synthetic symbols |
| Guarded inline source edits | **PASS — mock VS Code service smoke** | `node scripts/v71-services-smoke.cjs`: successful WorkspaceEdit, hash conflict rejection, baseline-only rejection |
| Git line overlay | **PASS — local Git fixture smoke** | Same script: committed `agent.py` baseline, unsaved changed document, added line and removal evidence |
| V7.1 Vitest suites | **AUTHORED; NOT EXECUTED** | `tests/unit/semanticZoomV71.test.ts`, `reviewAtlasV71.test.ts` |
| VS Code extension-host V7.1 test | **AUTHORED; NOT EXECUTED** | `tests/extension/inlineEditV71.test.ts` |
| Browser/Playwright V7.1 | **AUTHORED; NOT EXECUTED** | `tests/browser/visualReview71.spec.ts` |
| Full TypeScript semantic/type checks, lint, Vite, VSIX | **NOT EXECUTED** | npm registry access failed with DNS `EAI_AGAIN`; no suitable local dependency tree |
| Installed VS Code desktop / GitHub PR live mutation test | **NOT EXECUTED** | Needs a Windows interactive VS Code instance and user's local unpublished integration |

The passing mock tests do not certify full VS Code behavior. No production-ready VSIX was produced by this V7.1 task. Do not mark these release gates as passed without real executed evidence.

Reproduction on the user's **local repository**, after integrating the additive changes:

```powershell
npm ci
python -m pip install -r python/requirements-test.txt
npm run typecheck
npm run lint
npm run test:python
npm run test:unit
npm run build
npx playwright install chromium
npm run test:canvas-e2e
npm run test:extension
npm run test:desktop-e2e
npm run package
```

Required acceptance scenarios:

1. Open a 20+ file PR or a local working/unstaged/staged comparison. Verify Atlas includes changed Python methods and documentation/test/config files; unchanged nodes remain faded and changed edges are distinguishable.
2. Navigate Atlas → method → code; compare native diff to green inline source-line overlays. Removed-line counts must be measured against Git and never inferred from current source lines alone.
3. Resize the source node, edit, save, undo and redo in native VS Code. Test LF and CRLF, UTF-16/surrogate-pair cursor positions, unsaved buffers and concurrent external changes. Stale writes MUST be rejected without mutation.
4. Verify staged, branch and PR snapshots do not allow unsafe in-node mutation of historical code. Editing a current file should not stage or publish any content.
5. Drag each of the three zoom rail markers by pointer and keyboard. Check exact user-defined thresholds, min separation, persistence after reload, no unrelated auto-layout, high contrast, 125%/200% Windows scaling, and minimap/lens coexistence.
6. Large code graph, collapsed and expanded symbols, Alt+Back/Forward navigation, V6.1 spread recovery, Git blame and V7 discussions must continue working.

The V7.1 changes must not be described as ready for public release until these pending gates have passed on the real local checkout.
