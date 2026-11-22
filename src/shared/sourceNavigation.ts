import type {SourceCursor, SourceRange} from './types';
/** Validate client-provided caret against the indexed symbol. No stale or removed code is navigable. */
export function cursorWithinSymbol(cursor:SourceCursor|undefined,range:SourceRange):cursor is SourceCursor {
  if(!cursor||!Number.isSafeInteger(cursor.line)||!Number.isSafeInteger(cursor.character))return false;
  if(cursor.character<0||cursor.line<range.startLine||cursor.line>range.endLine)return false;
  // First line at column zero is intentionally valid for 'Edit without a selection'.
  if(cursor.line===range.endLine&&cursor.character>range.endCharacter)return false;
  return true;
}
