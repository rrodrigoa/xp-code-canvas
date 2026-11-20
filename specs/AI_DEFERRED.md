# Deferred AI Roadmap — Python UML Code Canvas for VS Code

**Status: FUTURE WORK / NOT PART OF CURRENT RELEASE.** This is a separate implementation specification, not an instruction to implement the features now. The authoritative release definition is `CODEX_PYTHON_UML_CANVAS_IMPLEMENTATION_V3.md`. Codex must not implement features from this file unless the user explicitly activates this roadmap in a subsequent task.

The purpose is to preserve the Etchpad-inspired AI ideas without weakening or delaying the deterministic source-backed product. The existing UML canvas, Git semantic diff, source references, trace navigation, abstraction layers, spatial memory, native editor navigation and all core tests must remain intact and independently usable.

## 1. Activation, exclusions and architectural preconditions

### 1A. Features deferred as a group

1. **AI explanations:** Source-linked optional summaries of functions, classes, modules, packages, relationships, and changes.
2. **AI architecture walkthroughs:** Evidence-backed step-by-step guided navigation along actual graph relationships and Git diffs.
3. **AI agent integration:** User-approved Codex/other-agent connection, bounded read-only source/graph context queries, CLI and optional live-session bridge, with separately authorized edit proposals.

No current-release commands, settings, UI placeholders, test fixtures, CI jobs, model/provider packages, CLI binaries, bridge services or menus are required for these features. Do **not** implement preparatory scaffolding for them just because this file exists. The core model's immutable snapshots, exact source provenance and internal typed graph services are sufficient future integration seams.

### 1B. Integration principles once explicitly activated

- Do not replace the native editor, create a permanent third editing panel, modify UML notation or compromise file-focus vertical alignment, node dragging, pinned layouts, semantic zoom, source previews or returning to the canvas.
- AI is interpretation only: never silently create a source-verified UML edge or mark an uncertain relationship as true. Git/source analysis remains deterministic. Source files and graph snapshots remain the source of truth.
- AI capabilities must be optional, disabled by default and absent from ordinary core indexing. Keep offline and no-account operation fully functional.
- No implicit source upload, agent invocation, command execution or modifications to user code; obtain explicit authorization and limit workspace/source scope and output.
- Implementation later should be a separate, versioned set of modules, tests, settings and acceptance criteria, not a rewrite of the current code graph.

## 2. AI explanation and graph-walkthrough capabilities

### 2A. Hard separation: fact index vs interpretation

Treat the source-backed graph and Git semantic diffs as **deterministic ground truth within the limits of static analysis**. AI content belongs to a separate, visibly labeled, versioned overlay. The agent cannot write to the graph's confirmed node/edge stores, assign trusted provenance, promote an ambiguous link to confirmed, or change the underlying UML notation. No model invocation occurs during indexing, zooming, file-focus or Git diff generation.

The extension must function completely **offline with no AI account**. AI is **off by default** and must be actively initiated for each scope or session according to settings. Integrate through explicitly configured local CLI/SDK adapters (Codex CLI and one generic command/JSON adapter are mandatory; Claude Code is an optional adapter if locally installed and supported). Do not require an OpenAI API key or assume that a ChatGPT desktop session offers a programmable API.

### 2B. Source-anchored explanation cards

The user can select a function/class/module/package/edge or Git change and choose `Explain This`, `Explain Relationships`, or `Explain Changed Behavior`. The adapter receives a **bounded, explicit input**: snapshot version, selected symbols and exact source ranges, graph edge evidence, dependency neighborhoods, and optional diff hunks. Returned annotations must use a strict Zod-validated schema with title, prose, support references, qualified node IDs, source snapshot IDs, line ranges, confidence/limitations, and AI provider/session metadata.

- Every factual claim in a persisted annotation must carry one or more links to concrete current/baseline source ranges or graph evidence; if an agent cannot provide them, label the claim unsupported/needs verification rather than falsely anchoring it.
- A click on an explanation citation navigates the canvas to that construct/range or opens the standard native editor. Highlight exactly the referenced code and matching edge where possible.
- Show AI authorship, model/provider identity when known, generation time and snapshot hash, and the fact that explanations may be wrong. Store user-approved notes separately from generated explanation caches.
- On source edits/rebases/branch switches, mark affected annotations `STALE`, offer `Re-evaluate`, and never silently show stale content as current. A dismissed explanation never changes source/layout.
- Use an **in-canvas floating inspector / collapsible overlay** that opens on user action and closes with Escape. No permanently docked AI sidebar, left panel or third simultaneous editing surface.

