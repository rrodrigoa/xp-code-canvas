/** Canonical view-model contract shared by 2D React Flow, 3D WebGL and future lenses.
 * No renderer may invent source facts or mutate the analysis graph.
 */
import type {CanvasState, ChangeStatus, GraphEdge, GraphNode, SourceGraph} from './types';
import {visibleGraph,traceGraph} from './graph';
import type {ReviewSnapshot} from '../review/reviewTypes';
import {countThreads} from '../review/reviewProjection';
import {folderOf,graphMetrics,type GraphMetrics} from './spatialGraph';

export type ChangeEmphasis='all'|'direct'|'impact';
export interface VisualNode { id:string; symbol:GraphNode; metrics:GraphMetrics; folder:string;
  reviewStatus:ChangeStatus|'UNCHANGED';selected:boolean;dimmed:boolean;visible:boolean;openThreads:number;totalThreads?:number;members?:readonly GraphNode[]; }
export interface VisualEdge { id:string; relation:GraphEdge;selected:boolean;dimmed:boolean;visible:boolean;openThreads:number;totalThreads?:number; }
export interface VisualizationProjection { graph:SourceGraph; nodes:VisualNode[]; edges:VisualEdge[];folders:string[]; }
export interface ProjectionOptions { review?:ReviewSnapshot|null; search?:string; changeEmphasis?:ChangeEmphasis; projectedGraph?:SourceGraph; }
export function createVisualizationProjection(input:SourceGraph,state:CanvasState,options:ProjectionOptions={}):VisualizationProjection{
  const edgeStatus=new Map((options.review?.graph.edges??[]).map(e=>[e.id,e.change]));
  // Attach historical evidence before visibleGraph assigns container-edge IDs.
  const graph=options.projectedGraph??visibleGraph({...input,edges:input.edges.map(e=>!e.change&&edgeStatus.get(e.id)?{...e,change:edgeStatus.get(e.id)}:e)},state);
  const metrics=graphMetrics(graph), threadCounts=options.review?countThreads(options.review.threads,graph):new Map();
  const members=new Map<string,GraphNode[]>();
  for(const n of input.nodes)if(n.parentId){const siblings=members.get(n.parentId)??[];siblings.push(n);members.set(n.parentId,siblings);}
  for(const children of members.values())children.sort((a,b)=>a.range.startLine-b.range.startLine||a.id.localeCompare(b.id));
  const trace=state.selectedNode&&state.trace!=='all'?traceGraph(graph,state.selectedNode,state.trace,state.traceDepth):null;
  const traceNodes=trace?new Set(trace.nodes):null,traceEdges=trace?new Set(trace.edges):null;
  const query=(options.search??'').trim().toLocaleLowerCase();
  const match=new Set(graph.nodes.filter(n=>!query||`${n.qualifiedName} ${n.uri}`.toLocaleLowerCase().includes(query)).map(n=>n.id));
  const historyStatus=new Map((options.review?.graph.nodes??[]).map(n=>[n.id,n.change]));
  const statusFor=(n:GraphNode):ChangeStatus=>n.change??historyStatus.get(n.id)??'UNCHANGED';
  const changed=new Set(graph.nodes.filter(n=>!['UNCHANGED','IMPACTED'].includes(statusFor(n))).map(n=>n.id));
  const impacted=new Set([...changed,...graph.nodes.filter(n=>statusFor(n)==='IMPACTED').map(n=>n.id)]);
  const emphasis=options.changeEmphasis??'all',hasComparison=Boolean(options.review)||graph.nodes.some(n=>n.change&&n.change!=='UNCHANGED');
  const nodes=graph.nodes.map(symbol=>({id:symbol.id,symbol,metrics:metrics.get(symbol.id)!,folder:folderOf(symbol),
    reviewStatus:statusFor(symbol),selected:state.selectedNode===symbol.id,
    visible:match.has(symbol.id)&&(!traceNodes||traceNodes.has(symbol.id)),
    dimmed:hasComparison&&emphasis!=='all'&&!(emphasis==='direct'?changed:impacted).has(symbol.id),
    openThreads:threadCounts.get(symbol.id)?.open??0,totalThreads:threadCounts.get(symbol.id)?.total??0,members:members.get(symbol.id)??[],
  }));
  const visible=new Set(nodes.filter(n=>n.visible).map(n=>n.id));
  const edgeThreads=new Map<string,number>();
  const edgeTotals=new Map<string,number>();
  for(const thread of options.review?.threads??[])if(thread.target.edgeId)edgeTotals.set(thread.target.edgeId,(edgeTotals.get(thread.target.edgeId)??0)+1);
  for(const thread of options.review?.threads??[]){if(thread.target.edgeId&&thread.status==='open')
    edgeThreads.set(thread.target.edgeId,(edgeThreads.get(thread.target.edgeId)??0)+1);}
  const edges=graph.edges.map(relation=>({id:relation.id,
    relation:edgeStatus.get(relation.id)&&!relation.change?{...relation,change:edgeStatus.get(relation.id)}:relation,
    openThreads:(edgeThreads.get(relation.id)??0)+(relation.memberEdgeIds??[]).reduce((sum,id)=>sum+(edgeThreads.get(id)??0),0),selected:state.selectedNode===relation.source||state.selectedNode===relation.target,
    totalThreads:(edgeTotals.get(relation.id)??0)+(relation.memberEdgeIds??[]).reduce((sum,id)=>sum+(edgeTotals.get(id)??0),0),
    dimmed:hasComparison&&emphasis!=='all'&&!(relation.change&&relation.change!=='UNCHANGED')&&
      !(emphasis==='direct'?changed:impacted).has(relation.source)&&!(emphasis==='direct'?changed:impacted).has(relation.target),
    visible:state.edgeKinds.includes(relation.kind)&&visible.has(relation.source)&&visible.has(relation.target)&&
      (!traceEdges||traceEdges.has(relation.id)),
  }));
  // Keep full graph for 2D's existing structural layout; visibility is explicit renderer data.
  return {graph,nodes,edges,folders:[...new Set(nodes.map(n=>n.folder))].sort()};
}
