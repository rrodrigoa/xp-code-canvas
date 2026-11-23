# Codex integration task — XP Code Canvas V8.1

You are the engineering owner for final integration and release verification.

## Critical baseline rule

The user's local `xp-code-canvas` working tree already contains V6.1/V7/V7.1/V7.2/V8 and unpublished Codex changes. **This local tree is authoritative. GitHub `main` is not.** Never reset, clean, rebase, switch commits, force checkout, overwrite user changes, or replace the repository with the reference ZIP. Start by inspecting `git status`, current source files, and installed dependencies; preserve staged, unstaged and untracked work. Do not push or publish without explicit permission.

This package is a V8.1 implementation **against the older V8 reference ZIP**, with an additive `.patch`, changed-files overlay and full source for reference. `git apply --check` is only guaranteed against the reference baseline. Merge selectively (three-way if safe), reconcile conflicts against local source, and produce the actual local patch after integration. Do not overwrite local fixes.

## Implementation scope, in order

1. **Shared visual grammar** in `src/shared/visualLanguage.ts`, used by 2D SVG edges and 3D WebGL: role colors, Git status, uncertainty, solid/dashed connections, UML inheritance/implements triangles and arrowheads. Keep source IDs and evidence unchanged.
2. **Camera-facing UML card sprites** in `src/webview/components/spatial/SpatialVisuals.ts`: no backsides; real VS Code theme tokens; distinct module/class/callable/property appearance; signature, compartments, source/anatomy, historical/stale/uncertain state, review counts; four tier semantic zoom driven by persisted `semanticZoomStops`; bounded GPU texture budget. Keep 2D as-is.
3. **3D edge geometry**: custom Three.js line segments for dashes, markers, changed edge colors, confidence and clickable discussion counts; no silent edge omission when switching views. Preserve historical compare frames.
4. **Camera UX**: 3D wheel zoom; orbit/pan; zoom buttons, fit/focus, front/top/side/isometric presets, selection focus, saved positions/camera; WebGL-disabled fallback; clean resource disposal, no flicker on camera events.
5. **Graph partitioning in both renderers**: retain force/core/folder/dependency/size; add deterministic class neighborhoods, connected weighted communities and direct/potential-impact regions. Add non-interactive group boundaries in 2D and spatial regions in 3D. Use source-backed group membership only.
6. **Review parity**: preserve and verify cursor-accurate source selection in the resizable 3D inspector, node/edge Git change status, fade/highlight, PR/working/staged review, thread badges, inspector, blame, guarded editing, native editor, read-only historical views and all existing V7.2 review workflows.

## Mandatory verification (run and record exact results)

```powershell
# Inspect changes before doing anything destructive
 git status --short

# Install/reconcile dependencies and lockfile. This V8 reference may lack a lockfile.
 npm install
 npm run typecheck
 npm run lint
 npm run test:python
 npm run test:visual-smoke
 npm run test:visual-v6
 npm run test:spatial-v8
 npm run test:spatial-v81
 npm run test:unit
 npm run build
 npx playwright install chromium
 npm run test:canvas-e2e
 npm run test:extension
 npm run test:desktop-e2e
 npm run package
```

Run manual installed VSIX cases in a trusted local Python repository **and a real staged/PR comparison**. Verify with dark, light, high-contrast themes; 125/150/200% scaling; GPU-enabled WebGL and explicit WebGL failure; multi-root repositories; no clipping after orbit and resize; click edges and thread badges; inspect all seven relationship kinds, dashed inheritance/realizes, changes and uncertainty. Compare selected symbol and filters when switching 2D→3D→2D.

Test 50, 584, 1,000, 5,000 and 10,000 symbols, including cyclic dense graphs. Record FPS, texture count/GPU memory (if measurable), camera responsiveness, worst-case visual overlap, and browser/extension exceptions. Investigate and fix failures. On rendering performance problems, use culling/LOD/batching without dropping the canonical graph or falsely hiding review changes.

Review `docs/V8_1_VISUAL_PARITY.md` and `docs/VALIDATION_V8_1.md`. Update validation report based on **executed** results; never describe an unrun test as passing. Add runtime screenshot baselines from the actual installed extension, not static mockups, if tests pass. On success, produce an installable `dist/xp-code-canvas-0.8.1.vsix`, artifact hash, and Git diff against the actual local working tree. Do not push/publish.

Keep AI semantic layout ONLY in `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md`. No AI dependency or runtime code.