### 2C. Visual walkthroughs with real graph paths

The user can request `Walk Me Through This`, `Explain Architecture Path`, or `Explain This Diff` on the selected evidence scope. A walkthrough is a versioned ordered sequence of steps. Each step contains:

- A title/short explanation, one or more **existing** node IDs and edge IDs, optional precise source ranges, an evidence list, and a camera/viewport target derived from existing positions.
- Optional branching choices (`follow caller`, `follow callee`, `show changed path`), progress step `N/M`, pause/restart/back/forward/exit.
- Temporary highlight and auto-pan/zoom that **never permanently rewrites pinned positions** or replaces the user's graph. Restore the prior viewport, altitude and filters on exit unless the user explicitly chooses to keep the walkthrough view.
- A visibly marked incomplete step when a claimed relationship cannot be mapped to real source; do not draw a fake confirmed edge to make the presentation look nice.

All walkthrough steps MUST pass a deterministic **evidence validator** before display. This validator checks IDs, ranges, snapshot versions, edge directions and basic path continuity. Generated narrative may be probabilistic; the mapping of its graphical highlights must not be.

### 2D. Agent proposals and human approval

If an agent proposes changing code, display the proposed **plan/patch and its impacted real nodes** as a separate draft/preview; do not automatically apply or fabricate edits on the canvas. Require explicit approval before any modifying action and use native VS Code/Git review/edit workflows. Re-index after accepted edits and show resulting semantic diff. The extension must never execute an untrusted repo command or AI-generated shell command merely because an explanation suggested it. Never silently send source to a remote model; request consent and show the selected scope/provider first. Treat prompts and tool responses as untrusted data in both host and webview.

## 3. Agent-facing structured graph interface

### 3A. Machine-readable commands without proprietary coupling

Implement a local, documented `xp-code-canvas` **read-only inspection CLI** with JSON output and stable schema versioning. It can run independently of the webview against a saved workspace (use the same deterministic core indexes); explicitly identify `snapshotSource: "disk"` when not connected to VS Code to prevent false claims about unsaved buffers. Minimum commands/behaviors:

```text
xp-code-canvas workspace --root <path> --json
xp-code-canvas symbols --root <path> [--file <path>] [--kind class|function|method] --json
xp-code-canvas inspect --root <path> --symbol <stable-id> --json
xp-code-canvas related --root <path> --symbol <stable-id> --direction incoming|outgoing --depth 1|2|all --json
xp-code-canvas path --root <path> --from <stable-id> --to <stable-id> --json
xp-code-canvas diff --root <path> --base <git-ref> --target <git-ref-or-working-tree> --json
xp-code-canvas schema --json
```

CLI output must include graph/version identifiers, grounded source paths and ranges, evidence, ambiguity/provenance, deterministic ordering and structured error codes (invalid ref/symbol, workspace untrusted or forbidden, missing Git, canceled, stale snapshot, unsupported command). CLI usage must NOT require the Etchpad CLI or any backend server, GitHub login, internet connection, paid AI account or running webview. Provide PowerShell and Bash examples. Avoid large unbounded JSON output by supporting sensible pagination and size limits.

### 3B. Opt-in application/agent bridge

Inside VS Code, offer **explicitly approved** tools for Codex/other agents to query the *live* snapshot, including unsaved buffers if the user opts into that integration. Choose one hardened local channel (e.g., user-scoped named pipe on Windows and Unix socket on macOS/Linux, or a strictly local extension-host-mediated command request), not a publicly listening HTTP endpoint. Require workspace trust, local peer authorization / session token where supported, path allowlisting and explicit request scopes. Never create a world-readable socket or accept arbitrary client-supplied file paths outside allowed workspace roots.

