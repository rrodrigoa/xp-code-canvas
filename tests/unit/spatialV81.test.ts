import {describe,it,expect} from 'vitest';
import {classPartitions,communityPartitions,reviewPartitions,layoutSpatialGraph,flattenSpatialLayout} from '../../src/shared/spatialGraph';
import {edgeAppearance,nodeRole,spatialDetail} from '../../src/shared/visualLanguage';
import {chooseCardTiers} from '../../src/webview/components/spatial/SpatialVisuals';
import type {GraphNode,SourceGraph} from '../../src/shared/types';
const make=(count:number):SourceGraph=>({schema:1,diagnostics:[],nodes:Array.from({length:count},(_,i)=>({
  id:`n${i}`,name:`member${i}`,qualifiedName:`api.member${i}`,root:'file:///repo',uri:`file:///repo/pkg${Math.floor(i/15)}/f${Math.floor(i/5)}.py`,
  module:'api',moduleId:'module',kind:i%5===0?'class':'method',parentId:i%5?`n${i-i%5}`:null,
  range:{startLine:i,startCharacter:0,endLine:i+12,endCharacter:0},selectionRange:{startLine:i,startCharacter:0,endLine:i,endCharacter:0},
  confidence:'resolved',version:1,visibility:'public',decorators:[],attributes:[],operations:[],bases:[],signature:'',docstring:'',async_:false,source:'',
  change:i%20===0?'MODIFIED':i%20===1?'IMPACTED':undefined,
} as GraphNode)),edges:Array.from({length:count-1},(_,i)=>({id:`e${i}`,source:`n${i}`,target:`n${i+1}`,kind:'calls',confidence:'resolved',evidence:[]})),});
describe('V8.1 renderer parity and partitioning',()=>{
  it('retains every 2D UML relationship style in shared contract',()=>{
    expect(edgeAppearance({kind:'inherits',confidence:'resolved'}).marker).toBe('hollow-triangle');
    expect(edgeAppearance({kind:'inherits',confidence:'resolved'}).dashed).toBe(false);
    expect(edgeAppearance({kind:'realizes',confidence:'resolved'}).dashed).toBe(true);
    for(const kind of ['calls','imports','creates','references','contains'] as const)expect(edgeAppearance({kind,confidence:'resolved'}).dashed).toBe(true);
    expect(edgeAppearance({kind:'calls',confidence:'unresolved'}).colorToken).toBe('--xp-ambiguous');
    expect(edgeAppearance({kind:'calls',confidence:'resolved',change:'ADDED'}).colorToken).toBe('--xp-added');
    expect(nodeRole('property')).toBe('data');
  });
  it('creates deterministic class/community/review spatial and flattened 2D partitions',()=>{
    const g=make(100),reversed={...g,nodes:[...g.nodes].reverse(),edges:[...g.edges].reverse()};
    for(const kind of ['class','community','review'] as const){
      expect(layoutSpatialGraph(g,kind)).toEqual(layoutSpatialGraph(reversed,kind));
      expect(Object.keys(flattenSpatialLayout(g,kind))).toHaveLength(100);
    }
    expect(classPartitions(g).get('n3')).toBe(classPartitions(g).get('n0'));
    expect(communityPartitions(g).size).toBe(100);
    expect(reviewPartitions(g).get('n1')).toBe('2-potential-impact');
  });
  it('budgets camera-facing texture cards and responds to semantic-zoom stops',()=>{
    const g=make(500);const nodes=g.nodes.map((symbol,i)=>({id:symbol.id,x:i,y:0,z:0,v:{
      id:symbol.id,symbol,folder:'pkg',reviewStatus:symbol.change??'UNCHANGED',selected:i===0,
      dimmed:false,visible:true,openThreads:0,metrics:{degree:0,inDegree:0,outDegree:0,weightedDegree:0,pagerank:0,sourceLines:13,folder:'pkg'},
    }})) as Parameters<typeof chooseCardTiers>[0];
    const lod=chooseCardTiers(nodes,{x:0,y:0,z:80},[.64,1.13,1.88],40);
    expect([...lod.values()].filter(x=>x>0).length).toBeLessThanOrEqual(40);
    expect(lod.get('n0')).toBeGreaterThanOrEqual(2);
    expect(spatialDetail(5000,[.64,1.13,1.88])).toBe(0);
    expect(spatialDetail(45,[.64,1.13,1.88])).toBe(3);
  });
});
