import importlib.util
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location('canvas_analyzer', Path(__file__).resolve().parents[1] / 'analyzer.py')
analyzer = importlib.util.module_from_spec(SPEC)
import sys
sys.modules[SPEC.name] = analyzer
SPEC.loader.exec_module(analyzer)
FIXTURES = Path(__file__).resolve().parents[2] / 'tests' / 'fixtures' / 'sample_project'


def fixture_graph():
    return analyzer.build({'schema': 1, 'files': [
        {'uri': (FIXTURES / name).as_uri(), 'root': FIXTURES.as_uri(), 'text': (FIXTURES / name).read_text(), 'version': 1}
        for name in ('api.py', 'agent.py', 'tools.py')
    ]})


def test_source_inventory():
    result = fixture_graph()
    names = {(n['kind'], n['qualifiedName']) for n in result['nodes']}
    assert ('class', 'agent.Agent') in names
    assert ('method', 'agent.Agent.execute') in names
    assert ('function', 'api.handle_request') in names
    assert ('function', 'tools.search') in names
    assert result['diagnostics'] == []


def test_relationships_are_correct_and_provenanced():
    result = fixture_graph()
    index = {n['id']: n['qualifiedName'] for n in result['nodes']}
    relationships = {(index[e['source']], e['kind'], index[e['target']]) for e in result['edges']}
    expected = {
        ('agent.Agent', 'inherits', 'agent.BaseAgent'),
        ('agent.Agent.execute', 'calls', 'tools.search'),
        ('api.handle_request', 'creates', 'agent.Agent'),
        ('api', 'imports', 'agent'),
        ('agent', 'imports', 'tools'),
    }
    assert expected <= relationships
    assert not any(k == 'composition' for _, k, _ in relationships)
    assert all(e['evidence'][0]['uri'].startswith('file://') for e in result['edges'])


def test_signatures_decorators_async_and_visibility():
    result = fixture_graph()
    nodes = {n['qualifiedName']: n for n in result['nodes']}
    assert nodes['agent.Agent.plan']['async_']
    assert nodes['agent.Agent.execute']['signature'].endswith('-> str')
    assert nodes['agent.Agent']['attributes'][0]['visibility'] == 'protected'
    assert analyzer.visibility('__init__') == 'public'
    assert analyzer.visibility('__secret') == 'private'
    assert analyzer.signature(__import__('ast').parse('def f(a: int, /, b=1, *, k: str="v", **kw): pass').body[0]).startswith('f(a: int, /, b = 1, *, k: str')


def test_syntax_errors_are_bounded_and_non_executable():
    result = analyzer.build({'schema': 1, 'files': [
        {'uri': 'file:///tmp/invalid.py', 'root': 'file:///tmp', 'text': 'def (\n', 'version': 3}
    ]})
    assert result['diagnostics']
    assert result['nodes'] == []


def test_never_executes_imports():
    text = 'import os\nimport subprocess\nsubprocess.run(["touch", "/tmp/should-not-be-created-by-canvas"])'
    result = analyzer.build({'schema': 1, 'files': [
        {'uri': 'file:///tmp/anything.py', 'root': 'file:///tmp', 'text': text, 'version': 1}
    ]})
    assert result['nodes']
    assert not Path('/tmp/should-not-be-created-by-canvas').exists()


def test_same_named_functions_in_distinct_files_do_not_collide():
    result = analyzer.build({'schema': 1, 'files': [
        {'uri': f'file:///tmp/{name}.py', 'root': 'file:///tmp', 'text': 'def run(): pass', 'version': 1}
        for name in ('a', 'b')
    ]})
    funcs = [n for n in result['nodes'] if n['kind'] == 'function']
    assert len({n['id'] for n in funcs}) == 2


def test_relative_import_calls():
    result = analyzer.build({'schema': 1, 'files': [
        {'uri': 'file:///tmp/pkg/a.py', 'root': 'file:///tmp', 'text': 'from .b import work\ndef go():\n    return work()\n', 'version': 1},
        {'uri': 'file:///tmp/pkg/b.py', 'root': 'file:///tmp', 'text': 'def work(): return 3', 'version': 1},
    ]})
    index = {n['id']: n['qualifiedName'] for n in result['nodes']}
    assert ('pkg.a.go', 'pkg.b.work') in {(index[e['source']], index[e['target']]) for e in result['edges'] if e['kind'] == 'calls'}


