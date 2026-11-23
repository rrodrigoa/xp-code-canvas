import {describe,it,expect} from 'vitest';
import {folderOf,graphMetrics,layoutSpatialGraph,flattenSpatialLayout} from '../../src/shared/spatialGraph';
import {createVisualizationProjection} from '../../src/shared/visualizationProjection';
import {DEFAULT_CANVAS_STATE,type GraphNode,type SourceGraph} from '../../src/shared/types';
function fixture(n=40):SourceGraph {
  const nodes:GraphNode[]=Array.from({length:n},(_,i)=>({
    id:`symbol-${i}`,kind:i%5===0?'class':'function',name:`function_${i}`,qualifiedName:`pkg.function_${i}`,
    uri:`file:///repo/pkg${Math.floor(i/8)}/code${Math.floor(i/4)}.py`,root:'file:///repo',module:`pkg${Math.floor(i/8)}`,moduleId:'0',parentId:null,
    range:{startLine:i,startCharacter:0,endLine:i+2+i%11,endCharacter:0},
    selectionRange:{startLine:i,startCharacter:0,endLine:i,endCharacter:9},version:1,
    visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',
    change:i===0?'MODIFIED':i===1?'IMPACTED':undefined,
  }));
  const edges=nodes.slice(1).map((node,i)=>({id:`edge-${i}`,source:nodes[i%8].id,target:node.id,kind:'calls' as const,confidence:'resolved' as const,evidence:[],count:(i%3)+1}));
  return {schema:1,nodes,edges,diagnostics:[]};
}
describe('V8 source-backed spatial visualization',()=>{
  it('computes in/out degree and source size without mutating graph',()=>{
    const g=fixture(25),before=JSON.stringify(g),m=graphMetrics(g);
    expect(m.get('symbol-0')!.degree).toBeGreaterThan(2);
    expect(m.get('symbol-3')!.sourceLines).toBeGreaterThan(0);
    expect(JSON.stringify(g)).toBe(before);
    expect([...m.values()].reduce((s,v)=>s+v.pagerank,0)).toBeCloseTo(1,5);
  });
  it('organizes every symbol in 3D with finite coordinates in every mode',()=>{
    const graph=fixture(584);
    for(const kind of ['force','hub','folder','dependency','size'] as const){
      const points=layoutSpatialGraph(graph,kind,{focusId:'symbol-22',maxIterations:3});
      expect(Object.keys(points)).toHaveLength(584);
      expect(Object.values(points).every(p=>[p.x,p.y,p.z].every(Number.isFinite))).toBe(true);
      const distinct=new Set(Object.values(points).map(p=>`${p.x.toFixed(3)}:${p.y.toFixed(3)}:${p.z.toFixed(3)}`));
      expect(distinct.size).toBe(584);
    }
  });
  it('is deterministic even if source node/edge order changes',()=>{
    const graph=fixture(54),reordered={...graph,nodes:[...graph.nodes].reverse(),edges:[...graph.edges].reverse()};
    for(const kind of ['force','hub','folder','dependency','size'] as const){
      expect(layoutSpatialGraph(reordered,kind,{focusId:'symbol-7',maxIterations:2})).toEqual(layoutSpatialGraph(graph,kind,{focusId:'symbol-7',maxIterations:2}));
    }
  });
  it('keeps folder groups together without conflating two workspace roots',()=>{
    const graph=fixture(24),p=layoutSpatialGraph(graph,'folder');
    const center=(ids:string[])=>ids.reduce((s,id)=>({x:s.x+p[id].x/ids.length,y:s.y+p[id].y/ids.length,z:s.z+p[id].z/ids.length}),{x:0,y:0,z:0});
    const a=center(graph.nodes.slice(0,8).map(n=>n.id)),b=center(graph.nodes.slice(8,16).map(n=>n.id));
    expect(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)).toBeGreaterThan(200);
    expect(folderOf(graph.nodes[0])).toContain('pkg0');
    expect(folderOf({...graph.nodes[0],root:'file:///other'})).not.toBe(folderOf(graph.nodes[0]));
  });
  it('honors valid 3D pin positions, rejects invalid ones and shares layouts with 2D',()=>{
    const g=fixture(16),positions=layoutSpatialGraph(g,'hub',{pinned:{'symbol-0':{x:1,y:2,z:3},'symbol-1':{x:Infinity,y:0,z:0}}});
    expect(positions['symbol-0']).toEqual({x:1,y:2,z:3});
    expect(Number.isFinite(positions['symbol-1'].x)).toBe(true);
    const twoD=flattenSpatialLayout(g,'folder');expect(Object.keys(twoD)).toHaveLength(16);
  });
  it('preserves source IDs, confidence and review status in renderer-independent model',()=>{
    const g=fixture(12),state={...DEFAULT_CANVAS_STATE,altitude:'code' as const,selectedNode:'symbol-0',lens:'spatial' as const,
      edgeKinds:['calls' as const]};
    const p=createVisualizationProjection(g,state,{changeEmphasis:'direct'});
    expect(p.nodes.find(n=>n.id==='symbol-0')!.selected).toBe(true);
    expect(p.nodes.find(n=>n.id==='symbol-0')!.dimmed).toBe(false);
    expect(p.nodes.find(n=>n.id==='symbol-1')!.dimmed).toBe(true);
    expect(p.edges[0].relation.confidence).toBe('resolved');
  });
  it('filters search and connected relationships using identical evidence in 2D or 3D',()=>{
    const g=fixture(12),state={...DEFAULT_CANVAS_STATE,altitude:'code' as const,lens:'spatial' as const};
    const a=createVisualizationProjection(g,state,{search:'function_2'});
    const b=createVisualizationProjection(g,{...state,lens:'uml'},{search:'function_2'});
    expect(a.nodes.map(n=>[n.id,n.visible])).toEqual(b.nodes.map(n=>[n.id,n.visible]));
    expect(a.edges.map(e=>[e.id,e.visible])).toEqual(b.edges.map(e=>[e.id,e.visible]));
  });
});
