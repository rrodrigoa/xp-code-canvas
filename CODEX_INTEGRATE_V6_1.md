# Codex implementation/integration command — XP Python UML Canvas V6.1

Repository: https://github.com/rrodrigoa/xp-code-canvas

## Exact job

Integrate the three V6.1 UI fixes from this feature package into the **latest local main checkout**, preserving all intervening fixes and existing non-AI capabilities. The feature archive was developed against an older V6 starter snapshot. **DO NOT overwrite main with the full archive or replace its package-lock.json.** Use the supplied patch and feature files as the implementation basis, resolve context drift intelligently, and produce a clean PR-ready branch.

Files to read before acting:
- `docs/V6_1_FEATURE_DESIGN.md`
- `docs/FEATURE_VALIDATION.md`
- `XP_Python_UML_Canvas_V6_1.patch`
- Current repository `docs/VALIDATION_REPORT.md` and relevant V6 specifications.

## Safe integration sequence (PowerShell)

```powershell
git switch main
git pull --ff-only
git status --short
git switch -c feature/v6-1-usability
# Copy the patch from the download alongside the checked-out repo.
git apply --check .\XP_Python_UML_Canvas_V6_1.patch
# If --check passes:
git apply .\XP_Python_UML_Canvas_V6_1.patch
# If context drift causes rejection, do NOT force-replace files:
# inspect the patch and port hunks using source files from the feature ZIP.
```

Git `main` has extra post-V6 bugfixes. Integrate preserving them; when patch hunks conflict, reconcile intentionally. Preserve the current `README.md`, packaging scripts, runtime worker, current Python code, and current test fixtures unless the changed hunk explicitly requires adjustment.

## Feature acceptance

### Recovery layout

- `spread` layout is selectable in the toolbar and via `xpCodeCanvas.spreadGraph`.
- One click escapes previous file-focus/manual/pinned dead ends, clears stale saved placement, and displays at least a handful of readable nodes with a minimap.
- The 584-symbol regression produces a 2-D arrangement, not a single center line. Small file-focus views still use vertical source order; large ones wrap.
- `Reset UML Layout` clears all per-mode remembered coordinates.
- Layout never mutates source, graph edges, evidence, Git history or source ranges.

### Sidebar

- XP connected UML-node icon is visible in the Activity Bar in a clean VSIX install.
- Structure tree is populated with actual indexed Python symbols and commands focus their corresponding UML nodes.
- Git History tree lists actual local commits and selecting a commit opens comparison.
- View-title actions cover Open, Spread, Git History, Changes, Blame, Refresh. Empty states help first-time users.
- Standard UML remains in the editor tab; sidebar uses native `TreeDataProvider`, not a separate full webview.

### Code viewport and Edit

- Expanded code node resizes horizontally/vertically with a visible handle, persists dimensions and avoids graph collisions.
- Source is selectable, syntax-highlighted and scrollable; normal wheel scrolls preview, Ctrl/Cmd+wheel zooms graph.
- Selecting text at an arbitrary source offset (including Unicode and nested Prism tokens) then clicking Edit opens the **real VS Code editor at exactly the corresponding UTF-16 cursor**.
- No selection -> source node first line, column zero. Header Open in Editor continues to navigate to its declaration.
- Stale source, removed historical symbols and invalid coordinates are handled safely.

## Required engineering gates

```powershell
npm install --package-lock-only --ignore-scripts
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run test:python
npm run test:feature-smoke
npm run test:visual-smoke
npm run test:visual-v6
npx playwright install chromium
npm run test:canvas-e2e
npm run test:extension
npm run test:desktop-e2e
npm run package
python scripts/verify-vsix.py
```

Prefer `npm ci` without rewriting the lockfile if the lock already matches the updated `package.json`; the `npm install --package-lock-only` command is only to update the package version or manifest when necessary. Run real Windows UI tests using a clean VSIX install and collect screenshots of the Activity Bar, Spread recovery, and source resize/Edit navigation.

Add/adjust tests if any integration changes behavior. Update docs/VALIDATION_REPORT.md with true executed evidence and any remaining blockers. Do not claim shipping readiness or merge until the full tests succeed. Do not implement AI features. Final deliverables: branch with commits, `.vsix`, verified validation report and PR summary.
