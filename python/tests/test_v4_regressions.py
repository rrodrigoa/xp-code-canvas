"""RED tests for audited starter gaps; copy under python/tests/ before P2.

These tests are EXPECTED TO FAIL on the original V1 analyzer. Do not mark them
as passing without implementing the corresponding semantic/position fixes.
"""
from pathlib import Path
import importlib.util
import sys

ANALYZER_PATH = Path(__file__).resolve().parents[2] / 'python' / 'analyzer.py'
if not ANALYZER_PATH.exists():
    # For standalone architecture review pack, set XP_CANVAS_ANALYZER to source.
    import os
    ANALYZER_PATH = Path(os.environ.get('XP_CANVAS_ANALYZER', '/nonexistent'))


def _build(code: str):
    spec = importlib.util.spec_from_file_location('review_analyzer', ANALYZER_PATH)
    assert spec and spec.loader, f'Point XP_CANVAS_ANALYZER at the starter python/analyzer.py: {ANALYZER_PATH}'
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.build({'schema': 1, 'files': [
        {'uri': 'file:///workspace/m.py', 'root': 'file:///workspace', 'version': 1, 'text': code}
    ]})


def test_shadowed_import_parameter_must_not_resolve_to_imported_function():
    # Extend fixture to multiple files so the imported symbol is in the graph.
    code = 'from tools import search\ndef run(search):\n    return search()\n'
    spec = importlib.util.spec_from_file_location('review_analyzer', ANALYZER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    graph = module.build({'schema': 1, 'files': [
        {'uri': 'file:///workspace/m.py', 'root': 'file:///workspace', 'version': 1, 'text': code},
        {'uri': 'file:///workspace/tools.py', 'root': 'file:///workspace', 'version': 1, 'text': 'def search(): pass\n'},
    ]})
    by_id = {n['id']: n['qualifiedName'] for n in graph['nodes']}
    assert not any(by_id.get(e['source']) == 'm.run' and by_id.get(e['target']) == 'tools.search'
                   for e in graph['edges'] if e['kind'] == 'calls')


def test_two_declarations_have_distinct_node_ids():
    graph = _build('def f(): return 1\ndef f(): return 2\n')
    functions = [n for n in graph['nodes'] if n['kind'] == 'function']
    assert len(functions) == 2
    assert len({n['id'] for n in functions}) == 2


def test_ast_columns_convert_to_utf16_for_emoji_prefix():
    line = '    x = "😀"; g()'
    graph = _build('def f():\n' + line + '\ndef g(): pass\n')
    call = next(e for e in graph['edges'] if e['kind'] == 'calls')
    start = call['evidence'][0]['range']['startCharacter']
    expected = len(line[:line.index('g()')].encode('utf-16-le')) // 2
    assert start == expected


def test_decorated_method_preview_includes_decorator():
    graph = _build('class A:\n    @classmethod\n    def f(cls): pass\n')
    method = next(n for n in graph['nodes'] if n['kind'] == 'method')
    assert '@classmethod' in method['source']


def test_same_line_repeat_calls_preserve_two_evidence_sites():
    graph = _build('def f(): pass\ndef g():\n    f(); f()\n')
    calls = [e for e in graph['edges'] if e['kind'] == 'calls']
    assert sum(len(e['evidence']) for e in calls) == 2
    assert len({(site['range']['startLine'], site['range']['startCharacter'])
                for e in calls for site in e['evidence']}) == 2
