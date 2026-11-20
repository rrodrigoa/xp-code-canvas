import {describe,it,expect} from 'vitest';
import {orchestrateLayout,investigationLayout,changeLayout,settleMeasuredLayout} from '../../src/webview/layout/LayoutOrchestrator';
import {DEFAULT_CANVAS_STATE} from '../../src/shared/types';
import {realignFile} from '../../src/shared/layout';
import type {GraphNode,SourceGraph} from '../../src/shared/types';
const n=(id:string,uri='file:///src/app.py',line=0,change='UNCHANGED'):GraphNode=>({
 id,name:id,kind:'function',uri,root:'/',module:'app',moduleId:'module',qualifiedName:id,parentId:null,
 range:{startLine:line,startCharacter:0,endLine:line+3,endCharacter:0},selectionRange:{startLine:line,startCharacter:0,endLine:line,endCharacter:3},
 version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',change:change as GraphNode['change']});
const nodes=[n('entry'),n('source','file:///src/api.py'),n('dep','file:///src/db.py'),n('unrelated','file:///src/other.py'),n('changed','file:///src/app.py',40,'MODIFIED')];
const graph:SourceGraph={schema:1,nodes,edges:[{id:'s-e',source:'source',target:'entry',kind:'calls',confidence:'resolved',evidence:[]},{id:'e-d',source:'entry',target:'dep',kind:'calls',confidence:'resolved',evidence:[]}],diagnostics:[]};
const size=()=>({width:280,height:130});
describe('V6 layout orchestration',()=>{
 it('realigns the focused file in the active snapshot while preserving other modes',()=>{
  const result=realignFile(graph,{...DEFAULT_CANVAS_STATE,focusedFile:nodes[0].uri,layoutMode:'file',layoutPositions:{file:{entry:{x:999,y:999},unrelated:{x:8,y:9}},change:{entry:{x:4,y:5}}}});
  expect(result.layoutPositions?.file?.entry).toBeUndefined();
  expect(result.layoutPositions?.file?.unrelated).toEqual({x:8,y:9});
  expect(result.layoutPositions?.change?.entry).toEqual({x:4,y:5});
 });
 it('places callers before and dependencies after investigation focus',()=>{
  const l=investigationLayout(graph,'entry',size)!;
  expect(l.source.x).toBeLessThan(l.entry.x);expect(l.dep.x).toBeGreaterThan(l.entry.x);expect(l.unrelated.x).toBeGreaterThan(l.dep.x);
 });
 it('places changed symbols in earlier columns',()=>{const l=changeLayout(graph,size);expect(l.changed.x).toBeLessThan(l.entry.x);});
 it('moves overlapping cards but not distant cards',()=>{
  const placed=settleMeasuredLayout([{id:'a',x:40,y:20,width:200,height:240},{id:'b',x:40,y:200,width:200,height:90},{id:'far',x:700,y:55,width:200,height:90}], 'a',30);
  expect(placed.b.y).toBeGreaterThanOrEqual(290);expect(placed.far).toEqual({x:700,y:55});
 });
 it('preserves pinned anchors',()=>{
  const placed=settleMeasuredLayout([{id:'p',x:0,y:0,width:280,height:200,pinned:true},{id:'a',x:0,y:100,width:280,height:260},{id:'b',x:0,y:140,width:280,height:140}], 'a');
  expect(placed.p.y).toBe(0);expect(placed.a.y).toBe(100);expect(placed.b.y).toBeGreaterThan(350);
 });
 it('restores per-mode manual positions',async()=>{
  const state={...DEFAULT_CANVAS_STATE,layoutMode:'change' as const,layoutPositions:{change:{changed:{x:4000,y:400}}}};
  const result=await orchestrateLayout(graph,state,new Map(),new Set());expect(result.changed).toEqual({x:4000,y:400});
 });
 it('settles 1500 dense nodes in a reasonable time',()=>{
  const boxes=Array.from({length:1500},(_,i)=>({id:String(i).padStart(5,'0'),x:30,y:i*145,width:240,height:160}));
  const start=Date.now(),placed=settleMeasuredLayout(boxes,null,20);
  const ys=Object.values(placed).map(v=>v.y).sort((a,b)=>a-b);
  for(let i=1;i<ys.length;i++)expect(ys[i]-ys[i-1]).toBeGreaterThanOrEqual(180);
  expect(Date.now()-start).toBeLessThan(6000);
 });
});
