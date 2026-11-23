# XP Code Canvas V8.1 — 2D/3D visual parity and graph partitioning

## Product goal

The V8.1 3D renderer is **an optional view of the existing canonical UML and review data**. It never reparses code, fabricates runtime dependency data, modifies source, or supplants the existing 2D React Flow canvas.

## Renderer contract

- `src/shared/visualLanguage.ts` is the renderer-neutral vocabulary for symbol roles, colors, Git states, UML edge types, uncertainty, arrowheads, dashed relationships, and semantic detail thresholds.
- `src/shared/visualizationProjection.ts` continues to supply source-backed node/edge selection, filters, change emphasis, open discussion counts, and member relationships. It now includes edge-thread counts and a review-edge change fallback.
- 2D `UmlEdge.tsx` uses the same `edgeAppearance` semantics as WebGL. Existing source-backed UML cards are unchanged.
- `src/webview/components/spatial/SpatialVisuals.ts` implements **real Three.js Sprites**. Sprites automatically face the camera: there is no backside of a card. The same live VS Code theme variables are resolved as colors in CanvasTexture card rendering.
- The large zoom range deliberately uses **four tiers**, mapped to the existing user-configurable semantic zoom stops: distant markers, identity/status, UML signature/attributes, detailed structural anatomy. These are *presentation tiers*: they do not imply changed semantics or source knowledge.
- Close-up cards show a bounded structural/source excerpt. Full syntax-highlighted source, cursor-accurate source selection → native VS Code editor, guarded editing, Git blame, and discussions stay in the resizable on-canvas 3D inspector and native VS Code editor. HTML controls cannot be made directly interactive inside a WebGL Sprite, so the accessible inspector remains the interaction surface for deep editing and commenting.
- Texture budget: max 260 simultaneously textured cards, with far nodes drawn as front-facing colored marker Sprites. The selected card is reserved space in the budget. This is a memory safeguard, **not proof of measured GPU performance**.

## Relationship fidelity

| UML relation | Existing 2D encoding | V8.1 3D encoding |
|---|---|---|
| `inherits` | Role color, solid line, hollow triangle | Role color, continuous `LineSegments`, hollow wireframe 3D triangle |
| `realizes` | Inheritance color, dashed line, hollow triangle | Inheritance color, segmented dashed line, hollow triangle |
| `calls`, `imports`, `creates`, `references` | Type color, dashed, open arrow | Same type color, segmented dashed, directional open arrow |
| `contains` | Short dashed line | Short dashed segments, open arrow |
| Ambiguous/unresolved | Muted and uncertain | Dashed and lower-opacity with uncertainty color |
| Added/modified/removed | Git status emphasis | Shared Git status color on line and node |
| Review thread | Numbered icon badges on node/edge | Numbered card badge and camera-facing edge badge |

The line geometry is local and source-backed. Dash geometry is generated as bounded Three.js `LineSegments`, instead of relying on a 2D-only dash API. The angular open markers are geometric approximations of the 2D SVG equivalents. Edge labels are available on hover in 3D to avoid turning a dense scene into unreadable text.

## Camera and interaction

OrbitControls support free rotation, pan, and mouse-wheel zoom. The overlay provides accessible **Zoom In**, **Zoom Out**, **Fit**, **Focus**, and Front/Top/Side/Isometric presets. Camera state persists through the existing V8 state contract; cards rotate toward the active camera automatically. Normal wheel in the WebGL area now zooms, unlike the older V8 vertical-pan interception. Scrolling inside the review inspector and the camera-control panel remains native.

## Layout / graph theory

The V8 spatial algorithms (`force`, `hub`, `folder`, `dependency`, `size`) are preserved. V8.1 adds:

- **Class/module neighborhoods** (`class`) — traverse declared parent identities up to class/module scope; group members under the actual source class where present.
- **Connected communities** (`community`) — weighted, deterministic, bounded label propagation over canonical relationships (not a claim of functional/semantic similarity).
- **Change/impact regions** (`review`) — group directly changed, potential impact, and unchanged context without equating static potential impact with proven runtime impact.

The three new modes have 2D equivalents. 2D draws optional labeled `PartitionFrames` behind existing UML nodes. 3D draws translucent, labeled, non-interactive regions. Folder organization is also retained. Grouping does not change the underlying graph or which edges exist.

## Operational safety

The WebGL renderer and all graph dependencies must be bundled into the local VSIX without remote scripts. Existing trust restrictions, Python worker, source hash checks, historical read-only behavior, review posting actions, and deferred AI scope remain unchanged.

## Architectural inspirations (outside sources, not code copied)

- [React Force Graph 3D renderer API](https://github.com/vasturiano/react-force-graph/blob/master/README.md) — custom 3D node objects, custom link objects and position updates, orbit controls.
- [Graphviz sfdp documentation](https://graphviz.org/docs/layouts/sfdp/) — multilevel force-directed organization for complex graphs; inspiration, not a library dependency.
- [Three.js Sprite documentation](https://threejs.org/docs/#api/en/objects/Sprite) — camera-facing billboards.

These sources describe capabilities; they do not certify this extension's WebGL runtime behavior.

## Non-goals

- AI-driven semantic layout remains deferred exclusively in `specs/AI_SEMANTIC_LAYOUT_DEFERRED.md`.
- 3D does not import/execute Python user code, nor claim to validate behavioral correctness.
- No automatic source edits, approvals, or GitHub comments are triggered by camera/graph actions.
