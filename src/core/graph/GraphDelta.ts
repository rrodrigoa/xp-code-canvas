import type { GraphSnapshot, GraphDelta } from '../contracts/graph.v2';
import type { SourceGraph, GraphNode, GraphEdge, Diagnostic } from '../../shared/types';
export interface SourceGraphDelta {
  baseRevision:number; nextRevision:number;
  upsertNodes:GraphNode[]; removeNodeIds:string[];
  upsertEdges:GraphEdge[]; removeEdgeIds:string[];
  diagnostics:Diagnostic[]; stats?:Record<string,number>;
  availability?:'complete'|'partial'|'stale'; unresolved?:SourceGraph['unresolved']; sourceVersions?:Record<string,string>;
}
function changed<T extends {id:string}>(prior:T[],next:T[]):{upsert:T[];remove:string[]} {
  const existing=new Map(prior.map(item=>[item.id,JSON.stringify(item)]));
  const upcoming=new Set<string>();
  const upsert:T[]=[];
  for(const item of next){upcoming.add(item.id);if(existing.get(item.id)!==JSON.stringify(item))upsert.push(item);}
  return {upsert,remove:prior.filter(item=>!upcoming.has(item.id)).map(item=>item.id)};
}
export function canonicalDelta(before:GraphSnapshot,after:GraphSnapshot):GraphDelta {
  const symbols=changed(before.symbols,after.symbols), relations=changed(before.relations,after.relations);
  return {baseRevision:before.revision,nextRevision:after.revision,
    upsertSymbols:symbols.upsert,removeSymbolIds:symbols.remove,upsertRelations:relations.upsert,removeRelationIds:relations.remove,
    sourceVersions:after.sourceVersions,diagnostics:after.diagnostics,availability:after.availability};
}
export function sourceDelta(before:SourceGraph,after:SourceGraph):SourceGraphDelta {
  if(before.revision===undefined||after.revision===undefined)throw Error('Source revisions required for deltas');
  const nodes=changed(before.nodes,after.nodes),edges=changed(before.edges,after.edges);
  return {baseRevision:before.revision,nextRevision:after.revision,
    upsertNodes:nodes.upsert,removeNodeIds:nodes.remove,upsertEdges:edges.upsert,removeEdgeIds:edges.remove,
    diagnostics:after.diagnostics,stats:after.stats,availability:after.availability,unresolved:after.unresolved,
    sourceVersions:after.sourceVersions};
}
export function applySourceDelta(before:SourceGraph,delta:SourceGraphDelta):SourceGraph {
  if(before.revision!==delta.baseRevision || delta.nextRevision<=delta.baseRevision)throw Error('Graph view delta revision mismatch');
  const nodes=new Map(before.nodes.map(n=>[n.id,n]));
  const edges=new Map(before.edges.map(e=>[e.id,e]));
  for(const id of delta.removeNodeIds)nodes.delete(id);
  for(const item of delta.upsertNodes)nodes.set(item.id,item);
  for(const id of delta.removeEdgeIds)edges.delete(id);
  for(const item of delta.upsertEdges)edges.set(item.id,item);
  return {schema:1,revision:delta.nextRevision,nodes:[...nodes.values()],edges:[...edges.values()],
    diagnostics:delta.diagnostics,stats:delta.stats,availability:delta.availability,unresolved:delta.unresolved,sourceVersions:delta.sourceVersions};
}
/** Avoid sending a delta larger than the full graph payload. */
export function useDelta(delta:SourceGraphDelta,graph:SourceGraph):boolean {
  const altered=delta.upsertNodes.length+delta.upsertEdges.length+delta.removeNodeIds.length+delta.removeEdgeIds.length;
  return altered<Math.max(4,Math.floor((graph.nodes.length+graph.edges.length)*.6));
}
