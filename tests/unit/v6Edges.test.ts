import {describe,expect,it} from 'vitest';
import {allocateEdgeLabels,bundleProjectedEdges,portOffset,portForRelationship} from '../../src/webview/graph/EdgeRoutingService';
import {memberPortId,projectMemberPorts} from '../../src/webview/graph/MemberPortProjection';
import type {GraphNode,GraphEdge,SourceGraph} from '../../src/shared/types';
describe('V6 relationship rendering',()=>{
 it('assigns distinct port offsets',()=>{expect(portForRelationship('inherits','source')).not.toBe(portForRelationship('calls','source'));expect(portOffset('inherits')).toBeLessThan(portOffset('references'));});
 it('preserves different UML relation kinds',()=>{
  const e=(id:string,kind:'calls'|'imports'):GraphEdge=>({id,source:'a',target:'b',kind,confidence:'resolved',evidence:[]});
  expect(bundleProjectedEdges([e('a','calls'),e('b','imports')],.5)).toHaveLength(2);
 });
 it('allocates two labels without overlapping them',()=>{
  const labels=allocateEdgeLabels([{id:'a',text:'calls',priority:1,start:{x:0,y:50},end:{x:800,y:50}},
    {id:'b',text:'imports',priority:2,start:{x:0,y:50},end:{x:800,y:50}}],[]);
  expect(labels).toHaveLength(2);
  const a=labels[0],b=labels[1];expect(Math.abs(a.x-b.x)>=Math.max(a.width,b.width)/2||Math.abs(a.y-b.y)>=25).toBe(true);
 });
 it('bundles multiple methods at class-level ports, never the first method',()=>{
  const node=(id:string,parentId:string|null,kind:GraphNode['kind']):GraphNode=>({id,parentId,kind,name:id,qualifiedName:id,uri:'file:///a.py',root:'/',module:'a',moduleId:'mod',
    range:{startLine:0,startCharacter:0,endLine:2,endCharacter:0},selectionRange:{startLine:0,startCharacter:0,endLine:0,endCharacter:1},version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved'});
  const a:GraphEdge={id:'a',source:'method_a',target:'dest',kind:'calls',confidence:'resolved',evidence:[]};
  const b:GraphEdge={id:'b',source:'method_b',target:'dest',kind:'calls',confidence:'resolved',evidence:[]};
  const canonical:SourceGraph={schema:1,nodes:[node('cls',null,'class'),node('method_a','cls','method'),node('method_b','cls','method'),node('dest',null,'function')],edges:[a,b],diagnostics:[]};
  const projected:SourceGraph={...canonical,nodes:canonical.nodes.filter(n=>!n.id.startsWith('method_')),edges:[
    {...a,source:'cls',memberEdgeIds:['a']},{...b,source:'cls',memberEdgeIds:['b']},
  ]};
  const bundled=bundleProjectedEdges(projected.edges,.7);
  expect(bundled).toHaveLength(1);expect(bundled[0].memberEdgeIds).toEqual(['a','b']);
  const projection=projectMemberPorts({...projected,edges:bundled},canonical);
  expect(projection.edges.get(bundled[0].id)?.sourceHandle).toBe(portForRelationship('calls','source'));
  expect(projection.members.get('cls')).toBeUndefined();
 });
 it('routes unique method relationships to member ports',()=>{
  const node=(id:string,parentId:string|null,kind:GraphNode['kind']):GraphNode=>({id,parentId,kind,name:id,qualifiedName:id,uri:'file:///a.py',root:'/',module:'a',moduleId:'mod',
    range:{startLine:0,startCharacter:0,endLine:2,endCharacter:0},selectionRange:{startLine:0,startCharacter:0,endLine:0,endCharacter:1},version:1,visibility:'public',decorators:[],signature:'',docstring:'',attributes:[],operations:[],bases:[],async_:false,source:'',confidence:'resolved'});
  const original:GraphEdge={id:'callA',source:'m',target:'dest',kind:'calls',confidence:'resolved',evidence:[]};
  const projectedEdge:GraphEdge={...original,id:'projected',source:'cls',memberEdgeIds:['callA']};
  const canonical:SourceGraph={schema:1,nodes:[node('cls',null,'class'),node('m','cls','method'),node('dest',null,'function')],edges:[original],diagnostics:[]};
  const projected:SourceGraph={...canonical,nodes:canonical.nodes.filter(n=>n.id!=='m'),edges:[projectedEdge]};
  const result=projectMemberPorts(projected,canonical);
  expect(result.edges.get('projected')?.sourceHandle).toBe(memberPortId('source','calls','m'));
  expect(result.members.get('cls')).toHaveLength(1);
 });
});
