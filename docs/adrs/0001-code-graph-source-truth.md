# ADR 0001 — Canonical graph as a source-backed, independent model

**Decision:** Python `ast` + lexical resolver creates source facts; a versioned canonical graph owns symbol identity, evidence, source spans, and certainty. React Flow gets a derived view graph; Git comparisons remain immutable overlays. Avoid a custom Python grammar. Use public VS Code language providers for optional enrichment only.

**Reason:** UI layout is user preference, not a fact about Python program semantics. Raw AST alone cannot resolve dynamic call targets and it can mislead navigation. Separating stages enables deterministic tests and confidence/provenance.

**Consequence:** A compatibility SourceGraph protocol continues to exist until real VS Code tests validate full migration. The canonical V2 GraphStore is the extension-host source of truth. Editing source always uses native VS Code.
