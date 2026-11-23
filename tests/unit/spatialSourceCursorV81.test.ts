import {describe,it,expect} from 'vitest';
import {spatialSourceCursor} from '../../src/webview/components/spatial/spatialSourceCursor';

describe('3D source preview → native editor cursor',()=>{
  function fixture(text:string){
    const focusNode={nodeType:3},root={contains:(n:unknown)=>n===focusNode,
      ownerDocument:{createRange:()=>({selectNodeContents:()=>undefined,setEnd:()=>undefined,toString:()=>text})},
    } as unknown as HTMLElement;
    const selection={focusNode,focusOffset:4} as unknown as Selection;
    return {root,selection};
  }
  it('keeps UTF-16 columns on initial and subsequent lines',()=>{
    const a=fixture('abcd');expect(spatialSourceCursor(a.root,a.selection,17,6)).toEqual({line:17,character:10});
    const b=fixture('def method():\n    🧪 value');expect(spatialSourceCursor(b.root,b.selection,17,6)).toEqual({line:18,character:12});
  });
  it('ignores selections outside the source preview',()=>{
    const {root}=fixture('x');expect(spatialSourceCursor(root,null,0)).toBeUndefined();
    expect(spatialSourceCursor(root,{focusNode:{},focusOffset:0} as unknown as Selection,0)).toBeUndefined();
  });
});
