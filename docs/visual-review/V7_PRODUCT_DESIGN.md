# XP Code Canvas — Visual Architecture Review V7

> Additive, non-AI feature for **a locally installed and Codex-modified V6.1**. This reference package is not a replacement for the user's unpublished local checkout. This specification describes the code included with the delivery; actual installed-VSIX acceptance remains a separate gate.

## Developer journey

1. Open the *Code Reviews* view in the XP Canvas Activity Bar; choose **Working**, **Unstaged**, **Staged**, **Branch** or **GitHub PR**. The Review button is also visible directly on the canvas. No Command Palette discovery is required.
2. The canvas stays in the existing editor tab. Directly changed UML classes/methods get strong visual emphasis; relationships added or removed have distinct treatments. Unchanged neighbors fade without disappearing. Potentially affected callers get a separate treatment, **never** a confirmed runtime-impact label.
3. Review the summary: changed symbols, potentially affected symbols, changed connections, open discussions, and locally inspected files. Select a changed file to open a **native VS Code diff**, including unsaved working-tree document contents when applicable.
4. Select a function, class, source line, or relationship to add a local review thread. Discussion badges count threads on individual symbols and aggregate up class/module ancestors. An edge with discussion shows a small comment counter. Click it to investigate the relationship and add a note.
5. Reply, resolve, reopen, and delete local discussions. They're saved in VS Code `workspaceState`; **no repository file is modified**, and a local note is not a GitHub PR comment.
6. On a GitHub PR review, sign in using VS Code GitHub authentication. View PR discussions and, with explicit actions, reply, resolve/reopen, edit/delete, post a local draft, or submit a **COMMENT / APPROVE / REQUEST_CHANGES** review. Pull-request head SHA is rechecked before mutation to prevent outdated approvals.
7. Close the review to return to the original live graph/navigation/layout state. Discussion changes never trigger fresh ELK layout or erase pinned node positions.

## Visual language

| Visual channel | Encoded meaning | Anti-misinterpretation |
|---|---|---|
| High-salience change border / glow | Source-backed added, modified, or removed symbol | Distinct from stable semantic colors for Python class/method/module |
| Low-opacity unchanged nodes | Not directly modified in the selected comparison | Not hidden and not necessarily unaffected |
| Impact outline | May be reached by static dependency traversal | No claim about runtime execution, breakage, or test coverage |
| Dotted/changed connector | Relationship changed between comparison snapshots | Dynamic Python relationships may remain uncertain |
| Comment bubble with number | Count of review *threads*, not line changes | Open and resolved counts shown separately in tooltips/inspector |
| Floating review inspector | Selected comparison, review discussions, actions | Dismissible overlay; no forced third permanent panel |
| File row reviewed checkbox | Local reviewer progress | Not synchronized with GitHub 'viewed' status |

The graph view is never the canonical source model: original Python files, Git snapshots, and GitHub threads remain the underlying evidence.

## Comparison semantics (exact)

- **Working**: `HEAD → current editor/workspace text`, including staged + unstaged + untracked Python changes.
- **Unstaged**: `INDEX → current editor/workspace text` (including unsaved buffers; untracked files are labeled separately).
- **Staged**: `HEAD → INDEX`, never mixing in unstaged changes.
- **Branch**: `merge-base(BASE, HEAD) → HEAD`, source and changes from tracked commit contents.
- **PR**: `merge-base(remote base SHA, remote head SHA) → remote head SHA`, *only if exact commits are locally available*. Without commits, remote discussions remain available but **architectural analysis is marked unavailable**; no fabricated impact overlay. Fetch PR refs into a local workspace first.

Read-only comparison uses Git snapshots; it never switches branches, checks out commits, stages files, or executes user Python code. Diff documents are opened through VS Code `vscode.diff`. Working diff right-hand source reads VS Code's live document, including unsaved edits. Historical snapshots use extension-local virtual read-only URIs.

## Architecture and boundaries

