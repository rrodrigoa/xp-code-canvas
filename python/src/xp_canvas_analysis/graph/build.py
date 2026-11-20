"""Immutable graph assembly from isolated per-document facts."""
from __future__ import annotations
import ast
import hashlib
from typing import Any
from ..semantics.calls import CallResolver
from ..semantics.imports import absolute_import
from .identities import evidence_id


def build_graph(files: list[Any], diagnostics: list[dict], include_source: bool = False) -> dict[str,Any]:
    resolver=CallResolver(files)
    nodes=[dict(n) for f in files for n in f.nodes]
    node_map={n['id']:n for n in nodes}
    relations:dict[tuple[str,str,str],dict]={}
    unresolved=[]
    def add(src:dict,dst:dict,kind:str,loc:dict,confidence='resolved'):
        key=(src['id'],dst['id'],kind)
        if key not in relations:
            relations[key]={'id':hashlib.sha256('|'.join(key).encode()).hexdigest()[:24],
                            'source':src['id'],'target':dst['id'],'kind':kind,'confidence':confidence,'evidence':[]}
        item={'uri':src['uri'],'range':loc,'version':src['version'],'contentHash':src.get('contentHash',''), 'language':'python','adapter':'ast',
              'id':evidence_id(src['uri'],loc,src['id'],dst['id'],kind)}
        if not any(x['id']==item['id'] for x in relations[key]['evidence']):
            relations[key]['evidence'].append(item)

    for f in files:
        module=node_map[f.nodes[0]['id']]
        for stmt in ast.walk(f.tree):
            if not isinstance(stmt,(ast.Import,ast.ImportFrom)):
                continue
            candidates=[]
            if isinstance(stmt,ast.Import):
                candidates=[x.name for x in stmt.names]
            else:
                base='.'*stmt.level+(stmt.module or '')
                candidates=[base]+[base+item.name if base.endswith('.') else f'{base}.{item.name}' for item in stmt.names]
            for target_name in candidates:
                target=resolver.module(f,target_name)
                if target:
                    add(module,node_map[target.nodes[0]['id']],'imports',f.positions.span(stmt))
        for item,node,definition_scope in f.entries:
            src=node_map[node['id']]
            if isinstance(item,ast.ClassDef):
                for base in item.bases:
                    target=resolver.target(f,node,definition_scope,base)
                    if target and target['kind']=='class':
                        add(src,target,'inherits',f.positions.span(base))
                continue
            scope=f.scopes[id(item)]
            class Calls(ast.NodeVisitor):
                blocked: set[str] = set()
                def visit_FunctionDef(self, current):
                    if current is item:
                        self.generic_visit(current)
                def visit_AsyncFunctionDef(self, current):
                    if current is item:
                        self.generic_visit(current)
                def visit_ClassDef(self,current):
                    pass
                def visit_Lambda(self,current):
                    pass
                def visit_comprehension_expr(self,current):
                    # Comprehension targets have an independent local binding scope.
                    shadowed=set()
                    for gen in current.generators:
                        for part in ast.walk(gen.target):
                            if isinstance(part,ast.Name):shadowed.add(part.id)
                    old=self.blocked
                    self.blocked=old|shadowed
                    for gen in current.generators:
                        self.visit(gen.iter)
                        for cond in gen.ifs:self.visit(cond)
                    if isinstance(current,ast.DictComp):
                        self.visit(current.key);self.visit(current.value)
                    else:self.visit(current.elt)
                    self.blocked=old
                def visit_ListComp(self,current):self.visit_comprehension_expr(current)
                visit_SetComp=visit_ListComp
                visit_GeneratorExp=visit_ListComp
                visit_DictComp=visit_ListComp
                def visit_Call(self,call):
                    shadowed=isinstance(call.func,ast.Name) and call.func.id in self.blocked
                    target=None if shadowed else resolver.target(f,node,scope,call.func)
                    if target:
                        add(src,target,'creates' if target['kind']=='class' else 'calls',f.positions.span(call),
                            'ambiguous' if isinstance(call.func,ast.Attribute) and isinstance(call.func.value,ast.Name) and call.func.value.id in ('self','cls') else 'resolved')
                    else:
                        unresolved.append({'ownerId':src['id'],'expression':ast.unparse(call.func)[:256],
                                           'range':f.positions.span(call),'confidence':'unresolved'})
                    self.generic_visit(call)
            Calls().visit(item)
    if include_source:
        for f in files:
            for node in f.nodes:
                if node['kind']=='module':
                    node_map[node['id']]['source']=f.text
                else:
                    node_map[node['id']]['source']=f.positions.extract(node['range'])
    seen_diagnostics={(d['uri'],d['line'],d['message']) for d in diagnostics}
    for f in files:
        if f.stale and f.diagnostic:
            key=(f.diagnostic['uri'],f.diagnostic['line'],f.diagnostic['message'])
            if key not in seen_diagnostics:
                diagnostics.append(f.diagnostic)
                seen_diagnostics.add(key)
    for f in files:
        if f.stale:
            for node in f.nodes:
                node_map[node['id']]['stale']=True
    return {'schema':1,'nodes':nodes,'edges':list(relations.values()),'diagnostics':diagnostics,
            'unresolved':unresolved,'stats':{'files':len(files),'symbols':len(nodes),'relationships':len(relations),'unresolved':len(unresolved)}}
