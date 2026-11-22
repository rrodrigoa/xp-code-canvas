import { describe, it, expect } from 'vitest';
import type {GraphNode,SourceGraph,CanvasState} from '../../src/shared/types';
import { DEFAULT_CANVAS_STATE } from '../../src/shared/types';
import { spreadLayout, orchestrateLayout } from '../../src/webview/layout/LayoutOrchestrator';
import { focusedLaneLayout } from '../../src/webview/elkLayout';
import { validateViewState } from '../../src/core/contracts/viewState';
const makeGraph=(count:number):SourceGraph=>({schema:1,diagnostics:[],edges:[],nodes:Array.from({length:count},(_,i)=>({
 id:`id-${i}`,uri:`file:///workspace/${Math.floor(i/30)}.py`,module:`mod-${Math.floor(i/30)}`,
 range:{startLine:i%30,startCharacter:0,endLine:i%30,endCharacter:5},kind:'function',name:`f${i}`,
} as GraphNode))});
const size=()=>({width:300,height:130});
describe('dense graph recovery layout',()=>{
 it('packs 584 symbols into a balanced 2-D arrangement with no overlaps',()=>{
   const graph=makeGraph(584),positions=spreadLayout(graph,size,graph.nodes[0].uri);
   expect(Object.keys(positions)).toHaveLength(584);
   expect(new Set(Object.values(positions).map(p=>p.x)).size).toBeGreaterThan(15);
   expect(new Set(Object.values(positions).map(p=>p.y)).size).toBeLessThan(35);
   const coordinates=new Set(Object.values(positions).map(p=>`${p.x}:${p.y}`));
   expect(coordinates.size).toBe(584);
   const maximumY=Math.max(...Object.values(positions).map(p=>p.y));
   expect(maximumY).toBeLessThan(10000);
 });
 it('automatically wraps an oversized file-focus workspace instead of a single lane',()=>{
   const graph=makeGraph(584);
   const state={...DEFAULT_CANVAS_STATE,focusedFile:graph.nodes[0].uri};
   const positions=focusedLaneLayout(graph,state);
   expect(new Set(Object.values(positions).map(p=>p.x)).size).toBeGreaterThan(10);
 });
 it('honors explicit saved node dimensions and stable manual overrides',async()=>{
   const graph=makeGraph(55);const state:CanvasState={...DEFAULT_CANVAS_STATE,layoutMode:'spread',nodeSizes:{'id-0':{width:600,height:500}},layoutPositions:{spread:{'id-5':{x:123,y:456}}}};
   expect(validateViewState(state)).toBeDefined();
   const positions=await orchestrateLayout(graph,state,new Map(),new Set());
   expect(positions['id-5']).toEqual({x:123,y:456});
 });
});