Suggested read-only bridge operations: `getGraphSummary`, `getNode`, `getIncoming`, `getOutgoing`, `getReferences`, `getSourceEvidence`, `getSemanticDiff`, `getSelectionContext`, `getWalkthroughContext`. Separate optional privileged operations: `proposeEdits` (preview only) and `applyApprovedEdits` (explicit human authorization + source version checks). Graph and source read permissions must be separately controllable. A selected symbol/relationship can be copied as a **bounded structured context packet** for Codex CLI, without the user having to manually describe which lines matter.

For a Codex adapter, prefer the documented noninteractive `codex exec` / structured output mechanism when available; discover/verify the locally installed version and capabilities before invocation. Never invent or hard-code an unsupported CLI flag; provide a clear adapter capability error if unavailable. Allow other local LLM coding harnesses via a generic JSON stdin/stdout adapter, but **do not make their existence a prerequisite** for the Python UML graph. All agents require explicit user-initiated invocation and secure process spawning without a shell.

### 3C. Versioned contracts and limits

Document Zod schemas and TypeScript interfaces for `GraphSnapshot`, `SemanticDiff`, `CodeReference`, `TraceRequest/Response`, `AIAnnotation`, `Walkthrough`, `AgentToolRequest/Response`, and `AnalysisDiagnostic`. Include max-size, cancellation, timeout, token budget, provenance/confidence, and workspace root rules. Reject unknown/malicious command kinds instead of dispatching generic shell commands. Log action metadata without source/secrets by default; support disabling logs/telemetry. Test local bridge on Windows paths and on multi-root workspace escape attempts. No arbitrary remote endpoint or external model is turned on by default.

## 4. Deferred implementation architecture and libraries

Keep the V3 core runtime and UI unchanged: TypeScript extension host, `@xyflow/react`, React, ELK.js, Zustand, Zod, Prism.js, Python `ast` and the existing source snapshot/evidence models. The future release adds modules only when explicitly approved:

```text
src/extension/agent/AgentAdapter.ts          # provider-neutral, explicitly user-invoked interface
src/extension/agent/CodexCliAdapter.ts       # feature-detected local Codex CLI integration
src/extension/agent/AgentAuthorization.ts     # trusted workspace, consent, scope, timeouts
src/extension/bridge/GraphQueryService.ts     # bounded, read-only graph evidence queries
src/cli/index.ts                              # versioned local JSON inspection CLI
src/shared/agent/annotationContracts.ts       # validated explanations and evidence
src/shared/agent/walkthroughContracts.ts      # validated steps, paths and snapshot IDs
webview/src/features/aiOverlays/              # temporary explanations and walkthrough HUD
tests/fixtures/agent-overlays/                # fake-provider evidence and hostile inputs
```

- **Provider interface:** a typed, cancellable, capability-negotiated adapter. Codex CLI and generic process/JSON adapter are planned; optional other agents only if installed and explicitly configured. Verify supported commands against the local installed version at runtime. Never assume paid API access or that a consumer desktop subscription enables an API.
- **Output schema:** Zod validation for `AIAnnotation`, `Walkthrough`, `AgentToolRequest/Response`, source anchors, node/edge IDs, snapshot hashes, consent/scopes and structured errors. Include bounds for query size, token budget, timeout and reply volume. Reject unknown tool types.
- **Process safety:** spawn with argv arrays, no shell; use strict workspace path allowlisting; never trust model-generated HTML/Markdown or local process output. Do not send secrets by default.
- **Local bridge:** if needed, choose a locked-down named pipe (Windows), Unix socket (macOS/Linux), or extension-host-mediated command channel with explicit session authorization, never an unauthenticated network server. Distinguish source reads from metadata reads; unsaved text requires separate permission.
- **UI:** transient accessible in-canvas cards and small walkthrough progress HUD; never permanent AI sidebar/editor group. Restoring the prior viewport, altitude, filters and pins on close is mandatory. AI results are marked interpretation, not source truth.
- **Changes:** any proposed patch remains a reviewable draft until explicit user approval; edits use native VS Code mechanisms with version checks and are followed by deterministic re-indexing and diff inspection.

## 5. Future tests and QA infrastructure — NOT active in core CI

When this roadmap is activated, add deterministic tests for each integration rather than relying on real paid model calls:

