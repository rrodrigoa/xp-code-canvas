import {describe,it,expect} from 'vitest';
import {detailForZoom,detailForNode,createStructureIndex,semanticRole,summarizeStructure,scopeFrames} from '../../src/shared/semanticVisuals';
import type {GraphNode,SourceGraph} from '../../src/shared/types';
const range=(start:number,end:number)=>({startLine:start,startCharacter:0,endLine:end,endCharacter:0});
const node=(id:string,kind:GraphNode['kind'],name:string,line:number,parentId:string|null=null):GraphNode=>({
  id,kind,name,qualifiedName:name,uri:'file:///agent.py',root:'/',module:'agent',moduleId:'module',parentId,
  range:range(line,line+4),selectionRange:range(line,line),version:1,visibility:'public',decorators:[],
  signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved',
});
const mod=node('module','module','agent',0);
const cls=node('Agent','class','Agent',3,'module');
const method=node('execute','method','execute',8,'Agent');
const fn=node('helper','function','helper',30,'module');
const graph:SourceGraph={schema:1,nodes:[mod,cls,method,fn],edges:[
  {id:'call',source:'execute',target:'helper',kind:'calls',confidence:'resolved',evidence:[]},
],diagnostics:[]};
describe('V4 code anatomy and progressive detail',()=>{
  it('uses stable semantic tiers with explicit source expansion',()=>{
    expect([.4,.8,1.4,2].map(z=>detailForZoom(z))).toEqual([0,1,2,3]);
    expect(detailForZoom(.32,true)).toBe(3);
    expect(detailForNode(2.2,false,false)).toBe(2);
    expect(detailForNode(2.2,false,true)).toBe(3);
    expect(detailForNode(.6,true,false)).toBe(3);
  });
  it('keeps role colors independent of Git states',()=>{
    expect(semanticRole('module')).toBe('module');
    expect(semanticRole('method')).toBe('callable');
    expect(semanticRole('property')).toBe('data');
    expect(semanticRole('class')).toBe('class');
  });
  it('contains only indexed child declarations, ordered by source range',()=>{
    const anatomy=summarizeStructure(mod,graph);
    expect(anatomy.parts.map(p=>p.id)).toEqual(['Agent','helper']);
    expect(anatomy.parts.every(p=>p.isClickable)).toBe(true);
    expect(anatomy.parts[1].linkCount).toBe(1);
    expect(anatomy.total).toBe(2);
  });
  it('shares a single structure index across all UML cards without altering source truth',()=>{
    const index=createStructureIndex(graph);
    expect(index.byId.size).toBe(graph.nodes.length);
    for(const n of graph.nodes){
      expect(summarizeStructure(n,graph,18,index)).toEqual(summarizeStructure(n,graph));
    }
  });
  it('reflects changes to real methods and never fabricates members',()=>{
    const anatomy=summarizeStructure(cls,graph);
    expect(anatomy.parts.map(p=>p.name)).toEqual(['execute']);
    expect(summarizeStructure(fn,graph).parts).toEqual([]);
  });
  it('limits visual density without losing the true total',()=>{
    const summary=summarizeStructure(mod,graph,1);
    expect(summary.total).toBe(2);
    expect(summary.hidden).toBe(1);
  });
  it('creates noninteractive bounding frames around files without moving symbols',()=>{
    const nodes=[{id:'a',uri:'file:///a.py',x:100,y:50,width:80,height:60},
      {id:'b',uri:'file:///a.py',x:200,y:150,width:90,height:100},
      {id:'c',uri:'file:///c.py',x:900,y:20,width:100,height:100}];
    const frames=scopeFrames(nodes);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({x:70,y:6,width:250,height:274,count:2});
    expect(nodes[0].x).toBe(100);
  });
});
