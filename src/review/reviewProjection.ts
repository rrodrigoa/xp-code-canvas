import type { SourceGraph, GraphNode } from '../shared/types';
import type { ReviewSnapshot, ReviewThread, ReviewDecoration, ReviewMetrics, ReviewTarget } from './reviewTypes';
/** Pure visual projection. Review status is NEVER written back to the canonical source graph. */
export function decorateReview(review:ReviewSnapshot):ReviewDecoration {
  const direct=new Set<string>(),affected=new Set<string>();
  const nodeStatus=new Map<string,NonNullable<GraphNode['change']>>();
  const edgeStatus=new Map<string,NonNullable<SourceGraph['edges'][number]['change']>>();
  for(const node of review.graph.nodes){
    if(node.change){nodeStatus.set(node.id,node.change);if(node.change==='IMPACTED')affected.add(node.id);
      else if(node.change!=='UNCHANGED')direct.add(node.id);}
  }
  for(const edge of review.graph.edges)if(edge.change)edgeStatus.set(edge.id,edge.change);
  const counts=countThreads(review.threads,review.graph);
  return {nodeStatus,edgeStatus,counts,direct,affected};
}
/** Comments can be anchored directly to nodes, to edges, or to source lines. Unresolved historical anchors remain in the thread list. */
export function matchThreadToNodes(thread:ReviewThread,graph:SourceGraph):string[]{
  const t=thread.target;
  if(t.nodeId&&graph.nodes.some(n=>n.id===t.nodeId))return [t.nodeId];
  if(t.edgeId){const e=graph.edges.find(e=>e.id===t.edgeId);if(e)return [e.source,e.target];}
  if(!t.uri)return [];
  const candidates=graph.nodes.filter(n=>sameSource(n.uri,t.uri!) &&
    (t.line===undefined || (n.range.startLine<=t.line && n.range.endLine>=t.line)));
  if(!candidates.length)return [];
  if(t.qualifiedName){const exact=candidates.find(n=>n.qualifiedName===t.qualifiedName);if(exact)return [exact.id];}
  candidates.sort((a,b)=>(a.range.endLine-a.range.startLine)-(b.range.endLine-b.range.startLine) || b.range.startLine-a.range.startLine);
  return [candidates[0].id];
}
function sameSource(a:string,b:string):boolean {return a===b||decodeURIComponent(a).replace(/\\/g,'/').endsWith('/'+b.replace(/\\/g,'/').replace(/^\//,''));}
export function countThreads(threads:ReviewThread[],graph:SourceGraph):Map<string,{open:number;resolved:number;total:number}>{
  const counts=new Map<string,{open:number;resolved:number;total:number}>();
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  for(const thread of threads){
    const ids=matchThreadToNodes(thread,graph);
    for(const id of ids){const value=counts.get(id)??{open:0,resolved:0,total:0};value.total++;
      if(thread.status==='resolved')value.resolved++;else value.open++;
      counts.set(id,value);
      // Aggregate comment counts on parent class/module as secondary badges.
      const visited=new Set([id]);let node=graph.nodes.find(n=>n.id===id);
      while(node?.parentId&&!visited.has(node.parentId)){
        visited.add(node.parentId);const parent=byId.get(node.parentId);if(!parent)break;
        const c=counts.get(parent.id)??{open:0,resolved:0,total:0};c.total++;
        if(thread.status==='resolved')c.resolved++;else c.open++;
        counts.set(parent.id,c);node=parent;
      }
    }
  }
  return counts;
}
export function reviewMetrics(review:ReviewSnapshot):ReviewMetrics {
  const nodes=review.graph.nodes,edges=review.graph.edges;
  const threads=review.threads;
  return {changed:nodes.filter(n=>n.change&&n.change!=='UNCHANGED'&&n.change!=='IMPACTED').length,
    added:nodes.filter(n=>n.change==='ADDED').length,modified:nodes.filter(n=>n.change==='MODIFIED').length,
    removed:nodes.filter(n=>n.change==='REMOVED').length,
    potentiallyAffected:nodes.filter(n=>n.change==='IMPACTED').length,
    linksChanged:edges.filter(e=>e.change==='ADDED'||e.change==='REMOVED').length,
    filesChanged:review.files.length,openThreads:threads.filter(t=>t.status==='open').length,
    resolvedThreads:threads.filter(t=>t.status==='resolved').length};
}
export function validateTarget(target:ReviewTarget):ReviewTarget {
  if(!target.nodeId&&!target.edgeId&&!target.uri)throw Error('Review comment needs a symbol, relationship, or source anchor');
  if(target.line!==undefined&&(!Number.isInteger(target.line)||target.line<0))throw Error('Invalid source line');
  for(const value of [target.nodeId,target.edgeId,target.uri,target.qualifiedName])if(value&&value.length>4096)throw Error('Review anchor too large');
  return target;
}
