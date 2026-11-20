"""Worker persistence, edit-during-error, incremental parsing, UTF16, redefinition tests."""
import json
import os
from pathlib import Path
import subprocess
import sys
from xp_canvas_analysis.session import AnalyzerSession

def doc(uri, text, version=1, root='file:///project'):
    return {'uri': uri, 'root': root, 'text': text, 'version': version}

def test_incremental_file_edit_reuses_unrelated_parse():
    sess = AnalyzerSession()
    a = doc('file:///project/a.py', 'from b import f\ndef g(): return f()\n')
    b = doc('file:///project/b.py', 'def f(): pass\n')
    sess.apply([a,b]); assert sess.parse_count == 2
    again = sess.apply([doc(a['uri'],a['text']+'\n',version=2)])
    assert sess.parse_count == 3
    assert again['stats']['files'] == 2
    assert any(e['kind']=='calls' for e in again['edges'])

def test_syntax_error_retains_stale_only_in_changed_file():
    sess = AnalyzerSession()
    sess.apply([doc('file:///project/a.py','def good(): return 1\n'),doc('file:///project/b.py','def other(): return 2\n')])
    broken = sess.apply([doc('file:///project/a.py','def broken(\n',version=2)])
    assert broken['availability']=='stale'
    assert broken['diagnostics']
    a = next(n for n in broken['nodes'] if n['qualifiedName']=='a.good')
    b = next(n for n in broken['nodes'] if n['qualifiedName']=='b.other')
    assert a['stale'] and a['version']==1
    assert not b['stale']
    repaired = sess.apply([doc('file:///project/a.py','def fixed(): return 3\n',version=3)])
    assert repaired['availability']=='complete'
    assert not any(n['stale'] for n in repaired['nodes'])
    assert any(n['qualifiedName']=='a.fixed' for n in repaired['nodes'])

def test_delete_removes_symbols_without_reparsing_others():
    s=AnalyzerSession()
    s.apply([doc('file:///project/a.py','def a(): pass\n'),doc('file:///project/b.py','def b(): pass\n')])
    g=s.apply([],['file:///project/a.py'])
    assert s.parse_count==2
    assert {n['qualifiedName'] for n in g['nodes']}=={'b','b.b'}

def test_unicode_utf16_code_preview_with_decorators():
    from xp_canvas_analysis.syntax.source_positions import SourcePositions
    code='# 😀\n@dec\ndef f():\n    x = "🙂"; g()\n'
    pos=SourcePositions(code)
    assert pos.column(4,len('    x = "🙂"; '.encode('utf-8'))) == len('    x = "🙂"; '.encode('utf-16-le'))//2
    from xp_canvas_analysis.session import build
    graph=build({'schema':1,'files':[doc('file:///project/a.py',code)]})
    assert '@dec' in next(n for n in graph['nodes'] if n['qualifiedName']=='a.f')['source']

def test_redefinitions_no_duplicate_ids_and_2_callsites():
    s=AnalyzerSession(); g=s.apply([doc('file:///project/a.py','def f(): pass\ndef f(): pass\ndef g():\n f();f()\n')])
    assert len({n['id'] for n in g['nodes']})==len(g['nodes'])
    call = next(e for e in g['edges'] if e['kind']=='calls')
    assert len(call['evidence']) == 2

def test_1000_files_incremental_reparse_one():
    s=AnalyzerSession()
    items=[doc(f'file:///project/m{i}.py',f'def f{i}(): return {i}\n') for i in range(1000)]
    first=s.apply(items)
    assert first['stats']['files']==1000 and s.parse_count==1000
    update=s.apply([doc('file:///project/m714.py','def f714(): return 2\n',version=2)])
    assert s.parse_count==1001 and update['stats']['files']==1000

def test_persistent_isolated_worker_rpc(tmp_path):
    script=Path(__file__).resolve().parents[1]/'entrypoint.py'
    process=subprocess.Popen([sys.executable,'-I','-S','-u','-X','utf8',str(script)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
    assert process.stdin and process.stdout
    def call(num,files,removed=None):
        process.stdin.write(json.dumps({'rpcVersion':2,'requestId':str(num),'method':'index','files':files,'removed':removed or []},ensure_ascii=False)+'\n')
        process.stdin.flush()
        return json.loads(process.stdout.readline())
    try:
        a=call(1,[doc('file:///project/a.py','def f(): pass\n')]); assert a['requestId']=='1'
        b=call(2,[]); assert b['result']['stats']['reparsed']==1
        c=call(3,[doc('file:///project/b.py','def b(): pass\n')]); assert c['result']['stats']['reparsed']==2
        d=call(4,[],['file:///project/a.py']); assert d['result']['stats']['files']==1
        e=call(5,[doc('file:///project/café.py','def café():\n    """Français — Δ 中文"""\n    return "é"\n')])
        assert 'error' not in e
        assert any(n['name']=='café' and '中文' in n['docstring'] for n in e['result']['nodes'])
    finally:
        process.terminate();process.wait(timeout=5)

def test_reordering_distinct_duplicate_declarations_reconciles_unique_bodies():
    from xp_canvas_analysis.session import AnalyzerSession
    s=AnalyzerSession()
    a='def f(): return 1\ndef f(): return 2\n'
    b='def f(): return 2\ndef f(): return 1\n'
    first=s.apply([doc('file:///project/a.py',a)])
    second=s.apply([doc('file:///project/a.py',b,version=2)])
    ids_first={n['structuralHash']:n['id'] for n in first['nodes'] if n['kind']=='function'}
    ids_next={n['structuralHash']:n['id'] for n in second['nodes'] if n['kind']=='function'}
    assert ids_first==ids_next
    assert len(set(ids_next.values()))==2

def test_declarations_in_conditionals_are_indexed_without_importing_module():
    from xp_canvas_analysis.session import build
    text='if True:\n    def selected(): pass\n\nclass A:\n    if True:\n        def check(self): pass\n'
    graph=build({'schema':1,'files':[doc('file:///project/a.py',text)]})
    qns={n['qualifiedName'] for n in graph['nodes']}
    assert 'a.selected' in qns and 'a.A.check' in qns

def test_import_overwritten_by_local_assignment_is_not_confirmed_call():
    from xp_canvas_analysis.session import build
    source='from tools import search\nsearch = object()\ndef run():\n    return search()\n'
    graph=build({'schema':1,'files':[doc('file:///project/a.py',source),doc('file:///project/tools.py','def search(): pass\n')]})
    idx={n['id']:n['qualifiedName'] for n in graph['nodes']}
    assert not any(idx[e['source']]=='a.run' and idx[e['target']]=='tools.search' for e in graph['edges'] if e['kind']=='calls')

def test_comprehension_target_shadowing_does_not_claim_imported_call():
    from xp_canvas_analysis.session import build
    source='from tools import search\ndef run(items):\n    return [search() for search in items]\n'
    graph=build({'schema':1,'files':[doc('file:///project/a.py',source),doc('file:///project/tools.py','def search(): pass\n')]})
    idx={n['id']:n['qualifiedName'] for n in graph['nodes']}
    assert not any(idx[e['source']]=='a.run' and idx[e['target']]=='tools.search' for e in graph['edges'] if e['kind']=='calls')
