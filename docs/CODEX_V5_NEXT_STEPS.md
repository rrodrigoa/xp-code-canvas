# Codex — finish production V5

Read `docs/V5_USER_JOURNEY_AUDIT.md`, `specs/V5_CORE_USABILITY.md`, `docs/VALIDATION_REPORT.md`, plus existing V3/V4 product specifications.

1. Install npm dependencies and create/commit a lockfile (`npm install`, then `npm ci` in CI); verify `npm run typecheck`, `npm run lint`, `npm run build` and `npm run test:unit`. Fix any errors rather than changing the UX contract.
2. Run Playwright tests including `tests/browser/v5-navigation-blame.spec.ts`; fix brittle selectors and ensure both light and dark themes.
3. Launch real Extension Development Host, verify node → native-editor region navigation and return to canvas without extra editor groups. Run `npm run test:extension` and Windows desktop tests.
4. Test Git blame against a disposable real Git repository with clean HEAD, staged modifications, unstaged modifications, unsaved VS Code documents, renamed files, UTF-16 lines, deleted or ignored paths and a large file. Invalid mapping must never show attribution.
5. Validate layout spacing after code anatomy and blame cards expand, even when multiple nodes are pinned. Add incremental reflow tests, accessibility checks and automated screenshots at common zoom levels.
6. Verify the complete V3/V4 non-AI requirement traceability is still intact (UML, four altitudes, semantic zoom, Sankey, Git, file-focus layout, native source editing, worker lifecycle, graph deltas and packaging).
7. Package with `npm run package`, install the resulting VSIX in a fresh VS Code profile and update `docs/VALIDATION_REPORT.md` with the actual results.

Do not implement AI explanations, AI guided architecture walkthroughs, Codex/agent CLI or any feature from `specs/AI_DEFERRED.md`.
