# V5 user-journey audit — performed before implementation

**Method:** inspected the V4 source, interaction handlers, data contracts, layout logic, existing automated fixtures, and V4 static design previews; simulated ordinary navigation tasks and their state transitions. **Limitation:** the actual VS Code extension was not executable in the available environment (npm registry DNS unavailable), so this is a heuristic/source-level user walkthrough, not a completed live user study. No claim of successful desktop validation is made.

## Developer journey 1 — “Where is this function used?”

1. Open a repository and focus `agent.py`.
2. Find `Agent.execute()` in the vertical focus lane; select it.
3. Inspect inbound callers and outbound dependencies, then jump to a caller.
4. Try to return to the previous symbol without losing context.

**V4 friction:** selection was not recorded in a useful Back/Forward chain; the inspector had no navigation breadcrumbs; a graph search could hide an interesting related node. **V5 applied:** bounded 100-entry symbol exploration history, Alt+Left/Right commands in the canvas, Back/Forward toolbar buttons and clickable parent breadcrumbs. Note that visual positions remain governed by the existing layout and pin state, not a snapshot per history entry.

## Developer journey 2 — “Why did this method change?”

1. Select a method and open its Git context.
2. Determine which commits most recently changed its lines, without leaving the canvas.
3. Zoom into source and inspect an individual line.
4. Compare the repository against the relevant commit.

**V4 friction:** the Git drawer offered repository history but no symbol-level line attribution. **V5 applied:** per-symbol `git blame --line-porcelain --follow -L` on demand; contributor attribution bars; line-number gutter with contributor-colored marks; a click-to-inspect commit popover; option to compare the workspace against that commit. Blame means last modifying commit in HEAD, *not* original authorship or code ownership. Dirty/untracked/unsaved source explicitly disables line mapping.

## Developer journey 3 — “What does this giant method do?”

1. Select a function and zoom from an UML node into its anatomy.
2. Identify nested conditions, loops, exception handling, context managers and exits.
3. Click a source-backed region, opening the native editor at the precise location.

**V4 friction:** nested declarations were drawn, but control structures within functions were absent. **V5 applied:** source-backed Python AST control-structure regions (bounded to 72 per function), UTF-16 source ranges, consistent construct colors and click-through to native editor after content-hash verification. Block size represents source lines, never execution time, throughput, impact or true control-flow reachability.

## Developer journey 4 — “What did this commit affect?”

1. Select a Git commit baseline and compare to the working tree.
2. Differentiate directly modified symbols from possible graph impact.
3. Keep the topology visible without visually overwhelming unchanged regions.

**V4 friction:** semantic changes were present but needed stronger emphasis controls. **V5 applied:** a dismissible, compact Git emphasis strip with `All`, `Changed`, `Changed + impact`, and return to current graph. Nodes and edges outside the selected emphasis become faint **rather than disappearing**. Git markers remain independent from code-structure colors.

## Developer journey 5 — “Can I still work in VS Code normally?”

The native-editor button and return-to-canvas command remain. No extra permanent panel, duplicated code editor, AI service, external telemetry, or agent integration was introduced. Ordinary wheel scrolling and Ctrl/Cmd+wheel canvas zoom remain the same.

## Usability acceptance risks still to evaluate in the real editor

- Zoom changes node sizes; verify ELK layout remains stable without unexpected jumps, especially after loading blame.
- Several thousand UML nodes need performance and memory benchmarking with real extension tools.
- Test Git blame on dirty buffers, staged files, renames and merge histories on Windows with Git installed.
- Confirm screen-reader descriptions, keyboard focus order, high-contrast themes and keyboard interaction through the actual VS Code webview.
- Check interaction conflicts between VS Code shortcuts, webview focus, Git attribution controls and the native editor.
- Validate UI contrast and clipping at 100%, 125%, and 200% operating-system display scaling.
