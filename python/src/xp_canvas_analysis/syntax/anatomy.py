"""Bounded, deterministic Python control-structure regions for visual inspection.

A region describes syntax, not execution frequency or control-flow reachability.
Its source locations use the same VS Code UTF-16 coordinates as symbol ranges.
"""
from __future__ import annotations

import ast
from typing import Any
from .source_positions import SourcePositions

REGION_LIMIT = 72


def code_regions(node: ast.AST, positions: SourcePositions) -> list[dict[str, Any]]:
    """Return source-ordered regions inside a function, without traversing nested declarations."""
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return []
    results: list[dict[str, Any]] = []

    def label(prefix: str, test: ast.AST | None = None) -> str:
        if test is None:
            return prefix
        try:
            expr = ast.unparse(test).replace('\n', ' ')
        except (ValueError, TypeError, RecursionError):
            expr = '…'
        return f'{prefix} {expr[:67]}'

    def record(stmt: ast.stmt, kind: str, text: str, depth: int) -> None:
        if len(results) >= REGION_LIMIT:
            return
        results.append({
            'id': f'{kind}:{stmt.lineno}:{stmt.col_offset}',
            'kind': kind, 'label': text[:88], 'depth': min(depth, 7),
            'range': positions.span(stmt),
        })

    def walk(body: list[ast.stmt], depth: int = 0) -> None:
        for stmt in body:
            if len(results) >= REGION_LIMIT:
                return
            if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                # Nested definitions are independently represented as UML nodes.
                continue
            if isinstance(stmt, ast.If):
                record(stmt, 'branch', label('if', stmt.test), depth)
                walk(stmt.body, depth + 1)
                walk(stmt.orelse, depth + 1)
            elif isinstance(stmt, (ast.For, ast.AsyncFor, ast.While)):
                name = 'while' if isinstance(stmt, ast.While) else ('async for' if isinstance(stmt, ast.AsyncFor) else 'for')
                test = stmt.test if isinstance(stmt, ast.While) else stmt.target
                record(stmt, 'loop', label(name, test), depth)
                walk(stmt.body, depth + 1)
                walk(stmt.orelse, depth + 1)
            elif isinstance(stmt, (ast.Try, getattr(ast, 'TryStar', ast.Try))):
                record(stmt, 'exception', 'try / except', depth)
                walk(stmt.body, depth + 1)
                for handler in stmt.handlers:
                    record(handler, 'exception', label('except', handler.type), depth + 1)
                    walk(handler.body, depth + 2)
                walk(stmt.orelse, depth + 1)
                walk(stmt.finalbody, depth + 1)
            elif isinstance(stmt, (ast.With, ast.AsyncWith)):
                record(stmt, 'context', 'async with' if isinstance(stmt, ast.AsyncWith) else 'with', depth)
                walk(stmt.body, depth + 1)
            elif isinstance(stmt, ast.Match):
                record(stmt, 'branch', label('match', stmt.subject), depth)
                for case in stmt.cases:
                    # match_case has no standard lineno; record its body statements instead.
                    walk(case.body, depth + 1)
            elif isinstance(stmt, ast.Return):
                record(stmt, 'return', 'return', depth)
            elif isinstance(stmt, ast.Raise):
                record(stmt, 'raise', 'raise', depth)
            elif isinstance(stmt, ast.Assert):
                record(stmt, 'branch', label('assert', stmt.test), depth)
            elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, (ast.Yield, ast.YieldFrom)):
                record(stmt, 'return', 'yield', depth)

    walk(node.body)
    results.sort(key=lambda r: (r['range']['startLine'], r['range']['startCharacter'],r['depth']))
    return results
