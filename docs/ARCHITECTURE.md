# XP Python UML Canvas V2 — architecture summary

The **canonical source** is a current VS Code `TextDocument` (including unsaved edits), or a file loaded with `workspace.fs`. The Python analyzer **never executes or imports user project code**. AST parsing and lexical-scope analysis produce source-backed facts. Optional VS Code language providers may enrich selected relationships; uncertain results must remain explicitly uncertain.

```text
VS Code TextDocuments / workspace.fs
   │
   ▼
VsCodeSourceRepository (content hashes, document versions)
   │
   ▼
IndexCoordinator (incremental refresh; worker lifecycle; ordering)
   │
   ▼
PythonWorkerClient ◄── JSONL RPC v2 ──► Python AST/Scope/Graph package
   │
   ▼
GraphStore (versioned, Zod-validated, canonical semantic graph)
   │
   ├────► GitCompareService (immutable historical baseline overlay)
   │
   └────► GraphProjection / source-view deltas
                     │
                     ▼
       React Flow + ELK UML webview (view-only projection)
                     │
                 ┌───┴───────────────┐
                 ▼                   ▼
         ViewSessionService   SourcePreviewService
         (focus, pins, zoom)   (on-demand real code)
                 │                   │
                 └────► NativeEditorNavigator
                         (same VS Code editor group)
```

**Separation rules:** Canonical graph facts have no UI coordinates or source bodies. View state is persisted independently per workspace. Git overlays do not mutate the live source graph. Source previews are hash checked and bounded, and native navigation refuses stale symbol ranges. Semantic uncertainty and evidence are explicit. The UI is a single active canvas/editor surface; no persistent secondary editor is introduced.

The repository contains both the original **non-AI V3 product requirements** and the **V4 modularization design**. For complete architecture decisions, see [`adrs/0001-code-graph-source-truth.md`](adrs/0001-code-graph-source-truth.md), [`adrs/0002-runtime-worker.md`](adrs/0002-runtime-worker.md), and [`../specs/PRODUCTION_ARCHITECTURE_V4.md`](../specs/PRODUCTION_ARCHITECTURE_V4.md). For actual test status and remaining implementation work, see [`VALIDATION_REPORT.md`](VALIDATION_REPORT.md) and [`CODEX_NEXT_STEPS.md`](CODEX_NEXT_STEPS.md).

**Build status:** Full VS Code compilation, runtime tests and VSIX packaging have not been executed in the authoring environment due missing npm registry / VS Code binaries. This design is not a claim of production certification.
