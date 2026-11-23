# Deferred roadmap: semantic AI-assisted graph organization

**NOT PART OF V8 IMPLEMENTATION. DO NOT BUILD, DEPEND ON OR REGISTER AN AI PROVIDER.**

## Problem

Syntactic graph connectivity, directory structure, source size and static references are inadequate to express conceptual architecture. A future optional semantic adapter could group functions by responsibilities such as authentication, reconciliation, orchestration, validation, persistence and diagnostics regardless of directory topology.

## Contract for a future phase

- `SemanticLayoutProvider` input: versioned canonical graph with stable node IDs, approved source summaries, user-requested semantic question and explicit privacy configuration.
- Output: `{groups:[{id,label,description,nodeIds,confidence,evidence}],suggestedPositions?:Record<string,{x,y,z}>,modelVersion,sourceRevision}`. Returned positions are **proposals**, never source edits.
- Evidence: every classification references actual symbols and source ranges; uncertain tags visible as uncertain. Never invent calls or override resolved canonical graph facts.
- Trust: source is local by default. Any remote model use is opt-in per workspace with data-disclosure review. Prompt/model attacks cannot inject VS Code operations or modify code.
- Scope: support 2D, 3D and future visualizations using the renderer-independent projection; no renderer-specific AI prompt engineering.
- UI: distinct semantic vs syntactic mode, provenance/uncertainty legend, revert to deterministic layout and review of AI-proposed group membership before adoption.
- Tests: privacy/permission gates, adversarial examples, stale-source invalidation, deterministic fallbacks, source-backed classification precision and user studies for understanding rather than visual appeal.

Schedule only after V8's full deterministic 2D/3D release validation succeeds.
