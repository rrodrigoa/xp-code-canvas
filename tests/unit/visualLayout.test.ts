import { describe,expect,it } from 'vitest';
import { focusedLaneLayout,calculateLayout,nodeSize } from '../../src/webview/elkLayout';
import { DEFAULT_CANVAS_STATE } from '../../src/shared/types';
import type { GraphNode,SourceGraph } from '../../src/shared/types';
const make=(id:string,uri:string,line:number,kind:'class'|'function'='function'):GraphNode=>({
  id,kind,name:id,qualifiedName:id,uri,root:'/',module:'app',moduleId:'m',parentId:null,
  range:{startLine:line,startCharacter:0,endLine:line+2,endCharacter:0},
  selectionRange:{startLine:line,startCharacter:0,endLine:line,endCharacter:8},version:1,visibility:'public',
  decorators:[],signature:`def ${id}():`,docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',
});
const nodes=[make('a','file:///f.py',1),make('b','file:///f.py',7),make('left','file:///caller.py',1),make('right','file:///target.py',1)];
const graph:SourceGraph={schema:1,nodes,edges:[{id:'e1',source:'left',target:'a',kind:'calls',confidence:'resolved',evidence:[]},{id:'e2',source:'b',target:'right',kind:'calls',confidence:'resolved',evidence:[]}],diagnostics:[]};
const state={...DEFAULT_CANVAS_STATE,focusedFile:'file:///f.py'};
describe('V3 focus layout',()=>{
  it('aligns the selected file in source order and keeps callers and callees on the sides',()=>{
    const pos=focusedLaneLayout(graph,state);
    expect(pos.a.x).toBe(pos.b.x);
    expect(pos.a.y).toBeLessThan(pos.b.y);
    expect(pos.left.x).toBeLessThan(pos.a.x);
    expect(pos.right.x).toBeGreaterThan(pos.a.x);
  });
  it('has no overlap in the focus column even when a card expands',()=>{
    const s={...state,expanded:['a']};const pos=focusedLaneLayout(graph,s);
    expect(pos.b.y).toBeGreaterThanOrEqual(pos.a.y+nodeSize(nodes[0],s).height+40);
  });
  it('respects user drag/pin overrides after automatic layout',async()=>{
    const pos=await calculateLayout(graph,{...state,pinned:{a:{x:999,y:777}}});
    expect(pos.a).toEqual({x:999,y:777});
    expect(pos.b.x).not.toBe(999);
  });
});

describe('V5 expanding syntax and attribution',()=>{
  it('reserves card space for AST anatomy without altering graph evidence',()=>{
    const n={...nodes[0],anatomy:[{id:'branch:2:1',kind:'branch' as const,label:'if ready',depth:0,range:{startLine:2,startCharacter:0,endLine:3,endCharacter:0}}]};
    const size=nodeSize(n,{...state,zoom:1.4});
    expect(size.width).toBe(360);
    expect(size.height).toBeGreaterThan(nodeSize(nodes[0],{...state,zoom:1.4}).height);
  });
  it('reserves enough height for an opened attribution summary',()=>{
    const shown=nodeSize(nodes[0],{...state,zoom:1.5},new Map(),true);
    const hidden=nodeSize(nodes[0],{...state,zoom:1.5});
    expect(shown.height).toBeGreaterThan(hidden.height+100);
  });
});
