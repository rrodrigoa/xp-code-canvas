"""Conservative Python lexical call target resolution; never claim dynamic dispatch certainty."""
from __future__ import annotations
import ast
from typing import Any
from .imports import absolute_import
from .scopes import LexicalScope

class CallResolver:
    def __init__(self, files: list[Any]):
        self.files = files
        self.by_module = {(f.root,f.module): f for f in files}
        self.by_id = {n['id']: n for f in files for n in f.nodes}
        self.by_name: dict[tuple[str,str],list[dict]] = {}
        for f in files:
            for node in f.nodes:
                self.by_name.setdefault((f.uri,node['qualifiedName']), []).append(node)

    def named(self, uri: str, qualified: str) -> dict | None:
        candidates=self.by_name.get((uri,qualified),[])
        return candidates[-1] if candidates else None

    def module(self, f: Any, name: str) -> Any | None:
        absolute=absolute_import(f.module,name,is_package=f.uri.endswith('/__init__.py'))
        return self.by_module.get((f.root,absolute))

    def imported(self, f: Any, scope: LexicalScope, name: str) -> dict | None:
        binding=scope.imported.get(name)
        if binding is None:
            return None
        mod,sym=binding
        target_file=self.module(f,mod)
        if target_file:
            if sym is None:
                return self.by_id.get(target_file.nodes[0]['id'])
            return self.named(target_file.uri,f'{target_file.module}.{sym}')
        if sym is not None:
            target_file=self.module(f,f'{mod}{sym}' if mod.endswith('.') else f'{mod}.{sym}')
            if target_file:
                return self.by_id.get(target_file.nodes[0]['id'])
        return None

    def binding(self, f: Any, scope: LexicalScope, name: str) -> dict | None:
        owner=scope.binding_scope(name)
        if owner is None:
            return None
        # Python lexical assignment shadows module/import binding, even if defined later.
        if name in owner.declarations:
            return self.by_id.get(owner.declarations[name][-1])
        if name in owner.imported:
            if name in owner.assignments:  # import value may have been overwritten
                return None
            return self.imported(f,owner,name)
        return None

    def target(self, f: Any, declaration: dict, scope: LexicalScope, fn: ast.expr) -> dict | None:
        if isinstance(fn,ast.Name):
            return self.binding(f,scope,fn.id)
        if not isinstance(fn,ast.Attribute) or not isinstance(fn.value,ast.Name):
            return None
        qualifier=fn.value.id
        if qualifier in ('self','cls'):
            parent=self.by_id.get(declaration.get('parentId'))
            if parent and parent['kind']=='class' and scope.binding_scope(qualifier) is scope:
                return self.named(f.uri,f"{parent['qualifiedName']}.{fn.attr}")
            return None
        base=self.binding(f,scope,qualifier)
        if base and base['kind'] in ('module','class'):
            return self.named(base['uri'],f"{base['qualifiedName']}.{fn.attr}")
        return None
