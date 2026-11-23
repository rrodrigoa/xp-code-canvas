# V8: Renderer-independent visualization and optional 3D UML

**Scope:** Additive release on top of the V7.2 reference source. No AI capability is implemented. The user's unpublished local checkout is authoritative: it may contain V6.1/V7/V7.1/V7.2 corrections that are absent from this reference.

## Product contract

The canonical `SourceGraph` remains immutable evidence of Python declarations, calls, imports, inheritance, source locations, confidence and Git changes. The `VisualizationProjection` provides the same source-backed visible nodes, edges, search, dependency-trace filtering, selected state, review statuses and comment counts to every renderer. 2D React Flow remains the default; 3D is a lazy-loaded WebGL lens; Flow/Sankey remains available.

**Critical invariant:** selecting 2D, 3D, or Flow does not re-index Python, mutate the graph, change Git review baselines, post comments, save code, or resolve ambiguity. Neither a layout algorithm nor a visualization can assert a new code relationship. Review status is not an AI opinion.

## Interfaces

- `src/shared/visualizationProjection.ts`: canonical view model (`VisualizationProjection`, `VisualNode`, `VisualEdge`) shared across 2D/3D/future renderers. IDs, source evidence and confidence are passed through; visibility derives from the same altitude, filter, search, and trace settings. Review comment counts and change emphasis are separate visual metadata.
- `src/shared/spatialGraph.ts`: deterministic 3D organization algorithms and metrics, with no React, VS Code, WebGL, Python execution or AI dependencies. Every algorithm accepts the already projected graph and returns finite `{x,y,z}` coordinates keyed by stable symbol ID.
- `src/webview/components/spatial/SpatialGraph3D.tsx`: optional WebGL adapter, 3D camera + orbit controls, node type shapes, source inspector and guarded inline editor, interaction handlers. Source previews and Git actions use the **existing** host message protocol.
- `src/webview/App.tsx`: one shared graph projection; optional 3D rendered in the same canvas region; existing ReviewDock, Before/Delta/After, Git actions, source navigation and status remain mounted.
- `CanvasState`: persisted optional `spatialLayout`, `spatialPositions`, `spatialCamera`; `lens` now includes `spatial`. 2D viewport and manual positions remain independent. Zod validates bounded state on the host.

## Graph organization options

| View / layout | Organizing rule | Meaning and limitations |
|---|---|---|
| 3D force-directed | Deterministic 3D spring attraction from actual edges, sampled repulsion and cooling | Topology-focused, approximate repulsion, not execution flow or semantic similarity |
| 3D connectivity core | Directed PageRank plus weighted in/out degree | Highly referenced/connected constructs near center; not a quality or importance score |
| 3D folder constellations | Directory/root groups on Fibonacci-sphere centers, nodes inside each group ranked by connectivity | Literal source-directory organization; translucent regions and folder labels; cross-directory links remain |
| 3D dependency layers | BFS distance from selected source symbol, fallback to source-order root | Cycles handled; hop count is static graph distance, not runtime depth |
| 3D code mass / periphery | Source-line magnitude contributes to radial distance, correlated links retain their arrows | File/construct size is **not** cost or complexity |
| 2D folder clusters / connectivity core | 2D flatten of the same folder / hub algorithm, with measured-card collision settling | Same clustering semantics across renderers; independent ELK 2D layout modes remain untouched |

All layouts are deterministic for the same graph, selection, options and pins, and stable against input enumeration order. Large data is bounded: sampled repulsion avoids O(N²) pairwise scans; folder groups share fast metrics. Graph attributes use bounded weighting so extreme counts do not dominate the scene. Users can rotate with drag, pan with Shift+drag or ordinary wheel, zoom with Ctrl+wheel, fit, focus selection, reset camera, drag a symbol, and filter by folder. `spatialPositions` records 3D manual placements separately from 2D `manualPositions` and `pinned`.

## Visual language and evidence

- Geometry shows node type: classes as boxes, modules as octahedrons, methods/functions as spheres and properties as cylinders. Size scales with source lines and connection count (logarithmically capped).
- Color shows source kind, not code quality.
- Rings show direct Git change, potential impact or selection. Unchanged context fades in change-emphasis mode, not removed from the graph.
- Directional relationship arrows preserve source and target. Different relationship kinds have consistent colors; ambiguous/unresolved relationships have distinct colors and tooltip qualifications.
- Folder volumes render as translucent non-interactive shells with labels and changed/impacted counts. They are visualization-only objects and never appear in the canonical graph.
- Review discussion counts appear as visual markers and in accessible tooltips. Click a symbol to see source, open its native editor or Git blame; inline editing continues to use guarded `WorkspaceEdit` and is disabled in historical frames. Click a relationship to open the existing review discussion target.
- PR review frame transitions (Before / Delta / After / historical) reuse the same renderer, stable IDs and review state. No historical source preview may masquerade as a current live source.

## User experience, failures and safety

- An explicit `UML | Flow | 3D` switch is in the existing toolbar. The Activity Bar *Explore 2D / 3D* tree includes *Open 3D UML* and the command palette exposes *Python UML Canvas: Open 3D UML Canvas*.
- The app lazy-loads 3D/Three.js to keep the original 2D startup path lean. No CDN, remote image or remote model is loaded. The existing VS Code webview CSP stays in place.
- Without WebGL, display a clear fallback notice and keep the 2D control available. Do not crash or disable the whole extension.
- Only selected source opens full text previews; avoid sending full source strings for every graph node to the GPU renderer. Review overlays and error state remain in the normal UI.
- Show explicit static graph-count meaning; no inference about runtime hot paths, actual service traffic, code quality, or AI-intended semantics.
- Honor VS Code theme tokens in HTML overlays, high-contrast borders, keyboard-operated selectors, reduced motion for layout/camera transitions where implemented, and accessible text alternatives to the 3D scene.

## Performance and production follow-up

`react-force-graph-3d`, `three`, and `@types/three` are newly required packages. The 3D renderer is lazy-loaded, renders local WebGL and uses shared primitive geometries. Folder region geometry is disposed when the layout changes. **Required finalization:** regenerate a genuine npm lockfile, execute TypeScript semantic checking, Vite/VSIX packaging, verify Vite lazy chunks in the VSIX, Playwright WebGL with hardware and software fallback, real Windows VS Code GPU, camera persistence, 500/1,000/5,000 graph memory/latency, GPU context loss, 2D layout backward compatibility, keyboard and screen-reader alternatives. These release gates have not executed in the source-producing environment.

## Future semantic AI layout — explicitly deferred

See `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md`. The future agent may propose clustering tags or coordinates through a **separate, optional provider**. It must supply provenance, confidence, privacy controls and reversible edits. No AI package, endpoint, network request, runtime agent, fabricated relationship or classification is in V8.
