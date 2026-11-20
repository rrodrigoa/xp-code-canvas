> **V4 update:** Read [`CODEX_V4_NEXT_STEPS.md`](CODEX_V4_NEXT_STEPS.md) first; this earlier document remains for inherited V2/V3 gates.

# Codex — finish and validate the V3 visual canvas on the V2/V4 architecture (not another rewrite)

Read `specs/CORE_V3.md`, `specs/PRODUCTION_ARCHITECTURE_V4.md`, and `docs/UI_VISUAL_SYSTEM_V3.md`. **AI features are not in scope.** Keep every existing UML interaction, Git feature and single-active-editor navigation. Do not rebuild the extension from scratch, replace the Python parser with a hand-written grammar, or introduce an AI SDK.

## Required sequence

1. Install Node.js 22 / Python 3.13 / VS Code locally. Run `npm install` with network access, commit the genuine `package-lock.json`, switch CI to `npm ci`, pin resolved dependencies and document any advisories.
2. Run `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build`, and `npm run package`. **Fix actual TS/react/vscode API errors**. No fake stubs to suppress them.
3. Run `npm run test:canvas-e2e` with Playwright/Chromium and `npm run test:extension` in the real VS Code Extension Development Host. Expand coverage of lazy source preview, graph delta revision recovery, source stale edit protection, node drag/pins and viewport state.
4. Run actual packaged VSIX Windows desktop tests with ExTester. Automate opening a Python fixture project, UML → native editor → edit → return to canvas, then restart and verify state persistence. Avoid creating a separate permanent editor panel.
5. Finish the following V4 production hardening work not fully implemented in V3: cancellation/backpressure for very large indexing batches, robust multi-root workspace change reinitialization, per-language-provider source reconciliation tests, view virtualization for very large graphs, more complete dynamic Python resolution (never assert uncertain calls as exact), multi-root/remote + Git rename fixtures, separate view-session ACK conflict tests, full keyboard/high-contrast audit, and performance budgets.
6. Test Git history/index/current/unsaved comparisons with real temporary repositories and file moves; maintain immutable Git baselines and conservative impact/correspondence statuses. Enforce complete V3 requirement traceability in the test matrix.
7. Run all Windows and Linux CI jobs. Update `docs/VALIDATION_REPORT.md` with actual PASS/FAIL/BLOCKED results and produced `dist/xp-code-canvas-0.3.0.vsix`. Never report unexecuted tests as passed.

## Required verification commands

```powershell
npm install
npm run typecheck
npm run lint
npm run test:python
npm run test:visual-smoke
npm run test:unit
npm run build
npm run test:canvas-e2e
npm run test:extension
npm run package
npm run test:desktop-e2e
```

## Architecture invariants

- Only `src/extension` imports the `vscode` runtime; `src/core` and `src/shared` have no VS Code runtime dependency. The Python worker cannot import project modules.
- Canonical `GraphSnapshot` never contains UI coordinates, source body strings, AI output or Git ghosts. AST source spans are UTF-16 when crossing into TypeScript.
- Every graph edge has source evidence or explicitly remains unresolved. No false confirmed calls due to parameters, local variables, dynamic dispatch or imported alias rebinding.
- GraphStore rejects duplicate IDs, dangling edges and stale revisions. The webview requests a full graph when a delta cannot be applied.
- The extension host owns the persistent session; the webview is an optimistic replica. Node drag never writes Python code.
- Do not implement or wire `specs/AI_DEFERRED.md`.

## V3 visual hardening gates before release

1. Run `npm run test:visual-smoke` and Vitest visual tests; fix actual failures, not test assertions.
2. Build and inspect V3 UI in both dark and light VS Code themes; verify Win/Linux Ctrl+wheel and Mac Cmd+wheel, ordinary-wheel scroll isolation in the source preview, and pointer-centered zoom without browser-level zoom.
3. Test Git history topology with actual temporary `git init` fixture, commits and two-parent merges. Confirm `getGitHistory` message validation and no history fabricated when Git is missing.
4. Run Playwright mouse and Git drawer tests, inspect focus layout and layout dimension estimates for classes with many methods and docstrings, and test label collision behavior.
5. Audit responsive widths, reduced motion and high contrast; run Windows packaged VSIX and VS Code native editor round-trip tests.
6. Keep the Git drawer and inspector transient; do not introduce additional permanently docked editor panels or a second inline source editor.
