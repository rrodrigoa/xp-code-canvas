# Codex execution — V7.2 Change Cognition, integrate into unpublished local source

## Critical source-of-truth rule

My actual local `xp-code-canvas` checkout contains V6.1, V7 and/or V7.1 functionality with unpublished Codex fixes. **That LOCAL checkout is authoritative.** GitHub `main` is older and MUST NOT be used to reset or replace it. The accompanying patch was created against the supplied V7.1 reference ZIP; it is **not** a verified patch against my current local branch.

Never run `git reset --hard`, clean my uncommitted work, delete local files, replace the repository with the full ZIP, or push/publish without explicit authorization. Start by reading `git status`, `git diff`, `git log -5`, and the existing local features. Make a feature branch/backup only if that can preserve all uncommitted work. Use a dry-run `git apply --check` as a hint, not authorization to overwrite local implementations. If a patch hunk conflicts, merge logically rather than taking the reference file wholesale.

## Apply in priority order

### P0 — Architecture comparison, structural change evidence, evidence map

- Incorporate `src/review/changeCognition.ts` into the existing review data model (`reviewTypes.ts`) and Git snapshot pipeline (`GitReviewEngine.ts`). Exact before and after graph metadata must be kept distinct from the merged delta graph.
- Support Before, Delta, After graph frames with shared spatial coordinates and no full re-layout merely because the comparison frame changes. Removed edges are shown as removed; candidate moves must remain explicitly uncertain.
- Make the **Understand** tab in the existing V7.1 review inspector display signature/decorator/base/control-flow/static-call transformations with click-to-source navigation. The evidence map links changed tests, docs and configuration files and says **tests unknown** unless there is actual executed test evidence.
- Never show current live source as if it came from a historical snapshot; no editing or new inline GitHub comment anchors from historical frames.

### P1 — Reviewer reasoning, bookmarks, comparison shelf, coverage

- Integrate `reviewReasoning.ts` and `ReviewCognitionService.ts`, validating all webview messages through Zod. Explicit user-authored questions and statuses are locally persisted; these are **not** code-health scores and never auto-post to GitHub.
- Add per-symbol coverage (unexamined/opened/reviewed/needs evidence/stale), bookmarks, and a four-symbol before/after signature shelf. A node merely being opened must not mark it reviewed.
- Invalidate old reviewed statuses when source/revision changes, including changes to README/Markdown/config/test files and Git index content where accessible. Preserve the unanswered questions.
- Ensure comments/review-status updates never re-run global layout, lose zoom, or overwrite manual node positions.

### P2 — Revision exploration, opt-in blink, usability evaluation resources

- Integrate `ReviewRevisionService.ts`: bounded trusted, local, read-only Git revision inspection with allowlisted commit hashes and no checkout/reset. Preserve node positions; mark historical frames as read-only.
- Blink before/after only when the user explicitly starts it; honor reduced-motion. Stop when panel unmounts and provide keyboard equivalents.
- Keep `studies/v72` human-review fixtures, consent/measurement protocol and offline scorer. Do **not** claim actual human-study results until conducted; consider balanced tasks with source-known defects.

## Tests, safety and release gates

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:python`, `npm run test:v72-smoke`, `npm run test:v72-study`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run test:desktop-e2e`, and `npm run package`. Repair all integration, type, visual, accessibility and Git-corner-case problems. Test the **actual locally modified V6.1/V7/V7.1**, not only the pristine V7.1 reference.

Specific functional acceptance:
- For 20+ changed files, including Python/tests/Markdown/config: every source-backed delta is navigable, missing test execution is labeled unknown, and changing the comparison frame does not relocate unchanged boxes.
- Signature, added/removed call and control region facts have real source ranges; ambiguous/moved candidates cannot appear as confirmed behavior.
- Questions/bookmarks/reviewer-status actions persist across webview focus and survive reindexing, but become stale after the source fingerprint changes.
- Historical views cannot be edited or annotated as current source; in-scope live code retains existing guarded V7.1 inline editor and native-editor actions.
- Staged, unstaged, working, branch, PR, no-commits, PR-source-unavailable cases yield accurate and safe behavior.
- 5,000-symbol graph performance; layout stability after comments; no altered canonical graph; high contrast and keyboard interaction.
- GitHub review submission remains an explicit separate V7 flow and no new AI analysis is introduced.

Deliver an installable, VERIFIED VSIX plus a **new Git patch against my real local HEAD**, an updated validation report containing actual executed evidence, and a concise changelog. Do not push or publish without approval. If any gate is blocked, record BLOCKED/NOT EXECUTED instead of claiming it passed. Read `docs/V7_2_CHANGE_COGNITION.md`, `docs/VALIDATION_V7_2.md`, and `studies/v72/README.md` for the intended behavior.