1. **Fake-agent fixture:** valid, stale, fabricated, ungrounded, wrong-snapshot, wrong-direction, out-of-range and malicious annotation/walkthrough outputs. Ensure all unsupported links are rejected or labeled, never drawn as verified UML edges.
2. **CLI fixture:** packaged CLI on real local repos; stable JSON schemas, relative/Windows/Unicode paths, pagination/size limits, exact source evidence, cancellation, missing Git and untrusted-workspace rejections; disk snapshots must not masquerade as unsaved editor buffers.
3. **Bridge authorization fixture:** consent denial, no adapter, disabled telemetry, untrusted workspace, escaped paths and multi-root isolation, unauthorized peer/session, oversized payload, adversarial source/prompt injection and timeout/cancellation behavior.
4. **Browser interaction:** explanations open/close in canvas, source reference clicks, stale marking and refresh, guided walkthrough Back/Next/Exit, valid path highlighting, no layout changes and no permanent extra panel.
5. **Official VS Code host:** actual document change invalidates AI notes, native editor round-trip, provider command detection, no auto-invocation, source selection scope and absence of network/API requirements.
6. **Packaged VSIX Windows desktop:** run actual golden path with a deterministic provider; all original V2/V3 core behaviors must still pass before, during and after AI overlays.

Future commands, only after activation:

```text
npm run test:agent-overlays   # fake-provider citations, evidence and injection safety
npm run test:agent-bridge     # trust, authorization, workspace scopes and IPC
npm run test:cli              # read-only CLI correctness, errors, offline use
npm run test:canvas-e2e      # augmented with AI overlays and walkthrough navigation
npm run test:desktop-e2e     # augmented with packaged VSIX AI UI flow
npm run verify               # original core V3 gates plus all activated AI gates
```

Use the same Vitest, pytest, Playwright, `@vscode/test-cli`/`@vscode/test-electron`, ExTester, Windows/Linux GitHub Actions and genuine final-VSIX testing infrastructure as the core. No silent skip, fabricated passing result or cloud model requirement for CI. Real-agent smoke tests may be optional and explicitly labeled, never the only evidence.

## 6. Future milestones and acceptance criteria — NOT required now

**AI Phase A — Explanations:** provider-neutral adapter, strict source citation validation, transient inspector, staleness and consent controls. Tests must show invalid evidence is not presented as fact and editing source invalidates the relevant annotation.

**AI Phase B — Walkthroughs:** bounded grounded path planner/validator, step HUD, citation navigation, focus/viewport restore and no fabricated edges. Tests cover cycles, unresolved hops and exit with preserved pin/zoom state.

**AI Phase C — Agent interface:** local CLI, optional authorized bridge for live snapshots including expressly permitted unsaved buffers, stable JSON schemas, optional edit proposals and explicit native editor review. Tests cover CLI output and security boundaries across Windows and Linux, with a packaged desktop UI pass.

Future definition of done:

- AI is off by default; without provider, core UML graph, Git diff, native editor navigation and tracing continue to work unchanged, offline.
- Each explanation has real source anchors and model/provider plus snapshot attribution, or explicitly indicates unsupported content.
- Every walkthrough step points to existing graph IDs/evidence and restores previous view state on Exit.
- Every agent operation is user authorized, scoped, bounded and auditable without exposing source unnecessarily; no silent code changes or network upload.
- All original core acceptance tests still pass and new tests execute truthfully on the packaged VSIX before the AI release is deemed ready.

## 7. Supporting references and deferred-only documentation

- Etchpad public site (ideas, not a dependency): https://www.etchpad.ai/
- VS Code webview guide: https://code.visualstudio.com/api/extension-guides/webview
- VS Code extension testing: https://code.visualstudio.com/api/working-with-extensions/testing-extension
- Codex documentation (verify current supported CLI behavior when implementing): https://developers.openai.com/codex/

Once activated, author `docs/AI_OVERLAYS_AND_PRIVACY.md` and `docs/CLI_AND_AGENT_BRIDGE.md`, extend `docs/TEST_MATRIX.md` and `docs/VALIDATION_REPORT.md`, and record each new feature's actual code/test/CI evidence. **Do not add these to the current core release requirements.**
