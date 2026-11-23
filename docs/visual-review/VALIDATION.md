# Visual Review V7 — executed verification and shipping gates

## Proven in this environment

- **Python analyzer + Git scope fixtures:** `PYTHONPATH=python/src python -m pytest -q python/tests`: **39 passed** (existing tests + new comparison test fixture).
- **Review visualization pure functions:** `node scripts/review-standalone-smoke.cjs` — PASS: direct vs possibly affected nodes, comment anchors, badge aggregation and metrics.
- **Review comments persistence:** `node scripts/review-notes-contract-smoke.cjs` — PASS: local create/reply/resolve/reopen/delete, inspected files, published flag, isolation and reload.
- **GitHub request/response mock:** `node scripts/review-api-contract-smoke.cjs` — PASS: metadata, GraphQL threads, inline/general comment APIs, replies, resolution, review submission, edit/delete. **Mock server, not GitHub production.**
- **TypeScript syntax parse:** all `src` and `tests` TS/TSX parsed using a locally installed global TypeScript compiler. This checks syntax only, not semantic type safety.
- **CSS parse:** `tinycss2` parser applied to visual review stylesheet.
- **ZIP and patch:** tested with ZIP integrity and `git apply --check` against the same V6.1 reference snapshot used for implementation.

## NOT executable here; required before declaring ready to ship

- npm dependency installation and `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run test:desktop-e2e`, `npm run package`, and a clean-profile VSIX installation. The container has **no npm dependency tree / registry access**; do not count authored tests as executed.
- Automated extension-host GitHub token/UI action tests in a real VS Code host (no published review mutations in CI).
- A real or intentionally disposable GitHub test PR to confirm GraphQL review threads, permissions, post/edit/delete/resolve/reopen, approval rules, and position mapping.
- A clean merge with the user's **unpublished local V6.1**: that branch includes Codex changes not present in the reference ZIP. The overlay must be reconciled with the real checkout.
- Accessibility in an installed extension, high-contrast and Windows scaling, large real-world repository stress and multi-hour session performance.

**Release classification:** development integration package / feature patch. **Not certified VSIX, not shipped.**
