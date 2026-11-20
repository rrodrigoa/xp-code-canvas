# ADR 0002 — Isolated persistent Python analysis worker

**Decision:** Launch one fixed extension-shipped Python script with `-I -S -u`, a bounded JSONL RPC protocol, and one source repository/cache. The worker caches parse trees per file, the TypeScript index coordinator serializes source mutations and rejects stale document versions, and the worker is restarted after failure.

**Reason:** Re-running Python per keystroke and reparsing entire workspaces is needlessly expensive; executing user Python imports is unacceptable. Python AST is already the correct parser; lexical semantics are a separate stage.

**Consequences:** Python 3.11+ must be locally present; workers do not support executing user modules. IPC must be audited for malformed frames, version mismatch, stale data, cancellation and memory budgets. A remaining release task is robust oversized-batch backpressure and Windows desktop testing.
