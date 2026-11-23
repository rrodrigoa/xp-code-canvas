# V7.2 cognitive usability study (not yet conducted)

This is a **human-study protocol and reproducible analysis harness**, not evidence of improved human performance. No participants have been recruited and no comparison results are asserted.

## Purpose
Compare V7.1 text/diff-based review against V7.2 Change Cognition. For valid comparison, balance task assignment and order, keep the environment/code constant, and score against a prespecified rubric. Ask informed participants for consent before logging activity.

## Tasks, with an actual source-ground-truth fixture
1. **Removed validation**: identify the removed `validate_payload()` relationship in `fixtures/after.py` versus `fixtures/before.py` and whether a test checks validation. Correct answer: removed static call; behavior consequence requires separate test/evidence.
2. **Exception handling**: locate a removed `try/except` and distinguish observable AST change from execution consequence.
3. **New dependency**: locate newly introduced `send_event()` call and check what actually imports it.
4. **Evidence gap**: establish whether a changed test file proves the tests passed (it does not).

Do not reveal answer keys before task completion. For this pilot, reviewers perform tasks both with standard diffs and with Change Cognition in counterbalanced order. Use anonymized participant codes; avoid collecting private repositories or review comments.

## Metrics
Primary: correctly identified source-backed changes, correct uncertainty classification, incorrect claims, and missed known changes. Secondary: navigation time, self-reported workload (scale 1–7), and confidence calibration. Measure via controlled task observation; do not assume faster = better. Predeclare exclusions and timing rules. The study currently has **no outcomes**.

## Data format
Use `template.csv`. Put observed results in a separate ignored file, not the public repository. This is not a telemetry feature of the extension.

Run `python studies/v72/score.py path/to/anonymized_results.csv` for descriptive statistics only. Its output is not a causal conclusion without an adequate study design and sample.
