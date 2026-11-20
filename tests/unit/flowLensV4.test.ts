import {describe,it,expect} from 'vitest';
import {buildFlowLens,layoutFlowLens,ribbonPath} from '../../src/shared/flowLens';
import type {GraphEdge,GraphNode,SourceGraph} from '../../src/shared/types';
const range={startLine:0,startCharacter:0,endLine:1,endCharacter:0};
const node=(id:string):GraphNode=>({id,kind:'function',name:id,qualifiedName:id,uri:`file:///${id}.py`,root:'/',module:id,moduleId:id,parentId:null,
  range,selectionRange:range,version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved'});
const edge=(id:string,source:string,target:string,sites:number):GraphEdge=>({
  id,source,target,kind:'calls',confidence:'resolved',evidence:Array.from({length:sites},(_,i)=>({uri:`file:///${source}.py`,range:{startLine:i,startCharacter:0,endLine:i,endCharacter:3},version:1,language:'python',adapter:'ast'})),
});
const graph:SourceGraph={schema:1,nodes:['caller','focus','callee','other'].map(node),edges:[
  edge('a','caller','focus',3),edge('b','focus','callee',2),edge('c','other','focus',1),edge('d','focus','focus',1)
],diagnostics:[]};
describe('V4 static-source Sankey lens',()=>{
  it('distinguishes inbound callers and outbound dependencies without inventing a caller-to-callee path',()=>{
    const model=buildFlowLens(graph,'calls','focus');
    expect(model.inbound.map(p=>[p.id,p.weight])).toEqual([['caller',3],['other',1]]);
    expect(model.outbound.map(p=>[p.id,p.weight])).toEqual([['callee',2]]);
    expect(model.recursive).toBe(1);
    expect(model.workspaceTotal).toBe(7);
    expect(model.inboundShare).toBeCloseTo(4/7);
    expect(model.outboundShare).toBeCloseTo(2/7);
  });
  it('keeps line thickness proportional to observed static counts',()=>{
    const geometry=layoutFlowLens(buildFlowLens(graph,'calls','focus'));
    const a=geometry.ribbons.find(r=>r.peerId==='caller')!;
    const b=geometry.ribbons.find(r=>r.peerId==='other')!;
    expect(a.thickness).toBeCloseTo(3*b.thickness);
    expect(geometry.bars.length).toBe(3);
    expect(a.path).toMatch(/^M/);
    expect(ribbonPath(20,80,200,90,12)).toContain(' Z');
  });
  it('does not mistake duplicate evidence sites for multiple calls',()=>{
    const repeated=edge('one','caller','focus',2);
    repeated.evidence[1].range={...repeated.evidence[0].range};
    const model=buildFlowLens({...graph,edges:[repeated]},'calls','focus');
    expect(model.inboundTotal).toBe(1);
  });
  it('uses edge counts when aggregated levels carry no individual evidence',()=>{
    const e=edge('e','caller','focus',0);e.count=18;
    expect(buildFlowLens({...graph,edges:[e]},'calls','focus').inboundTotal).toBe(18);
  });
  it('folds excess peers into an explicitly nonclickable aggregate',()=>{
    const peers=Array.from({length:14},(_,i)=>node(`s${i}`));
    const model=buildFlowLens({schema:1,nodes:[node('focus'),...peers],edges:peers.map(n=>edge(n.id,n.id,'focus',1)),diagnostics:[]},'calls','focus',3);
    expect(model.inbound).toHaveLength(4);
    expect(model.inbound.at(-1)?.synthetic).toBe(true);
    expect(model.inbound.at(-1)?.weight).toBe(11);
    expect(model.truncated).toBe(true);
  });
  it('works on cyclic graphs because the focus is only one hop',()=>{
    const cyclic:SourceGraph={...graph,edges:[edge('x','caller','focus',1),edge('y','focus','caller',1)]};
    const model=buildFlowLens(cyclic,'calls','focus');
    expect(model.inbound).toHaveLength(1);
    expect(model.outbound).toHaveLength(1);
  });
  it('returns a clear empty model when no matching relations exist',()=>{
    const model=buildFlowLens(graph,'imports','focus');
    expect(model.inbound).toHaveLength(0);
    expect(model.workspaceTotal).toBe(0);
  });
});
