# Real Flask repository validation

Repository: [pallets/flask](https://github.com/pallets/flask), full history, pinned at `49943b5a94413a530761350f04e896f76e8d620e` (5,566 commits). The clone lives in ignored `.validation-runtime/temp/flask`; no Flask checkout or dependencies are shipped with this product. Flask source visible in the screenshots is covered by the retained [BSD license](FLASK_LICENSE.txt).

Run `npm run test:real-repo` on an interactive Windows desktop. The runner clones and pins the repository, requires a clean clone, runs seven real VS Code extension-host tests and three installed-VSIX desktop tests, and checks that temporary source edits and renames were restored. It does not import or execute Flask code.

| Scenario | Executed check |
|---|---|
| Full workspace | 83 Python files, 1,705 canonical symbols, 387 source relationships, zero parser diagnostics |
| Source preview | Exact `flask.config.Config` text, 12,441 characters, verified against the open document revision |
| History | 100 real commits, including 37 merge commits; hashes, parents, subjects and authors checked against Git CLI |
| Class blame | 318 lines, 35 modifying commits, 19 contributors; every line hash and destination line checked against Git |
| Whole-file blame | 367 lines, 41 modifying commits, 20 contributors; same independent Git check |
| Historical renamed paths | Attribution follows lines across `flask/conf.py`, `flask/config.py` and `src/flask/config.py` |
| Clean comparison | HEAD and INDEX produce zero false semantic changes |
| Historical comparison | Parent of code commit `1d610e44b396d11113bb6a5d168cc5e996a6dfb9`; immutable snapshot text matched Git and live graph remained unchanged |
| Unsaved and saved edits | Blame correctly returns dirty; stale preview rejected; a temporary declaration appears through incremental indexing; restoration returns to clean |
| Staged rename and untracked file | INDEX uses the renamed path; renamed source is marked dirty and untracked source is not assigned authorship |
| Native editor and anatomy | Correct declaration and control-region lines opened in editor group 2 |
| Installed history UI | Actual 100-row timeline and branch lanes, selected commit and working comparison action |
| Installed blame code view | Actual source lines, attribution gutters, visible author/subject/hash card; provenance checked with Git CLI; compare against attributed commit |
| Other real-code UI | Code-changing historical comparison; nonempty `flask.app` import Sankey (7 incoming and 34 outgoing source relationships in the compared view); inspector navigation to native `config.py` and return to the canvas |

Screenshots are runtime evidence, not approved regression baselines:

- [History and branch lanes](flask-history.png)
- [Blame source view and visible line provenance](flask-blame-code.png)
- [Comparison against a blamed commit](flask-blame-comparison.png)
- [Historical semantic comparison](flask-semantic-comparison.png)
- [Real-code Sankey](flask-sankey.png)

Machine-readable service evidence is retained in `extension-results.json`. Passing this bounded Flask matrix does not certify every Git topology, encoding, filesystem or workspace arrangement. Physical Windows DPI, screen readers, Linux installation and the other manual gates remain listed in the main validation report.

The run found and corrected Windows Python pipe encoding, live/Git source-root casing, exact-case symbol ranking, search focus before asynchronous layout completion, and overlapping Git mode/timeline controls. These fixes preserve the existing source-backed graph and non-AI capability set.

V6.1 rerun (2026-11-20): **8 extension-host and 4 installed desktop tests passed**. New `v61-*` screenshots retain actual Activity Bar, recovery, history and blame evidence. The final runner checks a clean clone and normalizes inherited Git launcher configuration.
