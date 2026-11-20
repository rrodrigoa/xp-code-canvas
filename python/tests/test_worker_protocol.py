import io
import json
from xp_canvas_analysis import protocol

def test_worker_envelopes_handle_errors_and_reuse(monkeypatch):
    messages=[
        {'rpcVersion':2,'requestId':'one','method':'index','files':[{'uri':'file:///p/a.py','root':'file:///p','text':'def a(): pass\n','version':1}]},
        {'rpcVersion':2,'requestId':'two','method':'health'},
        {'rpcVersion':2,'requestId':'three','method':'unknown'},
        {'rpcVersion':3,'requestId':'four','method':'health'},
        {'rpcVersion':2,'requestId':'','method':'health'},
    ]
    output=io.StringIO()
    monkeypatch.setattr(protocol.sys,'stdin',io.StringIO(''.join(json.dumps(msg)+'\n' for msg in messages)+'!invalid json\n'))
    monkeypatch.setattr(protocol.sys,'stdout',output)
    protocol.main()
    results=[json.loads(line) for line in output.getvalue().splitlines()]
    assert results[0]['result']['stats']['files']==1
    assert results[1]['result']['reparsed']==1
    assert all('error' in item for item in results[2:])

def test_large_request_is_rejected_without_processing(monkeypatch):
    output=io.StringIO()
    monkeypatch.setattr(protocol,'MAX_LINE',100)
    monkeypatch.setattr(protocol.sys,'stdin',io.StringIO('x'*101+'\n'))
    monkeypatch.setattr(protocol.sys,'stdout',output)
    protocol.main()
    assert 'exceeds' in json.loads(output.getvalue())['error']

def test_utf16_offsets_varied_unicode():
    import ast
    from xp_canvas_analysis.syntax.source_positions import SourcePositions
    for prefix in ('# café ', '# 漢字 ', '# a\u0301 ', '# 😀 ', '# 🧪🚀 '):
        text=f'def f():\r\n    {prefix}g()\r\n'
        positions=SourcePositions(text)
        # Find a syntactically valid call by replacing comment with a string literal.
        code=f'def f():\r\n    "{prefix}"; g()\r\n'
        tree=ast.parse(code)
        call=next(n for n in ast.walk(tree) if isinstance(n,ast.Call))
        source=SourcePositions(code)
        expected=len(code.splitlines()[1][:code.splitlines()[1].find('g()')].encode('utf-16-le'))//2
        assert source.span(call)['startCharacter']==expected

def test_parameter_nonlocal_and_global_bindings():
    from xp_canvas_analysis.session import build
    lines='''def local():pass

def outer():
    def nested():pass
    def inner():
        nonlocal nested
        nested()
    return inner()

def global_call():
    global local
    return local()
'''
    graph=build({'schema':1,'files':[{'uri':'file:///p/a.py','root':'file:///p','text':lines,'version':1}]})
    names={n['id']:n['qualifiedName'] for n in graph['nodes']}
    pairs={(names[e['source']],names[e['target']]) for e in graph['edges'] if e['kind']=='calls'}
    assert ('a.outer.inner','a.outer.nested') in pairs
    assert ('a.global_call','a.local') in pairs
