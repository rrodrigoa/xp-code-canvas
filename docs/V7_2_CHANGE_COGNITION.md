# XP Code Canvas V7.2 — Change Cognition

## Product contract

V7.2 is an **additive deterministic review experience** built on the V7.1 Change Atlas, comments, resizable code viewport, safe inline source editing, Activity Bar, and graph projection. It does not implement AI explanations, AI review approvals, or an agent integration. The user's *unpublished locally modified V6.1/V7/V7.1* is authoritative; the source in this archive is only the V7.1 reference plus V7.2.

### First-run journey

1. Open **Code Reviews** from the Activity Bar; choose working, unstaged, staged, branch, or PR.
2. Select **Understand** in the review inspector. Move between **Before**, **Δ changes**, and **After**. Node positions remain anchored, while relationships and ghost nodes change to reflect source-backed revisions.
3. Select a function. Its structural change list records observable signature, decorator, inheritance, control-region, body-fingerprint, and static relationship changes. Click a fact to navigate to the symbol. Source proof lives at the source line or native diff; the visualization does **not** prove runtime behavior.
4. Open the **Evidence map**. It shows directly changed symbols, changed edges, uncertain edges, unresolved discussions, and linked changed tests/docs/config. Test execution is **unknown** unless separately supplied: a changed test file is not a green passing-test status.
5. Record the reviewer's own questions and status; bookmark discoveries or pin up to four before/after signatures. Review status is explicit user input, **not** deduced from dwell time or from opening a file.
6. Find unreviewed or evidence-needing changes via coverage. A new revision invalidates earlier completed statuses, showing them as **stale** rather than silently carrying over an approval.
7. Optionally Blink Before/After (950 ms, respecting reduced-motion preferences), or inspect a bounded history of first-parent Git revisions without modifying files. Historical UML code previews are read-only; native diff remains the place to inspect exact old source text.

### Visual grammar

| Channel | Meaning |
|---|---|
| Structural node color | Python declaration kind; stable across revisions |
| Border and delta markers | Source-backed added/removed/modified graph elements |
| Faded context | Unchanged but relevant nodes |
| Dashed relationship | Unresolved/ambiguous relationship, not proven execution |
| Review coverage outline | Reviewer-recorded state (reviewed, needs evidence, stale) — **not** code correctness |
| Red/green text snippets | Before/after **observed** source metadata, not an approval vote |
| Historical preview notice | Current source cannot be substituted for the old code, and inline editing is unavailable |

The existing V7.1 semantic-zoom thresholds, spreads, drag positioning, Git blame, comments and Sankey remain operational. No new permanent panel is added; Understand is a tab in the dismissible review inspector.

## Implementation modules

- `src/review/changeCognition.ts`: pure before/after graph frames, semantic facts, and evidence summary.
- `src/review/reviewReasoning.ts`: pure reviewer-controlled status, questions, bookmarks, shelf and coverage.
- `src/extension/review/ReviewCognitionService.ts`: persisted local review state; never publishes to GitHub.
- `src/extension/review/ReviewRevisionService.ts`: read-only Git revision listing and bounded lazy graph loading, under trust and exact-review membership checks.
- `src/extension/review/GitReviewEngine.ts`: builds the V7.2 comparison from exact snapshot graph pairs.
- `src/extension/review/ReviewCoordinator.ts`: invalidates stale review activity using Git revisions and working-document/source hashes, including bounded non-Python files.
- `src/webview/review/ChangeCognitionPanel.tsx`: all P0–P2 workflows, keyboard actions and accessible controls.
- `src/webview/App.tsx`: shared graph frame with preserved node coordinates.
- `src/webview/components/UmlNode.tsx`: historical read-only guard, small reviewer-status indicator.

## Exactness and limitations

- Python source structure comes from the existing AST analyzer; it does **not** guarantee dynamic dispatch behavior. Uncertain edges stay candidates.
- Move detection matches identical name/kind/AST fingerprint only when unique; it is **candidate** evidence, not an established rename.
- The most recent 22 first-parent history commits are available in the revision scrubber (plus endpoints), where Git objects are locally available. Older or divergent ancestry is not exhaustively displayed. Historical inspection is on demand.
- `ReviewSnapshot.comparison.before` contains graph metadata and source locations, not complete historical source contents. Historical source is inspected with the original native diff; it is not substituted from live buffers.
- The evidence map does not execute tests and cannot assert behavior preservation, risk, readiness, or correctness.
- `ReviewCognitionService` persists notes/progress only in local VS Code workspace storage. It does not stage, commit, publish, or upload them. The PR comment facility remains V7.1's separate workflow.
- Working tree fingerprints include AST graph and up to 200 changed file contents or index blob IDs. Inputs larger than 1MB are fingerprinted by stat metadata, not full bytes; massive changes require reviewer revalidation.
- The panel is for reviewing a single workspace Git repository, consistent with V7.1. Multi-root PR review, deleted files without local Git objects, and direct GitHub-hosted review are separate capabilities.

## Research and validation framing

The choice of Before/After/Delta and optional blink follows comparative visualization principles (juxtaposition, superposition, explicit difference). Change blindness and limited working-memory research motivate explicit transformations, short change groups, and externalized bookmarks. Software review research supports different review orders and deliberate reviewer judgment; no single order is universally best. These are **design motivations**, not proof that V7.2 makes people detect more errors.

`studies/v72/` provides a controlled human-review protocol, seeded Python scenarios, anonymous results template, and an offline descriptive scoring script. No participants were run here, and no effectiveness findings are claimed.
