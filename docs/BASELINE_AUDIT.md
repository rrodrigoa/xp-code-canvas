# V1 baseline and V2 refactor record

- **Input**: exact source tree from `XP_Python_UML_Canvas_Starter_V1.zip` (57 files), with original UML canvas, Git diff, VS Code navigation and test entry points.
- **Input specification**: `CODEX_PYTHON_UML_CANVAS_IMPLEMENTATION_V3.md` (non-AI core) plus production V4 architecture blueprint. The AI roadmap was not implemented.
- **V1 Python baseline (as previously recorded)**: 13 Python tests passing; 90% analyzer coverage; no npm registry access or verified VSIX.
- **V4 regression baseline**: 5 failing semantic tests provided by architecture audit, covering parameter shadowing, duplicate declarations, UTF-16 offsets, decorators, and repeated call evidence. All 5 are now passing as part of the V2 suite.
- **V2 result**: modular Python analyzer, persistent worker, source repository, index coordinator, canonical V2 graph and revisions, lazy code snippets, guarded native editor, local batch Git adapter, optional VS Code definition provider.
- **V2 validation**: `python -m pytest -q python/tests`: 33 passed; `python -m pytest -q python/tests --cov=python/src/xp_canvas_analysis --cov-branch`: total 91%; TypeScript transpile syntax: 40 files / 0 syntax errors. Full typecheck and real editor execution blocked by dependencies (see validation report).
- **No V1 Git tag**: the input ZIP was not a Git repository. `xp-code-canvas-v2` is a full source copy rather than an in-place Git migration; the V1 ZIP remains unchanged for rollback/comparison.
