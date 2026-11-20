"""Lexical bindings for conservative static resolution, without executing code."""
from __future__ import annotations
import ast
from dataclasses import dataclass, field

@dataclass
class LexicalScope:
    owner: ast.AST
    parent: 'LexicalScope | None' = None
    local_names: set[str] = field(default_factory=set)
    globals: set[str] = field(default_factory=set)
    nonlocals: set[str] = field(default_factory=set)
    imported: dict[str, tuple[str, str | None]] = field(default_factory=dict)
    assignments: set[str] = field(default_factory=set)
    declarations: dict[str, list[str]] = field(default_factory=dict)

    def declares(self, name: str) -> bool:
        return name in self.local_names or name in self.declarations or name in self.imported

    def binding_scope(self, name: str) -> 'LexicalScope | None':
        if name in self.globals:
            root = self
            while root.parent is not None:
                root = root.parent
            return root
        if name in self.nonlocals:
            scope = self.parent
            while scope is not None:
                if scope.declares(name) and not isinstance(scope.owner, ast.ClassDef):
                    return scope
                scope = scope.parent
            return None
        if self.declares(name):
            return self
        scope = self.parent
        # Python methods do not capture a class suite's bindings as bare names.
        while scope is not None:
            if isinstance(scope.owner, ast.ClassDef):
                scope = scope.parent
                continue
            if scope.declares(name):
                return scope
            scope = scope.parent
        return None

class ScopeCollector(ast.NodeVisitor):
    """Inventory all bindings in a lexical block; nested defs are not traversed."""
    def __init__(self):
        self.names: set[str] = set()
        self.globals: set[str] = set()
        self.nonlocals: set[str] = set()
        self.imports: dict[str, tuple[str, str | None]] = {}
        self.assignments: set[str] = set()

    def visit_Global(self, node: ast.Global):
        self.globals.update(node.names)
    def visit_Nonlocal(self, node: ast.Nonlocal):
        self.nonlocals.update(node.names)
    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.names.add(node.name)
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self.names.add(node.name)
    def visit_ClassDef(self, node: ast.ClassDef):
        self.names.add(node.name)
    def visit_Name(self, node: ast.Name):
        if isinstance(node.ctx, (ast.Store, ast.Del)):
            self.names.add(node.id)
            self.assignments.add(node.id)
    def visit_Import(self, node: ast.Import):
        for item in node.names:
            name = item.asname or item.name.split('.')[0]
            self.names.add(name)
            self.imports[name] = (item.name, None)
    def visit_ImportFrom(self, node: ast.ImportFrom):
        base = '.' * node.level + (node.module or '')
        for item in node.names:
            if item.name == '*':
                continue
            name = item.asname or item.name
            self.names.add(name)
            self.imports[name] = (base, item.name)
    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        if node.name:
            self.names.add(node.name)
        self.generic_visit(node)
    def visit_Lambda(self, node: ast.Lambda):
        pass
    def visit_ListComp(self, node: ast.ListComp):
        pass
    visit_SetComp = visit_ListComp
    visit_DictComp = visit_ListComp
    visit_GeneratorExp = visit_ListComp

def create_scope(owner: ast.AST, parent: LexicalScope | None) -> LexicalScope:
    col = ScopeCollector()
    if isinstance(owner, (ast.Module, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
        for node in owner.body:
            col.visit(node)
    if isinstance(owner, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
        args = owner.args
        col.names.update(arg.arg for arg in (*args.posonlyargs, *args.args, *args.kwonlyargs))
        if args.vararg: col.names.add(args.vararg.arg)
        if args.kwarg: col.names.add(args.kwarg.arg)
    return LexicalScope(owner, parent, col.names - col.globals - col.nonlocals, col.globals, col.nonlocals, col.imports, col.assignments)