def test_no_false_self_attribute_call():
    result = analyzer.build({'schema': 1, 'files': [{
        'uri':'file:///a.py', 'root':'file:///', 'text': 'class A:\n    def test(self):\n        return self.dynamic()\n', 'version': 1
    }]})
    assert not [e for e in result['edges'] if e['kind'] == 'calls']


def test_decorators_attributes_classmethod_protocol_dataclass():
    text = '''\nfrom dataclasses import dataclass\nfrom typing import Protocol\n\nclass Runner(Protocol):\n    def run(self) -> str: ...\n\n@dataclass\nclass Data:\n    name: str\n    count: int = 3\n\n    @property\n    def summary(self) -> str:\n        return self.name\n\n    @classmethod\n    def create(cls, name: str) -> "Data":\n        return cls(name)\n\n    @staticmethod\n    async def stat(x: int = 4, **kw) -> int:\n        return x\n'''
    output = analyzer.build({'schema': 1, 'files': [{
        'uri': 'file:///tmp/project/pkg/m.py', 'root': 'file:///tmp/project', 'text': text, 'version': 2,
    }]})
    nodes = {n['qualifiedName']: n for n in output['nodes']}
    assert nodes['pkg.m.Runner']['stereotype'] == 'protocol'
    assert nodes['pkg.m.Data']['stereotype'] == 'dataclass'
    assert nodes['pkg.m.Data.summary']['kind'] == 'property'
    assert nodes['pkg.m.Data.create']['decorators'] == ['classmethod']
    assert nodes['pkg.m.Data.stat']['async_']
    assert [a['name'] for a in nodes['pkg.m.Data']['attributes']] == ['name', 'count']


def test_import_aliases_and_inherited_types():
    files = [
        ('a.py', 'from b import Base as Parent, work as job\n\nclass Child(Parent):\n    def run(self):\n        return job()\n'),
        ('b.py', 'class Base: pass\n\ndef work(): return 1\n'),
    ]
    graph = analyzer.build({'schema': 1, 'files': [
        {'uri': f'file:///root/{name}', 'root': 'file:///root', 'text': code, 'version': 1}
        for name, code in files
    ]})
    idx = {n['id']: n['qualifiedName'] for n in graph['nodes']}
    lines = {(idx[e['source']], e['kind'], idx[e['target']]) for e in graph['edges']}
    assert ('a.Child', 'inherits', 'b.Base') in lines
    assert ('a.Child.run', 'calls', 'b.work') in lines


def test_module_attribute_call_resolution():
    graph = analyzer.build({'schema': 1, 'files': [
        {'uri': 'file:///root/a.py', 'root': 'file:///root', 'text': 'import b as tool\n\ndef work():\n    return tool.run()\n', 'version': 1},
        {'uri': 'file:///root/b.py', 'root': 'file:///root', 'text': 'def run():\n    return 1\n', 'version': 1},
    ]})
    idx = {n['id']: n['qualifiedName'] for n in graph['nodes']}
    assert ('a.work', 'b.run') in {(idx[e['source']], idx[e['target']]) for e in graph['edges'] if e['kind'] == 'calls'}


def test_self_calls_and_nested_functions():
    graph = analyzer.build({'schema': 1, 'files': [{
        'uri': 'file:///root/a.py', 'root': 'file:///root', 'text': '''
class A:
    def outer(self):
        def inner():
            return 1
        self.finish()
        return inner()
    def finish(self):
        return 2
''', 'version': 1,
    }]})
    idx = {n['id']: n['qualifiedName'] for n in graph['nodes']}
    actual = {(idx[e['source']], idx[e['target']]) for e in graph['edges'] if e['kind'] == 'calls'}
    assert ('a.A.outer', 'a.A.finish') in actual
    assert ('a.A.outer', 'a.A.outer.inner') in actual
    assert all(caller != 'a.A.finish' for caller, _ in actual)


def test_import_of_nested_module_generates_import_edge():
    graph = analyzer.build({'schema': 1, 'files': [
        {'uri': 'file:///root/pkg/a.py', 'root': 'file:///root', 'text': 'from . import b\n', 'version': 1},
        {'uri': 'file:///root/pkg/b.py', 'root': 'file:///root', 'text': 'x = 1', 'version': 1},
    ]})
    idx = {n['id']: n['qualifiedName'] for n in graph['nodes']}
    assert ('pkg.a', 'pkg.b') in {(idx[e['source']], idx[e['target']]) for e in graph['edges'] if e['kind'] == 'imports'}
