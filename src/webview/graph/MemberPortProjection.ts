/** Enriches *visual* projected edges with unique method-level attachment points.
 * The canonical graph stays untouched. Multi-method bundles correctly retain typed class ports. */
import type {GraphEdge,SourceGraph} from '../../shared/types';
import {portForRelationship} from './EdgeRoutingService';
export type PortSide='source'|'target';
export interface MemberPort {id:string;memberId:string;kind:GraphEdge['kind'];side:PortSide}
export interface EdgePorts {sourceHandle:string;targetHandle:string}
export interface PortProjection {edges:Map<string,EdgePorts>;members:Map<string,MemberPort[]>}
export function memberPortId(side:PortSide,kind:GraphEdge['kind'],id:string):string {
  return `${side}-member-${kind}-${encodeURIComponent(id)}`;
}
export function projectMemberPorts(projected:SourceGraph,canonical:SourceGraph,maxPorts=8):PortProjection {
  const originals=new Map(canonical.edges.map(e=>[e.id,e]));
  const symbols=new Map(canonical.nodes.map(n=>[n.id,n]));
  const containers=new Map(projected.nodes.map(n=>[n.id,n]));
  const edgePorts=new Map<string,EdgePorts>(),members=new Map<string,MemberPort[]>();
  function resolve(edge:GraphEdge,side:PortSide):string {
    const visibleId=side==='source'?edge.source:edge.target;
    const visible=containers.get(visibleId);
    if(visible?.kind!=='class')return portForRelationship(edge.kind,side);
    const ids=new Set<string>();
    for(const id of edge.memberEdgeIds??[edge.id]){
      const original=originals.get(id);if(!original)return portForRelationship(edge.kind,side);
      const node=symbols.get(side==='source'?original.source:original.target);
      if(!node||node.parentId!==visibleId||!['method','property'].includes(node.kind))return portForRelationship(edge.kind,side);
      ids.add(node.id);
    }
    if(ids.size!==1)return portForRelationship(edge.kind,side);
    const memberId=[...ids][0];
    const list=members.get(visibleId)??[];
    const key=memberPortId(side,edge.kind,memberId);
    if(!list.some(p=>p.id===key)){
      if(list.length>=maxPorts)return portForRelationship(edge.kind,side);
      list.push({id:key,memberId,kind:edge.kind,side});members.set(visibleId,list);
    }
    return key;
  }
  for(const edge of projected.edges)edgePorts.set(edge.id,{sourceHandle:resolve(edge,'source'),targetHandle:resolve(edge,'target')});
  return {edges:edgePorts,members};
}
