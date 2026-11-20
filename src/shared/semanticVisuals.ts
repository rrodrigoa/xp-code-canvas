/** Source-backed visual semantics. All color meaning is separate from Git status.
 * No AI inference, runtime profiling, or estimated execution flow is involved. */
import type { GraphNode, SourceGraph, NodeKind, ChangeStatus } from './types';

export type SemanticDetail = 0 | 1 | 2 | 3;
export type VisualRole = 'module' | 'class' | 'callable' | 'data' | 'external';
export interface StructurePart {
  id: string; name: string; kind: NodeKind; role: VisualRole;
  startLine: number; lineSpan: number; linkCount: number;
  change?: ChangeStatus; isClickable: boolean;
}
export interface StructureSummary {
  parts: StructurePart[]; total: number; hidden: number;
  lineSpan: number; connections: number; distinctKinds: number;
}

/** Stable threshold bands; a selected/explicitly opened node can independently reach source. */
export function detailForZoom(zoom: number, expanded = false): SemanticDetail {
  if (expanded) return 3;
  if (zoom < 0.64) return 0;
  if (zoom < 1.13) return 1;
  if (zoom < 1.88) return 2;
  return 3;
}
/** At high canvas magnification, expand source ONLY for the selected or explicitly
 * expanded node. Nonselected nodes remain anatomy cards; this bounds source
 * requests and avoids turning every UML card into a large scroll pane. */
export function detailForNode(
  zoom:number,
  manuallyExpanded:boolean,
  selected:boolean,
):SemanticDetail {
  if (manuallyExpanded || (selected && zoom >= 1.88)) return 3;
  return Math.min(2,detailForZoom(zoom)) as SemanticDetail;
}
export function semanticRole(kind: NodeKind): VisualRole {
  if (kind === 'module') return 'module';
  if (kind === 'class') return 'class';
  if (kind === 'external') return 'external';
  if (kind === 'property') return 'data';
  return 'callable';
}
export function sourceLines(node: GraphNode): number {
  return Math.max(1, node.range.endLine - node.range.startLine + 1);
}
/** Build once for a graph revision; reusing it avoids O(nodes * edges) work
 * when every visible UML card requests a colored structural summary. */
export interface StructureIndex {
  byId: ReadonlyMap<string,GraphNode>;
  childrenByParent: ReadonlyMap<string,ReadonlyArray<GraphNode>>;
  moduleCandidates: ReadonlyMap<string,ReadonlyArray<GraphNode>>;
  relationCounts: ReadonlyMap<string,number>;
}
const moduleKey=(uri:string,moduleId:string)=>`${uri}\0${moduleId}`;
export function createStructureIndex(sourceGraph:SourceGraph):StructureIndex {
  const byId=new Map<string,GraphNode>();
  const childrenByParent=new Map<string,GraphNode[]>();
  const moduleCandidates=new Map<string,GraphNode[]>();
  const relationCounts=new Map<string,number>();
  for(const node of sourceGraph.nodes){
    byId.set(node.id,node);
    if(node.parentId){
      const descendants=childrenByParent.get(node.parentId)??[];
      descendants.push(node);childrenByParent.set(node.parentId,descendants);
    }
    const key=moduleKey(node.uri,node.moduleId);
    const peers=moduleCandidates.get(key)??[];
    peers.push(node);moduleCandidates.set(key,peers);
  }
  for(const edge of sourceGraph.edges){
    relationCounts.set(edge.source,(relationCounts.get(edge.source)??0)+1);
    relationCounts.set(edge.target,(relationCounts.get(edge.target)??0)+1);
  }
  return {byId,childrenByParent,moduleCandidates,relationCounts};
}
/** Summaries never fabricate source structure; only indexed declarations are parts.
 * Callers rendering many cards should pass one shared index per graph revision. */
export function summarizeStructure(
  container:GraphNode,sourceGraph:SourceGraph,limit=18,index?:StructureIndex,
):StructureSummary {
  const lookup=index??createStructureIndex(sourceGraph);
  const children=container.members?.length
    ? container.members.map(id=>lookup.byId.get(id)).filter((value):value is GraphNode=>Boolean(value))
    : [
      ...(lookup.childrenByParent.get(container.id)??[]),
      ...(container.kind==='module'
        ? (lookup.moduleCandidates.get(moduleKey(container.uri,container.moduleId))??[])
          .filter(node=>node.parentId===container.moduleId)
        : []),
    ];
  const members=[...new Map(children.map(child=>[child.id,child])).values()]
    .filter(child=>child.id!==container.id)
    .sort((a,b)=>a.range.startLine-b.range.startLine||a.id.localeCompare(b.id));
  const parts=members.slice(0,Math.max(0,limit)).map(node=>({
    id:node.id,name:node.name,kind:node.kind,role:semanticRole(node.kind),
    startLine:node.range.startLine,lineSpan:sourceLines(node),
    linkCount:lookup.relationCounts.get(node.id)??0,change:node.change,isClickable:true,
  }));
  return {parts,total:members.length,hidden:Math.max(0,members.length-parts.length),
    lineSpan:sourceLines(container),
    connections:members.reduce((sum,node)=>sum+(lookup.relationCounts.get(node.id)??0),0),
    distinctKinds:new Set(members.map(node=>node.kind)).size,
  };
}
export interface ScopeFrame {
  id: string; uri: string; label: string; x: number; y: number; width: number; height: number; count: number;
}
/** On-canvas file boundaries only, never mutate underlying UML positions. */
export function scopeFrames(
  nodes: ReadonlyArray<{id:string;uri:string;x:number;y:number;width:number;height:number}>,
  options: {padding?:number;minMembers?:number} = {},
): ScopeFrame[] {
  const padding=options.padding??30, minMembers=options.minMembers??2;
  const groups = new Map<string, typeof nodes[number][]>();
  for (const node of nodes) groups.set(node.uri,[...(groups.get(node.uri)??[]),node]);
  return [...groups.entries()].filter(([,members])=>members.length>=minMembers).map(([uri,members])=>{
    const minX=Math.min(...members.map(n=>n.x)), maxX=Math.max(...members.map(n=>n.x+n.width));
    const minY=Math.min(...members.map(n=>n.y)), maxY=Math.max(...members.map(n=>n.y+n.height));
    return {id:`scope:${uri}`,uri,label:uri.split('/').pop()||uri,
      x:minX-padding,y:minY-padding-14,width:maxX-minX+padding*2,height:maxY-minY+padding*2+14,count:members.length};
  }).sort((a,b)=>a.uri.localeCompare(b.uri));
}
