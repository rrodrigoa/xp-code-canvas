import {describe,it,expect} from 'vitest';
import {edgeAppearance,nodeRole,spatialSemanticZoom,spatialDetail} from '../../src/shared/visualLanguage';
import {createVisualizationProjection} from '../../src/shared/visualizationProjection';
import {DEFAULT_CANVAS_STATE,type SourceGraph,type GraphNode} from '../../src/shared/types';
import type {ReviewSnapshot} from '../../src/review/reviewTypes';
import {folderOf,layoutSpatialGraph,communityPartitions,classPartitions} from '../../src/shared/spatialGraph';
import fixture from '../fixtures/sample-graph.json';

describe('visual parity at review and uncertainty boundaries',()=>{
  it('keeps change priority, uncertainty, selection and dimming independent',()=>{
    for(const [change,token] of [['ADDED','--xp-added'],['MODIFIED','--xp-modified'],['REMOVED','--xp-removed']] as const){
      const s=edgeAppearance({kind:'inherits',confidence:'unresolved',change},true);
      expect(s.colorToken).toBe(token);expect(s.dashed).toBe(true);expect(s.width).toBe(2.7);
    }
    expect(edgeAppearance({kind:'calls',confidence:'resolved',change:'REMOVED'}).opacity).toBe(.4);
    expect(edgeAppearance({kind:'calls',confidence:'resolved'},true).opacity).toBe(1);
    expect(edgeAppearance({kind:'calls',confidence:'resolved'},true,true).opacity).toBe(.12);
    expect(edgeAppearance({kind:'calls',confidence:'resolved',change:'IMPACTED'}).width).toBe(2.1);
    expect(['module','class','function','property','external','method'].map(k=>nodeRole(k as GraphNode['kind'])))
      .toEqual(['module','class','callable','data','external','callable']);
  });
  it('bounds invalid camera distances and spans all persisted detail tiers',()=>{
    expect(spatialSemanticZoom(Infinity)).toBe(.28);
    expect(spatialSemanticZoom(-20)).toBe(2.8);
    expect([5000,1000,500,0].map(d=>spatialDetail(d,[.64,1.13,1.88]))).toEqual([0,1,2,3]);
  });
  it('shares review fallback states, edge threads, filtering and tracing between lenses',()=>{
    const g=fixture as SourceGraph;
    const graph:SourceGraph={...g,nodes:g.nodes.map((n,i)=>({...n,change:i===0?'MODIFIED':i===1?'IMPACTED':'UNCHANGED'})),edges:g.edges.map((e,i)=>({...e,memberEdgeIds:i===0?['member']:undefined}))};
    const edge=graph.edges[0];
    const review:ReviewSnapshot={reviewKey:'test',scope:'working',title:'Working',baseline:'HEAD',head:'WORKTREE',createdAt:'now',analysisAvailable:true,files:[],graph:{...graph,edges:graph.edges.map(e=>({...e,change:'REMOVED'}))},threads:[
      {id:'t1',origin:'local',status:'open',target:{edgeId:edge.id},comments:[]},
      {id:'t2',origin:'local',status:'open',target:{edgeId:edge.id},comments:[]},
      {id:'t3',origin:'local',status:'resolved',target:{edgeId:edge.id},comments:[]},
    ]};
    const state={...DEFAULT_CANVAS_STATE,altitude:'code' as const,explodeMethods:true,selectedNode:edge.source,trace:'outgoing' as const};
    for(const emphasis of ['all','direct','impact'] as const){
      const p=createVisualizationProjection(graph,state,{review,changeEmphasis:emphasis});
      expect(p.edges[0].relation.change).toBe('REMOVED');expect(p.edges[0].openThreads).toBe(2);
      expect(p.nodes.some(n=>!n.visible)).toBe(true);
      expect(createVisualizationProjection(graph,{...state,lens:'spatial'},{review,changeEmphasis:emphasis})).toEqual(p);
    }
    const live={...graph,nodes:graph.nodes.map(n=>({...n,change:undefined}))};
    expect(createVisualizationProjection(live,state,{review}).nodes[0].reviewStatus).toBe('MODIFIED');
    expect(createVisualizationProjection(live,{...state,selectedNode:null,edgeKinds:[]},{search:'missing'}).edges.every(e=>!e.visible)).toBe(true);
  });
  it('handles empty, disconnected, malformed URI and cyclic parent graphs safely',()=>{
    const empty:SourceGraph={schema:1,nodes:[],edges:[],diagnostics:[]};
    for(const kind of ['force','hub','folder','dependency','size','class','community','review'] as const)expect(layoutSpatialGraph(empty,kind)).toEqual({});
    expect(folderOf({uri:'file:///repo/%invalid.py',root:''})).toContain('repo');
    const n=(fixture as SourceGraph).nodes[0];
    const g:SourceGraph={...empty,nodes:[{...n,id:'a',kind:'function',parentId:'b'},{...n,id:'b',kind:'function',parentId:'a'}],edges:[{id:'self',source:'a',target:'a',kind:'calls',confidence:'resolved',evidence:[]}]};
    expect(classPartitions(g).size).toBe(2);expect(communityPartitions(g).size).toBe(2);
    expect(Object.keys(layoutSpatialGraph(g,'dependency',{focusId:'missing',pinned:{missing:{x:0,y:0,z:0}}}))).toHaveLength(2);
  });
});
