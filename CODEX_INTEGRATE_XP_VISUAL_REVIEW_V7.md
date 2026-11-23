# Codex — integrate XP Code Canvas Visual Review V7 into my LOCAL V6.1

## Non-negotiable source-of-truth rule

**V6.1 ALREADY EXISTS ON MY MACHINE AND HAS BEEN CHANGED/FIXED BY CODEX. IT IS NOT PUSHED TO GITHUB.** The GitHub repository `rrodrigoa/xp-code-canvas` may still be V6.0 or otherwise behind. **Do not fetch/reset/checkout/pull main as a replacement for my working directory. Do not overwrite my V6.1 files with a full ZIP.** My current local repository and uncommitted changes are authoritative. The supplied V7 patch was generated against an earlier *reference* V6.1 ZIP, not my exact working copy, so conflicts are expected and must be reconciled intentionally.

This is an additive, **non-AI** architecture code-review feature. Do not implement `specs/AI_DEFERRED.md`. Preserve the user's existing V6.1 Activity Bar, Spread & Recover, resizeable node source previews and cursor-accurate Edit behavior, plus ALL prior UML, Git, blame, Sankey, test and layout features.

## Files supplied

- `XP_Code_Canvas_Visual_Review_V7.patch`: standard Git patch against the available reference V6.1; use for review and selective application.
- `XP_Code_Canvas_Visual_Review_V7_Overlay.zip`: only new/modified files; use to compare and merge changes, **not blindly extract into the repository**.
- `XP_Code_Canvas_Visual_Review_V7_Source.zip`: full reference source tree and docs; only for inspection and tests, **not a replacement of the current checkout**.
- `docs/visual-review/V7_PRODUCT_DESIGN.md` and `docs/visual-review/VALIDATION.md` are included in the patch/ZIP.

## Step-by-step in local repository (PowerShell)

```powershell
# Run inside the real local V6.1 source checkout
 git status --short
 git branch --show-current
 git diff --binary > ..\local-before-visual-review.patch
 git diff --cached --binary > ..\local-before-visual-review-staged.patch
 git switch -c feature/visual-architecture-review-v7
 git apply --check ..\XP_Code_Canvas_Visual_Review_V7.patch
```

**If** `git apply --check` passes and you have reviewed the diff, use `git apply ..\XP_Code_Canvas_Visual_Review_V7.patch`. **If** it fails because Codex changed local files, do NOT force-apply or copy whole files over local. Instead selectively integrate the overlay, keeping local versions authoritative. For modified files, read the local file and the reference patch, then merge the intent and run tests. `git apply --3way` is optional **only after** verifying the exact base blob is available and reviewing the proposed changes; never auto-resolve by choosing the V7 side for every file.

## High-conflict merge points (inspect, do not overwrite)

1. `package.json`: retain current version/metadata; add `xpCodeCanvas.reviews` Activity Bar tree, review commands, SCM/Explorer actions and activation if absent.
2. `src/extension/controllers/CanvasController.ts`: merge ReviewCoordinator, ReviewDiffService, events + messages, never replace the local V6.1 node cursor/navigation changes.
3. `src/extension/controllers/CanvasSidebar.ts`: add Code Reviews tree to *existing* V6.1 Structure/Git sidebar.
4. `src/shared/types.ts` / `src/core/contracts/viewState.ts`: extend the existing discriminated message protocols with strict validation. Do not regress V6.1 source position contracts.
5. `src/webview/App.tsx` / `src/webview/store.ts`: review overlay and floating inspector without destroying native layout, scroll/zoom, expanded/resized node geometry, or current graph state.
6. `src/webview/components/UmlNode.tsx`, `ui/UmlCardHeader.tsx`, `UmlEdge.tsx`: numbered discussion badges, selected code-line comments, relationship note anchors; keep native editor Edit selection position from V6.1.

New self-contained modules are mostly low-conflict: `src/review/*`, `src/extension/review/*`, `src/webview/review/*` and their tests. Verify imports and code contracts against your local files.

## Behaviors to implement and verify end-to-end

- Review sources: working including unsaved + untracked, unstaged, staged, local branch merge-base, and GitHub PR merge-base (when exact source commits locally available).
- Direct changes vs potential impact vs unchanged visual layering. Structural node colors never turn into Git status colors. Connection changes and uncertainty separately styled.
- Numbered comments on classes/methods/parent UML nodes and relationships; attach to specific source line, support draft/reply/resolve/reopen/delete, preserve layout when threads change.
- Activity Bar **Code Reviews** and easy launch within UML; diff opens real VS Code native diff tab without rewriting files.
- Local notes persist only in VS Code workspaceState; GitHub actions explicit: read threads, reply, resolve/reopen, edit/delete PR review comments, post inline or architecture PR discussion, submit COMMENT/APPROVE/REQUEST_CHANGES.
- Check PR HEAD SHA before remote writes; display auth and GitHub permission errors without hiding them. Never auto-publish local drafts.
- Close review restores the same live graph, focus/viewport/pins/manual arrangements.
- No paid API, no LLM, no agent execution.

## Tests and mandatory release gates

```powershell
npm ci
python -m pip install -r python/requirements-test.txt
$env:PYTHONPATH="python/src"
python -m pytest -q python/tests
node scripts/review-standalone-smoke.cjs
node scripts/review-notes-contract-smoke.cjs
node scripts/review-api-contract-smoke.cjs
npm run typecheck
npm run lint
npm run test:unit
npm run build
npx playwright install chromium
npm run test:canvas-e2e
npm run test:extension
npm run test:desktop-e2e
npm run package
python scripts/verify-vsix.py
```

Make browser fixtures and Extension Host tests prove staged vs unstaged vs unsaved, review launch, thread badge/edge marker, comment selection, diff, PR error modes, no auto-publish, layout stability, and installed VSIX. Add tests for reference application conflicts if necessary. Confirm GitHub integration against a disposable PR only with permission. Report actual test output in `docs/visual-review/VALIDATION.md` and do not call a blocked gate passing.

### Final delivery

Produce a new validated VSIX, `docs/visual-review/VALIDATION.md`, a diff against **my actual local V6.1**, and a pull request **only after I explicitly request pushing**. Keep release metadata unchanged unless asked. Never commit tokens or temporary GitHub authorization files.
