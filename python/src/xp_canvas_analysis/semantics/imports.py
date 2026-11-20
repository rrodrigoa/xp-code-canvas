"""Resolve module names from workspace source roots only."""
from __future__ import annotations

def module_name(uri: str, root: str) -> str:
    relative = uri[len(root.rstrip('/') + '/'): ] if uri.startswith(root.rstrip('/') + '/') else uri.rsplit('/',1)[-1]
    name = relative.removesuffix('.py').replace('/', '.')
    if name.endswith('.__init__'):
        name = name[:-len('.__init__')]
    return name or '__root__'

def absolute_import(module: str, imported: str, *, is_package: bool = False) -> str:
    if not imported.startswith('.'):
        return imported
    dots = len(imported) - len(imported.lstrip('.'))
    trail = imported[dots:]
    parts = module.split('.') if is_package else module.split('.')[:-1]
    if dots > 1:
        parts = parts[:max(0, len(parts) - dots + 1)]
    return '.'.join(part for part in [*parts, trail] if part)
