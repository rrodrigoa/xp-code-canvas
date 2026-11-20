/** V6 relationship geometry: small typed ports and global collision-free hover labels.
 * Only viewport-visible / selected labels are allocated. Source evidence is unchanged. */
import type {EdgeKind,GraphEdge,GraphNode} from '../../shared/types';
import type {Point,Rect} from '../edgeLabels';
import {placeEdgeLabel} from '../edgeLabels';

export const EDGE_KINDS:readonly EdgeKind[]=['inherits','realizes','calls','creates','imports','references','contains'];
export function portForRelationship(kind:EdgeKind,side:'source'|'target'):string {return `${side}-${kind}`;}
export function portOffset(kind:EdgeKind):number {
  const idx=EDGE_KINDS.indexOf(kind);return 20+(idx<0?3:idx)*10;
}
export interface LabelRequest {id:string;start:Point;end:Point;text:string;priority:number;preferred?:Point}
export interface PlacedLabel {id:string;x:number;y:number;width:number;height:number}
export function allocateEdgeLabels(requests:readonly LabelRequest[],nodes:readonly Rect[],maxLabels=32):PlacedLabel[] {
  const occupied:Rect[]=[...nodes];const placed:PlacedLabel[]=[];
  for(const label of [...requests].sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,maxLabels)){
    const width=Math.min(215,Math.max(78,label.text.length*6.2+25)),height=25;
    const point=placeEdgeLabel(label.start,label.end,occupied,width,label.preferred);
    if(!point)continue;
    const bounds={x:point.x-width/2,y:point.y-height/2,width,height};
    occupied.push(bounds);placed.push({id:label.id,...point,width,height});
  }
  return placed;
}
/** Source code is already projected by GraphProjection; additionally merge exact duplicate
 * projected connections without losing member IDs or evidence. Never merge different UML kinds. */
export function bundleProjectedEdges(edges:readonly GraphEdge[],zoom:number):GraphEdge[] {
  if(zoom>=1.3)return [...edges];
  const bundles=new Map<string,GraphEdge>();
  for(const edge of edges){
    const key=`${edge.source}\u001f${edge.target}\u001f${edge.kind}`;
    const found=bundles.get(key);
    if(found){
      found.count=(found.count??1)+(edge.count??1);
      found.memberEdgeIds=[...(found.memberEdgeIds??[]),...(edge.memberEdgeIds??[edge.id])];
      found.evidence=[...found.evidence,...edge.evidence];
      if(edge.confidence!=='resolved')found.confidence=edge.confidence;
    }else bundles.set(key,{...edge,evidence:[...edge.evidence],memberEdgeIds:[...(edge.memberEdgeIds??[edge.id])],count:edge.count??1});
  }
  return [...bundles.values()];
}
export interface MetricSnapshot {kind:string;count:number;label:string}
export function relationshipSummary(node:GraphNode,edges:readonly GraphEdge[]):{incoming:number;outgoing:number;unresolved:number} {
  let incoming=0,outgoing=0,unresolved=0;
  for(const edge of edges){if(edge.source!==node.id&&edge.target!==node.id)continue;
    const weight=edge.count??1;if(edge.source===node.id)outgoing+=weight;
    if(edge.target===node.id)incoming+=weight;
    if(edge.confidence!=='resolved')unresolved+=weight;
  }
  return {incoming,outgoing,unresolved};
}
