import type {SourceCursor} from '../shared/types';
/** Maps a DOM selection inside Prism's nested spans to a UTF-16 VS Code cursor.
 * Does not trust selection outside the specific source preview, or a blame gutter. */
export function selectionToSourceCursor(container:HTMLElement,selection:Selection,
  firstLine:number,firstCharacter=0):SourceCursor|undefined {
  const focus=selection.focusNode;
  if(!focus||!container.contains(focus))return undefined;
  const element=focus.nodeType===Node.ELEMENT_NODE?focus as Element:focus.parentElement;
  const code=element?.closest('code.source-text-segment');
  if(!code||!container.contains(code))return undefined;
  const row=code.closest('[data-source-line]');
  if(!row)return undefined;
  const line=Number(row.getAttribute('data-source-line'))-1;
  if(!Number.isSafeInteger(line)||line<firstLine)return undefined;
  const prefix=code.ownerDocument.createRange();
  prefix.selectNodeContents(code);
  try {prefix.setEnd(focus,selection.focusOffset);} catch {return undefined;}
  const selectedLength=Math.min(prefix.toString().length,Number(code.getAttribute('data-source-length')??code.textContent?.length??0));
  return {line,character:selectedLength+(line===firstLine?firstCharacter:0)};
}