| Layer | Implementation | Contract |
|---|---|---|
| Semantic comparison | `GitReviewEngine` + existing `snapshotGit`, AST analyzer, `overlayChanges` | Stateless Git references, source-backed graph + file changes |
| Review state | `ReviewCoordinator` | Active review, diff baseline, comments, guarded remote mutations |
| Local discussions | `LocalReviewNotes` | Memento storage by stable workspace/review key, explicit state transitions |
| GitHub PR operations | `GitHubReviewClient` | Explicit HTTPS API requests, token from VS Code authentication, no tokens in storage |
| Native diff | `ReviewDiffService` | Read-only history, live working buffers, immutable source versions |
| Canvas overlay | `reviewProjection`, `ReviewDock`, UML node/edge badges | Deterministic visual projection, original graph & layout preserved |
| Entry points | `CanvasSidebar`, `CanvasController`, package contributions | Activity Bar Code Reviews tree, SCM actions, in-canvas Review button |

The shared types and validated webview messages make UI → extension host communication explicit. The bridge does not allow direct network access from the webview.

## Human review workflows — not AI features

This extension helps people assess changes made by humans or AI agents. It **does not** introduce AI explanations, AI-generated reviews, LLM endpoints, agent tools, or autonomous publishing. `specs/AI_DEFERRED.md` remains deferred.

## Known limits (must remain visible)

- A GitHub inline comment must be on a line eligible in the PR diff. GitHub can reject an invalid line; users should re-anchor the draft to an actual changed line. No artificial source line is invented.
- Architecture-level notes (without valid diff lines) publish as **general PR discussion comments**, prefixed with architecture context, not as fake inline review threads.
- General PR discussion comments posted this way are retained as published local notes with links; they are not yet read back into the ReviewDock thread stream.
- Available GitHub operations: read PR metadata/review threads, inline post/reply, resolve/reopen, edit/delete PR *review* comments, general issue discussion post, submit approve/request-changes/comment. **Not yet implemented:** suggested-change application, cross-file multiline GitHub anchors, conversations-tab parity, assigning reviewers, labels/milestones, GitHub 'files viewed' synchronization, review dismissal, or repository protection actions.
- GitHub may deny editing/deleting comments belonging to another user; the API is the authority. Use the server's error rather than claiming the operation succeeded.
- Only a **single local, trusted, file-backed Git workspace** is supported for source-accurate comparisons. Multi-root or detached/partial checkout behavior requires additional validation.
- The local reference base is not necessarily identical to the user's **unpublished, Codex-modified V6.1**. Reconcile changed files rather than overwriting that checkout.

## Acceptance journeys

1. In a scratch Git fixture with `agent.py` and `tools.py`, stage one change and make another unstaged. Staged review shows only staged change; unstaged review shows only live change; working shows both. Make an unsaved edit in VS Code and verify working/unstaged reflect it.
2. Expand a changed class, inspect source/relationship evidence, add a source-line note, resolve it, reopen it, and verify the class badge count plus local persistence after restarting VS Code.
3. Add a note to an edge and verify both the edge comment bubble and discussion in the review inspector.
4. Switch from `Code Review → Changes` to native diff and back. Verify the same selected UML, viewport, pinned nodes and manual layout positions.
5. Review local PR Git objects and verify only PR-side changes are highlighted via merge-base, not unrelated base branch commits. Test unavailable Git SHAs showing a clear, actionable error.
6. Test GitHub PR threads, reply/resolve/reopen/edit/delete, and submit; require user action and revalidate the head SHA before mutations. Verify local drafts never silently post.
7. Windows installed-VSIX integration: Activity Bar entry, full webview, comment badge, staged diff, source selection, dark/light/high-contrast, keyboard and screen reader checks, reload/persistence, clean restart.

## Performance & accessibility

- Restrict Git subprocesses by maximum buffers/timeouts and read-only argument arrays.
- Preserve node positions on thread-state updates, avoid reanalyzing a repository merely to reply to a comment, and render large graphs using existing V6.1 virtualization.
- All review actions are buttons/selects with accessible names, descriptive status text, keyboard focus, high-contrast token support and reduced-motion preferences.
- Use color **and** shape/badges; never rely solely on red/green.
