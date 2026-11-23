# Visual Architecture Review — using the new canvas workflow

1. Open XP Canvas's **Activity Bar → Code Reviews**. Select **Review staged changes**, **Review working changes**, **Review unstaged changes**, **Review branch**, or **Review GitHub pull request**. You can also click the **Review** button floating above the graph.
2. For staged review, the comparison is `HEAD → Git INDEX`. For unstaged review, the comparison is `INDEX → editor buffers`. For working review, the comparison includes staged, unstaged, and unsaved changes. A review cannot implicitly stage or commit code.
3. On the canvas, **Changed** limits emphasis to modified constructs; **Changed + impact** includes potentially affected callers/dependencies; **All** reveals the whole graph. Faded code is still present. Changed edges retain their UML type and source-evidence semantics.
4. Use the review inspector's **Files** tab to open native side-by-side diffs and check off what you have read. These are *local checkmarks*, not GitHub review status.
5. Click a changed UML box or dependency line and leave a **local architectural note**. In an expanded method, select the source position then choose **Comment** to anchor to that line. Badges count threads and indicate unresolved discussions.
6. Use the **Threads** tab to reply, resolve/reopen, or delete local notes. They persist in VS Code workspace storage but don't become part of Git history.
7. Open a PR using `owner/repo#123` to read GitHub review threads. If the exact PR commits exist locally, source analysis and changed-node mapping are available. Otherwise use `git fetch` to make the commits available; the app should show an informative message, not pretend the graph was analyzed.
8. **Publish** is a separate explicit action for a local note. A source line must belong to the PR diff to be posted as an inline comment. Node/edge-wide notes publish as general PR discussion. Submit COMMENT / APPROVE / REQUEST CHANGES only when you're ready.
9. **End review** to restore the live Python architecture graph and its navigation state.

## Intentional boundaries

This is a review of **code changes potentially produced by AI**, not an AI review assistant. No LLM calls or agent commands are introduced. See `V7_PRODUCT_DESIGN.md` for support matrix, limitations and acceptance requirements. Before publishing the extension, run the installed VSIX, desktop/UI and real GitHub test gates listed in `VALIDATION.md`.
