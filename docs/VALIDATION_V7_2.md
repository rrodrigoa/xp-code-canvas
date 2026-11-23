# V7.2 — Validation and release boundary

**Source basis:** `XP_Code_Canvas_Visual_Review_V7_1_Source.zip` (reference, not the user's unpublished local checkout). The additive patch is intended for a three-way/semantic merge with the user's actual local version.

## Executed in this delivery environment

- `python -m pytest -q python/tests`: **39 passed**.
- `python -m unittest discover -s studies/v72 -p 'test_*.py'`: **1 passed**, offline study scoring harness.
- `NODE_PATH=<global npm modules> node scripts/v72-review-smoke.cjs`: **passed** with 5,000 symbols and 250 changed structural records. Verified frame memberships, source-unsupported test status, and review invalidation.
- TypeScript compiler syntax/transpilation of all source and test TS/TSX: see terminal check log in handoff. This checks syntax, **not** semantic types or production bundling.
- Git patch generated against a clean V7.1 reference and checked for applicability; ZIP integrity check executed at packaging.

## Not executed — Codex must close these gates

- Full dependency install (`npm install --offline` returns `ENOTCACHED` for `@eslint/js`; live npm install timed out).
- `npm run typecheck`, ESLint, Vite/React build, Vitest, Playwright/Chromium, VS Code Extension Host, Windows desktop, and VSIX production packaging.
- GitHub PR remote integration, complex historical diffs (multiple roots, renamed symbols, huge binary fixtures), physical Windows high-DPI/high-contrast, screen-reader tests, long-session memory and real-user comprehension study.
- Installation against the user's **actual unpublished local checkout**. No local code was overwritten or pushed.

## Required exact release tests

1. `npm ci` (generate and commit a real lockfile if missing); `npm run typecheck && npm run lint`.
2. `npm run test:unit && npm run test:python && npm run test:v72-smoke && npm run test:v72-study`.
3. `npx playwright install chromium && npm run test:canvas-e2e`: include `tests/browser/changeCognitionV72.spec.ts`, inspect DOM geometry and keyboard navigation.
4. `npm run test:extension && npm run test:desktop-e2e`; verify actual installed V7.2 VSIX, not just a mock canvas.
5. Open a real large changed Python repo (20+ edited files) and verify switching Before/Delta/After preserves positions, nested source shows correct labels, Git-related overlays don't disappear, comments are disabled on historical frames, and open/close reuses review state.
6. Validate stale-source correction against edits to Python, README/Markdown, tests and staged blobs. Verify a changed PR head invalidates prior review progress. Ensure unknown test status never turns into passed.
7. Validate PRs with inaccessible Git commits: no fabricated graph change facts or historical source. Verify missing or malformed Git refs rejected.
8. Run `npm run package`; inspect VSIX contents and install with `code --install-extension <file>.vsix` in a clean VS Code profile. Record screenshots, logs and release artifact hash.
9. Conduct optional usability study using `studies/v72/` with informed consent and counterbalanced review tasks. Until real participant evidence exists, report **NOT CONDUCTED**, not PASS.

This source package must **not** be described as a release-validated extension until the blocked gates pass in the actual local checkout.
