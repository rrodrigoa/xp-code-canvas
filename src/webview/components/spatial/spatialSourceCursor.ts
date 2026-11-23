import type {SourceCursor} from '../../../shared/types';
/** A Prism-decorated <pre> remains the original code text. Convert its focused
 * DOM selection into a VS Code UTF-16 cursor without accessing adjacent nodes. */
export function spatialSourceCursor(root:HTMLElement,selection:Selection|null,
  startLine:number,startCharacter=0):SourceCursor|undefined {
  const node=selection?.focusNode;if(!node||!root.contains(node))return undefined;
  const range=root.ownerDocument.createRange();range.selectNodeContents(root);
  try{range.setEnd(node,selection!.focusOffset);}catch{return undefined;}
  const text=range.toString().replace(/\r\n/g,'\n');const pieces=text.split('\n');
  const line=startLine+pieces.length-1;
  const character=(pieces.length===1?startCharacter:0)+pieces[pieces.length-1].length;
  return Number.isSafeInteger(line)&&Number.isSafeInteger(character)&&line>=0&&character>=0?{line,character}:undefined;
}
