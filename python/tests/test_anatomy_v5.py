from xp_canvas_analysis.syntax.symbol_extractor import parse_file


def test_anatomy_is_source_backed_and_distinguishes_constructs():
    source = '''\ndef work(items):
    for item in items:
        if item == 3:
            return item
        try:
            with open('f') as fh:
                assert fh
        except OSError:
            raise
    return None
'''
    facts = parse_file({'uri': 'file:///sample.py', 'root': '', 'text': source, 'version': 2})
    work = next(n for n in facts.nodes if n['name'] == 'work')
    regions = work['anatomy']
    assert {'loop', 'branch', 'return', 'exception', 'context', 'raise'} <= {r['kind'] for r in regions}
    assert all(r['range']['startLine'] >= work['range']['startLine'] for r in regions)
    assert regions == sorted(regions,key=lambda r:(r['range']['startLine'],r['range']['startCharacter'],r['depth']))


def test_no_fake_sections_and_nested_defs_excluded():
    source='def outer():\n    def inner():\n        if True: return 1\n    return inner()\n'
    facts=parse_file({'uri':'file:///foo.py','root':'','text':source})
    outer=next(n for n in facts.nodes if n['name']=='outer')
    assert [r['kind'] for r in outer['anatomy']] == ['return']


def test_utf16_anatomy_column():
    source='def f():\n    if "😀":\n        return 1\n'
    facts=parse_file({'uri':'file:///unicode.py','root':'','text':source})
    func=next(n for n in facts.nodes if n['name']=='f')
    assert func['anatomy'][0]['range']['startLine']==1


def test_anatomy_output_is_bounded_for_large_functions():
    source='def many():\n'+''.join(f'    if {i}:\n        return {i}\n' for i in range(150))
    facts=parse_file({'uri':'file:///huge.py','root':'','text':source})
    method=next(n for n in facts.nodes if n['name']=='many')
    assert len(method['anatomy'])==72


def test_anatomy_survives_incremental_graph_protocol():
    from xp_canvas_analysis.session import AnalyzerSession
    index=AnalyzerSession()
    graph=index.apply([{'uri':'file:///x.py','root':'','text':'def f(x):\n    if x:\n        return x\n','version':1}])
    node=next(n for n in graph['nodes'] if n['name']=='f')
    assert node['anatomy'][0]['kind']=='branch'
    assert node['anatomy'][0]['range']['startLine']==1
