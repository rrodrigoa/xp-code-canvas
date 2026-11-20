"""Python AST columns are UTF-8 bytes; VS Code protocol positions are UTF-16 units."""
from __future__ import annotations
import ast

class SourcePositions:
    def __init__(self, text: str):
        self.lines = text.splitlines(keepends=True)

    def column(self, lineno: int, byte_column: int) -> int:
        if lineno < 1 or lineno > len(self.lines):
            return 0
        line = self.lines[lineno - 1].encode('utf-8')
        prefix = line[:max(0, byte_column)].decode('utf-8', errors='ignore')
        return len(prefix.encode('utf-16-le')) // 2

    def span(self, node: ast.AST, include_decorators: bool = False) -> dict[str, int]:
        start_line = int(getattr(node, 'lineno', 1))
        start_byte = int(getattr(node, 'col_offset', 0))
        if include_decorators and getattr(node, 'decorator_list', None):
            first = min(node.decorator_list, key=lambda item: (item.lineno, item.col_offset))
            start_line = first.lineno
            # Decorator line starts with @, which is before expression start (typically one column).
            start_byte = max(0, first.col_offset - 1)
        end_line = int(getattr(node, 'end_lineno', getattr(node, 'lineno', 1)))
        end_byte = int(getattr(node, 'end_col_offset', getattr(node, 'col_offset', 0)))
        return {'startLine': max(0, start_line - 1), 'startCharacter': self.column(start_line, start_byte),
                'endLine': max(0, end_line - 1), 'endCharacter': self.column(end_line, end_byte)}

    def extract(self, span: dict[str, int]) -> str:
        lines = self.lines[span['startLine']:span['endLine'] + 1]
        if not lines:
            return ''
        lines = list(lines)
        def index_at(text: str, utf16_offset: int) -> int:
            count = 0
            for i, char in enumerate(text):
                width = len(char.encode('utf-16-le')) // 2
                if count + width > utf16_offset:
                    return i
                count += width
            return len(text)
        original_start = self.lines[span['startLine']]
        start_index = index_at(original_start, span['startCharacter'])
        if len(lines) == 1:
            end_index = index_at(original_start, span['endCharacter'])
            return original_start[start_index:end_index]
        lines[0] = original_start[start_index:]
        lines[-1] = lines[-1][:index_at(lines[-1], span['endCharacter'])]
        return ''.join(lines)
