import {describe,it,expect} from 'vitest';
import type {GraphNode,GraphEdge,SourceGraph} from '../../src/shared/types';
import {buildComparison,comparisonFrame,evidenceSummary} from '../../src/review/changeCognition';
import type {ReviewSnapshot} from '../../src/review/reviewTypes';
const r={startLine:0,startCharacter:0,endLine:10,endCharacter:0};
function node(id:string,signature:string,hash:string,bases:string[]=[],anatomy:GraphNode['anatomy']=[]):GraphNode{
  return {id,kind:'function',name:id,qualifiedName:id,uri:'file:///repo/agent.py',root:'file:///repo',module:'agent',moduleId:'agent',parentId:null,
    range:r,selectionRange:r,version:1,visibility:'public',decorators:[],signature,docstring:'',attributes:[],operations:[],bases,
    async_:false,source:'',structuralHash:hash,confidence:'resolved',anatomy};
}
const edge=(s:string,t:string):GraphEdge=>({id:s+t,source:s,target:t,kind:'calls',confidence:'resolved',evidence:[]});
const graph=(nodes:GraphNode[],edges:GraphEdge[]=[]):SourceGraph=>({schema:1,nodes,edges,diagnostics:[]});
const makeReview=(g:SourceGraph,model:ReturnType<typeof buildComparison>):ReviewSnapshot=>({reviewKey:'x',scope:'working',title:'Test',baseline:'HEAD',head:'WORKTREE',graph:g,comparison:model,
 files:[{path:'tests/test_agent.py',status:'modified'},{path:'README.md',status:'modified'},{path:'pyproject.toml',status:'modified'}],
 threads:[],analysisAvailable:true,createdAt:'2026-01-01T00:00:00Z'});
describe('V7.2 deterministic change cognition',()=>{
 it('records signature, control-flow, and changed static relationships without pretending runtime effects',()=>{
   const before=graph([node('agent','def agent(a):','old',[],[{id:'a',kind:'branch',label:'if a',depth:0,range:r}]),node('validator','def validator():','1')],[edge('agent','validator')]);
   const after=graph([node('agent','def agent(a,b):','new',[],[{id:'b',kind:'loop',label:'for x',depth:0,range:r}]),node('tool','def tool():','2')],[edge('agent','tool')]);
   const model=buildComparison(before,after,'HEAD','WORKTREE');
   expect(model.transformations.map(t=>t.kind)).toEqual(expect.arrayContaining(['signature','control-flow','call-added','call-removed','added','removed']));
   expect(model.transformations.filter(t=>t.evidence==='static-edge')).toHaveLength(2);
   expect(model.transformations.every(t=>['source-backed','candidate'].includes(t.confidence))).toBe(true);
 });
 it('uses faithful before/after graphs and leaves review overlay untouched',()=>{
   const before=graph([node('a','a','1'),node('b','b','1')],[edge('a','b')]);
   const after=graph([node('a','a','2'),node('c','c','1')],[edge('a','c')]);
   const review=makeReview(graph([...after.nodes,{...before.nodes[1],change:'REMOVED',baselineOnly:true}],[...after.edges,{...before.edges[0],change:'REMOVED'}]),buildComparison(before,after,'A','B'));
   expect(comparisonFrame(review,'before').edges[0].target).toBe('b');
   expect(comparisonFrame(review,'after').nodes.find(n=>n.id==='b')).toBeUndefined();
   expect(comparisonFrame(review,'delta').nodes.find(n=>n.id==='b')).toBeDefined();
   expect(review.graph.nodes).toHaveLength(3);
 });
 it('labels test-file changes as unknown execution, never a green pass',()=>{
   const g=graph([({...node('a','a','1'),change:'MODIFIED'})]);
   const e=evidenceSummary(makeReview(g,buildComparison(g,g,'A','B')));
   expect(e.changedTestFiles).toHaveLength(1);expect(e.changedDocs).toHaveLength(1);expect(e.changedConfig).toHaveLength(1);
   expect(e.testExecution).toBe('not-provided');
 });
 it('reports truncation explicitly for huge source modifications',()=>{
   const before=graph(Array.from({length:12},(_,i)=>node('x'+i,'a','1')));
   const after=graph(Array.from({length:12},(_,i)=>node('x'+i,'b','2')));
   const model=buildComparison(before,after,'A','B',4);
   expect(model.truncated).toBe(true);expect(model.transformations).toHaveLength(4);
 });
});
