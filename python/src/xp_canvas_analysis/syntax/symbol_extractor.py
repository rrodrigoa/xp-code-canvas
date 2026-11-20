"""Parse a file independently and inventory declarations, scopes and source ranges."""
from __future__ import annotations
import ast
import hashlib
from dataclasses import dataclass, field
from typing import Any
from ..graph.identities import symbol_id
from ..semantics.imports import module_name
from ..semantics.scopes import LexicalScope, create_scope
from .source_positions import SourcePositions
from .anatomy import code_regions
from .signatures import decorators, signature, unparse, visibility

@dataclass
class FileFacts:
    uri: str
    root: str
    module: str
    version: int
    content_hash: str
    tree: ast.Module
    text: str
    nodes: list[dict[str, Any]] = field(default_factory=list)
    entries: list[tuple[ast.AST, dict[str, Any], LexicalScope]] = field(default_factory=list)
    scopes: dict[int, LexicalScope] = field(default_factory=dict)
    positions: SourcePositions | None = None
    stale: bool = False
    diagnostic: dict[str, Any] | None = None


def parse_file(item: dict[str, Any]) -> FileFacts:
    uri, root, text = item['uri'], item.get('root', ''), item.get('text', '')
    if len(text) > 20_000_000:
        raise ValueError('Python source file exceeds 20 MiB analysis limit')
    tree = ast.parse(text, filename=uri, type_comments=True)
    module = module_name(uri, root)
    positions = SourcePositions(text)
    f = FileFacts(uri, root, module, int(item.get('version', 0)), hashlib.sha256(text.encode()).hexdigest(), tree, text, positions=positions)
    counts: dict[tuple[str,str],int] = {}
    root_scope = create_scope(tree, None)
    f.scopes[id(tree)] = root_scope

    def make(kind: str, qualified: str, name: str, parent: str | None, item_node: ast.AST) -> dict[str, Any]:
        key = (qualified,kind)
        occurrence = counts.get(key, 0)
        counts[key] = occurrence + 1
        full = positions.span(item_node, include_decorators=True)
        selection = positions.span(item_node, include_decorators=False)
        dec = decorators(item_node)
        stereotype = None
        if isinstance(item_node, ast.ClassDef):
            stereotype = 'protocol' if any((unparse(b) or '').endswith('Protocol') for b in item_node.bases) else 'dataclass' if any(d.endswith('dataclass') for d in dec) else None
        return dict(id=symbol_id(uri, qualified, kind, occurrence), identityVersion=2, kind=kind,
                    name=name, qualifiedName=qualified, uri=uri, root=root, module=module,
                    moduleId=symbol_id(uri,module,'module'), parentId=parent, range=full,
                    selectionRange=selection, version=f.version, contentHash=f.content_hash,
                    visibility=visibility(name), decorators=dec, signature=signature(item_node),
                    docstring=(ast.get_docstring(item_node) or '').split('\n')[0][:200],
                    attributes=[], operations=[], bases=[unparse(x) or '?' for x in item_node.bases] if isinstance(item_node,ast.ClassDef) else [],
                    async_=isinstance(item_node,ast.AsyncFunctionDef), stereotype=stereotype,
                    structuralHash=hashlib.sha256(ast.dump(item_node, include_attributes=False).encode()).hexdigest()[:24],
                    confidence='resolved', stale=False, source='', anatomy=code_regions(item_node,positions))

    mod = make('module', module, module.rsplit('.',1)[-1], None, tree)
    mod['range'] = {'startLine':0,'startCharacter':0,'endLine':max(0,len(text.splitlines())-1),'endCharacter':0}
    f.nodes.append(mod)

    def index(owner: ast.AST, prefix: str, parent_id: str, scope: LexicalScope, inside_class: bool = False) -> None:
        for statement in getattr(owner, 'body', []):
            if not isinstance(statement, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                # Conditional and exception suites share their enclosing lexical scope.
                # Walk declarations in them without traversing expressions/comprehensions.
                blocks = []
                for attr in ('body', 'orelse', 'finalbody'):
                    nested = getattr(statement,attr,None)
                    if isinstance(nested,list): blocks.extend(nested)
                if isinstance(statement, (ast.Try, getattr(ast,'TryStar',ast.Try))):
                    for handler in statement.handlers: blocks.extend(handler.body)
                if isinstance(statement,ast.Match):
                    for case in statement.cases: blocks.extend(case.body)
                if blocks: index(ast.Module(body=blocks,type_ignores=[]),prefix,parent_id,scope,inside_class)
                continue
            qualified = f'{prefix}.{statement.name}'
            kind = 'class' if isinstance(statement,ast.ClassDef) else 'method' if inside_class else 'function'
            dec = decorators(statement)
            if kind == 'method' and any(d == 'property' or d.endswith('.setter') or d.endswith('.deleter') for d in dec):
                kind = 'property'
            node = make(kind, qualified, statement.name, parent_id, statement)
            f.nodes.append(node)
            scope.declarations.setdefault(statement.name, []).append(node['id'])
            f.entries.append((statement,node,scope))
            child_scope = create_scope(statement, scope)
            f.scopes[id(statement)] = child_scope
            index(statement, qualified, node['id'], child_scope, isinstance(statement, ast.ClassDef))
            if isinstance(statement,ast.ClassDef):
                attrs=[]
                for inner in ast.walk(statement):
                    if isinstance(inner,(ast.Assign,ast.AnnAssign)):
                        targets=inner.targets if isinstance(inner,ast.Assign) else [inner.target]
                        for target in targets:
                            if isinstance(target,ast.Attribute) and isinstance(target.value,ast.Name) and target.value.id=='self':
                                if not any(a['name']==target.attr for a in attrs):
                                    attrs.append({'name':target.attr,'type':unparse(inner.annotation) if isinstance(inner,ast.AnnAssign) else None,'visibility':visibility(target.attr)})
                        if isinstance(inner,ast.AnnAssign) and isinstance(inner.target,ast.Name) and not any(a['name']==inner.target.id for a in attrs):
                            attrs.append({'name':inner.target.id,'type':unparse(inner.annotation),'visibility':visibility(inner.target.id)})
                node['attributes']=attrs

    index(tree, module, mod['id'], root_scope)
    return f
