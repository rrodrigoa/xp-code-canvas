# Codex: integrate XP Code Canvas V7.1 visual review into my LOCAL repository

## CRITICAL SOURCE-OF-TRUTH RULE

**My local V6.1 has been implemented and modified by Codex, but it has NOT been pushed to GitHub. I may also have integrated parts or all of V7 locally. DO NOT assume the public GitHub `main` matches this workspace. DO NOT reset, replace, re-clone, or overwrite my local changes.** The V7.1 patch was generated against a known V7 reference ZIP, not against my actual local working tree.

## Mission

Integrate the additive V7.1 Change Atlas, guarded inline UML editor, source-line change overlays and adjustable semantic zoom into my existing local XP Canvas. Preserve EVERYTHING currently working: V6.1 Activity Bar, Spread & Recover, resizable source nodes, cursor-accurate native editing, UML/Sankey, Git blame/history, V7 local and GitHub review threads, code-review scopes, PR actions, stored node locations and test infrastructure. **Do not implement unrelated deferred LLM/AI inference.** AI-authored code review itself is in scope.

## Supplied materials

- `XP_Code_Canvas_Visual_Review_V7_1.patch` — reference V7 → V7.1 additive changes (use for inspection/3-way merge, do not blindly apply to unpublished changes)
- `XP_Code_Canvas_Visual_Review_V7_1_Overlay.zip` — only changed/new V7.1 files
- `XP_Code_Canvas_Visual_Review_V7_1_Source.zip` — complete V7.1 reference tree for comparison, NOT a replacement for my checkout
- `docs/V7_1_VISUAL_AI_CODE_REVIEW.md` — technical/UX contract
- `docs/V7_1_VALIDATION_REPORT.md` — partial executed results and open gates

## Execution sequence

1. **Protect my workspace:** inspect `git status`, current HEAD, local untracked files, and any in-flight changes. Create a reversible backup/branch or patch **without altering source**. Note the real local baseline and differences from the reference V7 ZIP.
2. **Inspect/merge, not overwrite:** run `git apply --check` using the supplied patch only to learn conflicts. Reconcile file-by-file with local Codex fixes. Keep the full V6.1/V7 feature set. Never apply a patch if it silently removes local improvements.
3. **Change Atlas:** integrate pure deterministic grouping in `src/review/reviewAtlas.ts`, Atlas UI/CSS and V7 `ReviewDock` fourth tab. Preserve Git file-relative paths in file-diff actions. Maintain unchanged-node dimming and changed-edge/thread badges. Enforce bounded DOM render count.
4. **Zoom rail:** incorporate the user-adjustable `semanticZoomStops` in graph contracts and validation, `SemanticZoomRail`, `detailForNode`, `nodeSize`, and App state transitions. Use log-scale position and three independent handles with keyboard support. **Never re-layout the entire graph merely because a threshold moved.** Persist thresholds across VS Code restart and support old state payloads.
5. **Source view & edit:** preserve existing resizable UML source viewport and cursor-accurate Native Editor navigation. Integrate `InlinePythonEditor` and `InlineSourceEditService`, message contracts, volatile draft preservation, concurrency/hash conflict guards, LF/CRLF and UTF-16 behavior. Save is explicit and applies only to live local documents through `WorkspaceEdit`. Do not auto-stage or post PR comments. Reuse any better editor component already present locally instead of replacing it with a weaker reference implementation.
6. **Visible exact changes:** integrate `ReviewNodeDiffService` and ReviewLineOverlay request/response, high-zoom modified-line gutters, and accurate added/removed counts. For staged, branch and PR reviews, show unavailability when current document does not match historical snapshot rather than false blame/diffs. Retain existing native complete-file diff.
7. **Architecture review correctness:** staged review is HEAD→INDEX, unstaged INDEX→current VS Code buffers, working HEAD→buffers, branch/PR via merge base. Change Atlas groups actual graph/source evidence only; tests/docs/config file modifications remain visible without fabricated Python UML nodes. Build all review summaries deterministically without an LLM.
8. **Tests and integration:** run `npm ci`, lint, full TypeScript checks, Python tests, all unit tests, browser Playwright, Extension Host, real installed Windows VSIX/desktop tests and production `npm run package`. Include new V7.1 tests; test edit conflicts and baseline and diff alignment on Flask or another real repository, both Windows EOL styles. Fix build and behavioral failures. UI screenshots must be from the running extension, not just static previews.
9. **Release evidence:** update `docs/VALIDATION_REPORT.md` and V7.1 validation with actual command transcripts, versions, results, supported/blocked scenarios, SHA-256 of VSIX. Package and install in an isolated profile. Provide a small patch against **MY ACTUAL LOCAL BRANCH** after integrating, not a patch against GitHub main.

## UX/product acceptance

- I can open a review of 20+ AI-modified files and see related changed methods grouped into visual chapters. I can click a group to focus the UML, inspect changed connections, comments, source and native diff. I can find README, tests, configs and lockfile changes even when these have no UML class.
- A selected/expanded modified method has source-backed changed-line markers relative to its review baseline. Impacted callers are clearly distinguished from directly modified symbols; no fabricated runtime claims.
- I can resize and edit current Python source INSIDE a UML viewport, explicitly Save/Discard, retain an in-progress draft while moving around the canvas, and open the standard VS Code editor at the current cursor. Conflict and historical snapshots never silently overwrite source.
- I can drag **three semantic zoom thresholds** on the left control rail without losing graph locations. Wheel scrolls; Ctrl/Cmd+wheel changes physical zoom. My threshold settings persist across reload.
- Existing V6.1/V7 features work and all declared tests actually execute successfully.

## Hard limits

Do not push Git changes, publish a PR, approve a PR, submit comments or install marketplace versions without my explicit request. Do not claim success for unexecuted tests. Never copy `.git` or other private local data into the ZIP. When npm/test infrastructure is blocked, report that precisely and keep a runnable reproduction plan.
