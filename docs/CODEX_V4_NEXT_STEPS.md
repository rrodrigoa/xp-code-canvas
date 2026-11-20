# Codex continuation — V4 visual implementation

## Immediate verification gates

1. From the V4 repository root, use Node 22 and a working npm registry: `npm install` then commit the authentic generated `package-lock.json`.
2. Run `npm run typecheck`; fix actual strict TypeScript errors; do not substitute syntax parsing for a typecheck.
3. Run `npm run lint`, `npm run test:unit`, `npm run test:python`, `npm run build`, `npm run test:canvas-e2e`, `npm run test:extension`, `npm run package`.
4. Launch VS Code Extension Development Host (`F5`), open `tests/fixtures/sample_project`, verify file alignment, grouped source anatomy, selected-part edge tracing, Git comparison, Sankey alternative lens and native editor return.
5. Run Windows packaged VSIX tests and verify high contrast and reduced-motion appearances. Capture actual VS Code screenshots; static mock HTML is insufficient.

## V4 specific manual checks

- Wheel never changes behavior based on hovered semantic block: wheel scroll/pan; Ctrl/Cmd+wheel zooms pointer-centered.
- Zoom at 0.55x, 0.85x, 1.40x and 2.1x: overview strips, UML, indexed construct anatomy, selected source code. Explicit expansion works at lower zoom.
- Click a method in a class anatomy block: it exposes real method nodes and uses the same canonical relationship evidence. No invented edges.
- Switch UML → Flow → UML in the same tab. Change relation type. Inspect width labels against actual static Python fixtures and confirm there is no runtime-throughput claim.
- Select peers from Flow; verify keyboard Enter/Space and selection. Test cyclic calls, unresolved imports, large imports and Git baseline views.
- Resize VS Code, switch themes, use multiple repository roots, and resume a pinned layout after extension restart.
- Performance test 1,000+ symbols: source preview requests must be limited to explicit expansion / selected high-zoom symbol. Verify no large HTML injection / untrusted source rendering issue.

## Known remaining V4 hardening

- npm packages are not available in this authoring environment; full TS typecheck, Vite build, Playwright and extension-host execution are **not yet verified**.
- No bundled VSIX until those release gates succeed.
- Large/complex pinned-node collisions and compound ELK routing need real-world layout evaluation.
- The source-backed structure blocks navigate to indexed declarations. Individual attribute chips currently have no standalone source range, and do not open the editor directly.
- V4 Sankey is a focused one-hop **static relationship** view. A whole-project path/flow aggregation needs a defined, cycle-safe path attribution model; actual runtime throughput requires instrumentation.

## Scope guard

Retain all original V2/V3 and V4 non-AI features. AI explanations, AI architecture walkthroughs, agent CLI/MCP bridges and other deferred AI capabilities remain only in `specs/AI_DEFERRED.md`; **do not implement them**.
