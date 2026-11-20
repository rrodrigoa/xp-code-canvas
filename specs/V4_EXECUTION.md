# Codex — Execute the XP Python UML Canvas V4 Production Refactor

## Role

Act as a Distinguished Engineer and delivery owner. Improve the **existing** `XP_Python_UML_Canvas_Starter_V1` repository rather than creating a different extension. Respect all requirements in `specs/CORE_V3.md`; treat `XP_PYTHON_UML_CANVAS_PRODUCTION_ARCHITECTURE_V4.md` as the definitive internal architecture and migration blueprint. `specs/AI_DEFERRED.md` is **out of scope**.

This is an implementation instruction, not a request for another proposal. Work through the phases, in order, validating each with tests and a runnable extension. If a tooling or environment limitation prevents a test, mark it BLOCKED with the actual reason; do not invent a result.

## Do not change the product experience

Keep native VS Code Python editing and the single-active-editor surface. The UML canvas is the other editor tab in the same editor group; it must preserve file-focused vertical alignment, dragging/pins, attached edges, class compartments, semantic zoom to read-only source, Open in Editor, Return to Canvas, four abstraction levels, caller/dependency exploration, Git semantic diffs, and original UML notation. Do not introduce an extra permanent sidebar, a second embedded code editor, AI functionality, cloud access, or a custom Python grammar.

## Work procedure

**Before each phase:** inspect the current code, read the relevant V3 sections, record a small phase plan and risk. **During each phase:** implement new interfaces and adapters, write regression tests first for identified failure cases, migrate one working path at a time. **After each phase:** run Python tests, TS typecheck/unit tests, and the available integration/browser checks; update `docs/VALIDATION_REPORT.md` and document any remaining gaps. Every changed public contract must have schema/versioned tests. No feature deletions or fake placeholder implementations to make tests green.

### Phase P0 — Establish actual baseline

- Commit real npm lockfile and pinned Python test setup; use `npm ci` in CI.
- Install dependencies, run `npm run build`, Python and TypeScript tests, the extension-host suite and browser suite. Attempt VSIX packaging and desktop UI where the environment supports it.
- Produce `docs/BASELINE_AUDIT.md` stating actual outcomes, existing sources and limitations.
- Preserve the original starter in a Git commit/tag for rollback.

### Phase P1 — Canonical graph / view contract V2

- Introduce versioned `DocumentSnapshot`, `Symbol`, `Relation`, `RelationshipEvidence`, `GraphSnapshot`, `GraphDelta`, `ViewNode` and `ViewEdge` contracts with runtime validation.
- Implement graph validators and typed message envelopes (requestId/revision/source versions/ACK/cancellation).
- Preserve a V1 compatibility adapter until frontend and analyzer are migrated. Move semantic groupings out of canonical data.
- Require unique declaration IDs and repeated-evidence preservation. Add schema-migration and malicious/out-of-order message tests.

### Phase P2 — Correct Python semantics

- Extract `python/analyzer.py::build` into a Python package: parser, declaration inventory, lexical scopes, import resolver, call resolver, class inheritance, evidence, identity and graph builder.
- Do **not** write a Python parser or use dynamic project import. Keep `ast`, optionally `symtable`.
- Implement a source coordinate converter from AST UTF-8 byte positions to VS Code UTF-16 positions.
- Handle local parameter shadowing, `global`/`nonlocal`, aliasing, nested scopes, imports and source roots with conservative resolved/possible/unresolved semantics.
- Make duplicate declarations distinct. Include source decorators in preview ranges. Preserve both callsites in `f(); f()`.
- Preserve last good per-file symbols with stale/diagnostic state during syntax errors. Guard source navigation against stale versions.
- Start by adding and passing the tests from `validation/test_current_analyzer_gaps.py` included in this pack. These are **expected to fail** against the V1 starter and must not be weakened.

### Phase P3 — Incremental indexing and reliable process transport

- Introduce `SourceRepository`, `DocumentSnapshotCache`, `IndexCoordinator`, persistent isolated Python `WorkerClient`, reverse-dependency reconciliation, cancellation and atomic graph commits.
- Respect unsaved buffers and multi-root URIs; remove the 350-file limit by incremental indexing and UI projection.
- Reject late worker results and show partial/stale state without clearing a usable graph.
- Add worker-crash, malformed-protocol, cancellation, out-of-order source changes and 1,000-file fixtures.

### Phase P4 — Optional VS Code language-provider enhancement

- Add a provider-neutral source-backed enrichment service using public VS Code symbol/definition/reference/call-hierarchy APIs when available.
- Index reliably when Pylance/Pyright is not installed; do not call private language server internals.
- Track source evidence/provider confidence; dynamic dispatch remains possible/unresolved rather than fabricated.

### Phase P5 — UI and session ownership

- Split `CanvasController`, native editor navigation, session persistence, webview RPC host, graph projection, graph store and React Flow presentation.
- Canonical view session lives in the extension host; webview Zustand holds transient/optimistic UI replica with revision ACK.
- Implement lazy source preview requests by symbol id/version; remove full source text from full graph payload. Preserve source decorators.
- Make vertical file alignment, re-align, pins, source zoom, ancestry, traces and Git overlays consistent at all abstraction levels. Keep the exact V3 UML line/icons semantics.
- Execute full single-active-surface acceptance: canvas -> native editor -> edit -> canvas -> restart.

### Phase P6 — Git history / semantic diff

- Use a safe, bounded local Git adapter with batch object access/cache; compare commits/index/current/unsaved snapshots.
- Keep baseline graph immutable and ghosts in the view projection. Preserve every callsite evidence and distinguish certain vs possible impacts.
- Test against deterministic Git-history fixtures including file moves, deleted nodes, signature edits and nested symbols.

### Phase P7 — Hardening and release

- Add performance budgets/telemetry-free local diagnostics, CSP/trust protections, URI/remote checks, high contrast, keyboard accessibility and error UX.
- Enforce module import boundaries and graph invariants in CI. Run full Windows + Linux test matrices, packaged VSIX installation smoke, real desktop navigation and performance fixtures.
- Generate `docs/VALIDATION_REPORT.md` with commands, environment, PASS/FAIL/BLOCKED evidence, and a V3 requirement-by-requirement traceability matrix. Fix every release-blocking FAIL.

## Mandatory correctness tests

1. Parameter shadowing cannot create a false imported call relation.
2. Repeated declarations in the same scope have distinct node IDs.
3. AST UTF-8 byte offsets are converted correctly to UTF-16 VS Code columns, including emoji.
4. A decorated method preview includes its decorator.
5. Two same-line callsites preserve two distinct source evidence entries.
6. While editing temporarily broken code, last-known-good data remains marked stale and navigation cannot silently use invalid source spans.
7. Dynamic dispatch does not claim certainty without evidence.
8. A single-file edit does not reparse all unrelated files; stale results never replace a newer revision.
9. Git baseline snapshots never overwrite the live graph.
10. Native editor and canvas occupy a single active editor group; no extra permanent panel; viewport and pins are preserved.

## Deliverables

- Working, modular repository with real implementations and no missing imports or build placeholders.
- Installable `dist/*.vsix` when environment allows; smoke-tested installation and UI evidence.
- Updated ADRs, architecture/readme and migration documents, including deprecated V1 code removal after compatibility tests.
- `docs/VALIDATION_REPORT.md`, actual coverage and test counts, CI job evidence and a requirements coverage matrix.
- A concise risk register with anything not yet implemented and why.

**Exit criteria:** This refactor is complete only when the existing V3 core behavior remains available and the V4 correctness + reliability gates pass. AI remains deferred throughout.
