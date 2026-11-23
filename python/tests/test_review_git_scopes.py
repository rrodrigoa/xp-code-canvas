"""Isolated repository contract tests for staged, unstaged, working, and branch semantics.
They do not import or execute any user repository code.
"""
import os
from pathlib import Path
import subprocess
import tempfile


def _git(root: Path, *args: str) -> str:
    return subprocess.run(['git', *args], cwd=root, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True).stdout.strip()


def test_review_git_snapshot_scopes():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        _git(root, 'init', '-q')
        _git(root, 'config', 'user.email', 'review-test@example.invalid')
        _git(root, 'config', 'user.name', 'Review Test')
        file = root / 'agent.py'
        file.write_text('def execute():\n    return 1\n', encoding='utf8')
        _git(root, 'add', 'agent.py')
        _git(root, 'commit', '-qm', 'baseline')
        original_head = _git(root, 'rev-parse', 'HEAD')
        file.write_text('def execute():\n    return 2\n', encoding='utf8')
        _git(root, 'add', 'agent.py')
        file.write_text('def execute():\n    return 3\n', encoding='utf8')
        (root/'new.py').write_text('x = 1\n', encoding='utf8')

        assert 'agent.py' in _git(root, 'diff', '--cached', '--name-only')
        assert 'agent.py' in _git(root, 'diff', '--name-only')
        assert 'new.py' in _git(root, 'ls-files', '--others', '--exclude-standard')
        assert 'return 1' in _git(root, 'show', f'{original_head}:agent.py')
        assert 'return 2' in _git(root, 'show', ':agent.py')
        assert 'return 3' in file.read_text(encoding='utf8')
        assert _git(root, 'rev-parse', 'HEAD') == original_head
        # Snapshot comparisons must not modify tracked content or stage unstaged data.
        assert 'return 2' in _git(root, 'show', ':agent.py')
        assert 'return 3' in file.read_text(encoding='utf8')
