from __future__ import annotations
import ast
def unparse(node: ast.AST | None) -> str | None:
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except (ValueError, TypeError):
        return None


def stable_id(uri: str, qualified: str, kind: str) -> str:
    return hashlib.sha1(f"{uri}|{qualified}|{kind}".encode("utf8")).hexdigest()[:20]


def visibility(name: str) -> str:
    if name.startswith("__") and not name.endswith("__"):
        return "private"
    if name.startswith("_") and not name.startswith("__"):
        return "protected"
    return "public"


def decorators(node: ast.AST) -> list[str]:
    return [unparse(d) or "?" for d in getattr(node, "decorator_list", [])]


def signature(node: ast.AST) -> str:
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return ""
    args = node.args
    params: list[str] = []
    positionals = list(args.posonlyargs) + list(args.args)
    required = len(positionals) - len(args.defaults)
    for i, arg in enumerate(positionals):
        p = arg.arg
        if arg.annotation:
            p += ": " + (unparse(arg.annotation) or "?")
        if i >= required:
            p += " = " + (unparse(args.defaults[i - required]) or "...")
        params.append(p)
        if args.posonlyargs and i == len(args.posonlyargs) - 1:
            params.append("/")
    if args.vararg:
        params.append("*" + args.vararg.arg + (": " + (unparse(args.vararg.annotation) or "?") if args.vararg.annotation else ""))
    elif args.kwonlyargs:
        params.append("*")
    for arg, default in zip(args.kwonlyargs, args.kw_defaults):
        p = arg.arg + (": " + (unparse(arg.annotation) or "?") if arg.annotation else "")
        if default is not None:
            p += " = " + (unparse(default) or "...")
        params.append(p)
    if args.kwarg:
        params.append("**" + args.kwarg.arg + (": " + (unparse(args.kwarg.annotation) or "?") if args.kwarg.annotation else ""))
    output = f"{node.name}({', '.join(params)})"
    if node.returns:
        output += " -> " + (unparse(node.returns) or "?")
    return output
