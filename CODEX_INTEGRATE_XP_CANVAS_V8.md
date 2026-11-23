# Codex integration — XP Code Canvas V8 Spatial Visualization

## Absolute source-of-truth rule

**The user's currently open, unpublished local `xp-code-canvas` checkout is authoritative.** It contains V6.1, V7, V7.1, V7.2 and additional Codex changes/fixes, and need not match public GitHub `main` or the V7.2 reference snapshot used to produce this patch. **Never reset it, overwrite it with the source ZIP, discard local files, or force-apply a patch over conflicts.** Inspect `git status`, branch, diff and uncommitted files before editing. Create a safety branch or commit/stash only with user-approved handling; preserve uncommitted work. Do not push or publish without the user's approval.

## Files supplied

- `XP_Code_Canvas_V8_Spatial.patch` — additive unified Git patch **relative to V7.2 reference** (NOT necessarily applicable cleanly to the user's local version).
- `XP_Code_Canvas_V8_Spatial_Overlay.zip` — just added/modified files to reconcile into the actual local code.
- `XP_Code_Canvas_V8_Spatial_Source.zip` — full **reference** working source tree; use for context, never replace local checkout.
- `docs/V8_3D_ARCHITECTURE.md` — complete renderer-independent design and interaction contract.
- `docs/VALIDATION_V8.md` — executed results and remaining release gates.
- `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md` — future architecture only; **do not implement AI features now**.

## Integration order (preserve original UI)

1. Inspect current checkout and baseline; compare existing `CanvasState`, `App`, `CanvasToolbar`, `LayoutOrchestrator`, `CanvasController`, `CanvasSidebar`, `viewStateSchema`, review protocols and existing V7.2 features. Run `git apply --check /path/to/XP_Code_Canvas_V8_Spatial.patch`. If conflicts, use the overlay as a reference and merge function by function. Keep local hotfixes and tests.
2. Add renderer-agnostic `VisualizationProjection` as a single shared source of filtered graph nodes/edges and review evidence; both existing 2D UML/Flow and new 3D must consume the same source-backed facts. Do **not** duplicate Python analysis, Git review state, discussion persistence, semantic deltas or inline editor logic.
3. Integrate `spatialGraph.ts` deterministic layouts (force, centrality, folder, dependency, source size). Expose matching 2D folder and hub layouts alongside the existing 2D architecture/file/investigation/change modes. Preserve all manual positions, pins and existing zoom tiers.
4. Add lazy `SpatialGraph3D` to the **same existing editor/canvas**, accessible via toolbar `UML / Flow / 3D`, native sidebar `Explore 2D / 3D`, and `xpCodeCanvas.open3D` command. Orbit/drag/zoom, drag-position persistence, folder shells, selected symbol/source inspector, existing guarded inline edit, Git blame, review comment actions, change/impact dimming, Before/Delta/After and native editor navigation must work without any separate permanent editor.
5. Add serialized/bounded 3D layout, camera and node coordinates to `CanvasState` with matching strict Zod validation and recoverability. Never break existing saved 2D sessions. Ensure graph lens-switching does not reindex Python or overwrite review state.
6. Ensure local Three.js/WebGL dependencies are bundled in lazy Vite chunks, not loaded from a CDN. Check VS Code CSP, release packaging, webpack/Vite worker output, GPU context loss recovery and 2D fallback. Include new SVG controls in native Activity Bar only if existing V6.1 layout permits; avoid duplicating icons.
7. Run all non-AI V7.2+ regressions and new spatial unit/browser tests. Resolve any type-check/runtime issues. Build and clean-install the VSIX, verify Python worker, run actual Python repositories with many changed files and compare 2D vs 3D review evidence and selected source positions.

## Required tests and acceptance gates

- `npm install` to add the new dependencies and lock them; then `npm ci` from the generated `package-lock.json`.
- `npm run typecheck`, `npm run lint`, `npm run test:python`, `npm run test:unit`, `npm run test:spatial-v8`, `npm run build`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run test:desktop-e2e`, `npm run package`.
- Browser: 2D -> 3D -> 2D without graph/review mutation, all five 3D spatial modes + 2D folder/hub, real orbit/pan/zoom + camera persistence, node drag and position persistence, WebGL disabled fallback, 500–5,000 symbols and GPU performance, keyboard focus and reduced motion.
- Review: real working/staged/branch/PR scopes, directly changed vs potential impact and inactive-node fade, Before/Delta/After/historical read-only, comment badge counts, blame, source preview/guarded inline edit and native editor return.
- Large changes: compare actual Git blame and source-evidence IDs across both renderers, ensure unresolved edges remain uncertain; check no arbitrary generated edges or semantic AI.
- Package: verify all WebGL chunks, CSS and Python worker paths inside VSIX; clean VS Code install on Windows; exercise Activity Bar entry point and command.

## Ship requirements

Update `docs/VALIDATION_V8.md` with executed results (never mark unrun gates green). Provide a real VSIX and screenshots captured from a running installed extension, plus a **fresh patch against the user's actual local branch**. Preserve full non-AI scope and do not push or publish without explicit approval. Inability to run a gate is a blocker, not a pass.
