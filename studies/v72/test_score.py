import unittest
from pathlib import Path
import tempfile
import csv
from score import score


class StudyHarnessTest(unittest.TestCase):
    def test_descriptive_scoring(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'answers.csv'
            with path.open('w', newline='', encoding='utf-8') as output:
                out = csv.writer(output)
                out.writerow(['participant_id','condition','task_id','correct','incorrect_claims','missed_changes','seconds','confidence_1_to_7','workload_1_to_7'])
                out.writerow(['anonymous-1','v72','change',1,0,0,30,5,3])
            self.assertEqual(score(path)[0]['accuracy_mean'], 1.0)


if __name__ == '__main__': unittest.main()
