"""Offline summary of anonymous study observations. No telemetry or causal claims."""
from __future__ import annotations
import csv
import statistics
import sys
from collections import defaultdict
from pathlib import Path


def score(path: Path) -> list[dict[str, object]]:
    with path.open(encoding='utf-8', newline='') as input_file:
        rows = list(csv.DictReader(input_file))
    by_condition = defaultdict(list)
    for row in rows:
        if row['condition'] not in {'v71', 'v72'}:
            raise ValueError('Unknown condition')
        if not row['participant_id'] or not row['task_id']:
            raise ValueError('Missing participant/task')
        by_condition[row['condition']].append(row)
    summary = []
    for condition, values in sorted(by_condition.items()):
        mean = lambda col: round(statistics.mean(float(v[col]) for v in values), 3)
        summary.append({'condition': condition, 'observations': len(values), 'accuracy_mean': mean('correct'),
                        'false_claims_mean': mean('incorrect_claims'), 'misses_mean': mean('missed_changes'),
                        'seconds_mean': mean('seconds'), 'confidence_mean': mean('confidence_1_to_7'),
                        'workload_mean': mean('workload_1_to_7')})
    return summary


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python score.py results.csv')
    for result in score(Path(sys.argv[1])):
        print(result)
    print('Descriptive summary only: NOT evidence of causation or usability gains.')
