/** Static source-reference Sankey projection. It does NOT depict runtime traffic or CPU use.
 * A two-sided focus graph represents independent inbound and outbound relationships;
 * it does NOT imply that callers flow through the focus into its dependencies. */
import type { GraphEdge, GraphNode, SourceGraph } from './types';
export type FlowKind = 'calls' | 'imports' | 'references' | 'creates';
export interface FlowPeer {
  id:string; label:string; kind:GraphNode['kind']; weight:number; relationIds:string[];
  synthetic?:boolean; confidence:'resolved'|'ambiguous'|'unresolved';
}
export interface FlowLensModel {
  focus:GraphNode|null; kind:FlowKind; inbound:FlowPeer[]; outbound:FlowPeer[];
  inboundTotal:number; outboundTotal:number; workspaceTotal:number;
  inboundShare:number; outboundShare:number; recursive:number; truncated:boolean;
  weightLabel:string;
}
const KNOWN=new Set<FlowKind>(['calls','imports','references','creates']);
function weight(edge:GraphEdge):number {
  const sites=new Set(edge.evidence.map(e=>`${e.uri}:${e.range.startLine}:${e.range.startCharacter}:${e.range.endLine}:${e.range.endCharacter}`));
  return Math.max(1,typeof edge.count==='number'&&Number.isFinite(edge.count)?edge.count:0,sites.size); // use evidence where present; fallback to one relation // count one documented relationship when callsite evidence is unavailable
}
function collect(edges:GraphEdge[],kind:FlowKind,byId:Map<string,GraphNode>,side:'incoming'|'outgoing',focus:string,maxPeers:number){
  const grouped=new Map<string,FlowPeer>();
  for (const edge of edges) {
    if (edge.kind!==kind || (side==='incoming'?edge.target:edge.source)!==focus || edge.source===edge.target)continue;
    const peerId=side==='incoming'?edge.source:edge.target, peer=byId.get(peerId);
    if (!peer)continue;
    const prior=grouped.get(peerId);
    if (prior){prior.weight+=weight(edge);prior.relationIds.push(edge.id);
      if(edge.confidence!=='resolved')prior.confidence=edge.confidence;
    }else grouped.set(peerId,{id:peer.id,label:peer.name||peer.qualifiedName,kind:peer.kind,
      weight:weight(edge),relationIds:[edge.id],confidence:edge.confidence});
  }
  const sorted=[...grouped.values()].sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id));
  if(sorted.length<=maxPeers)return {peers:sorted,truncated:false};
  const kept=sorted.slice(0,maxPeers),rest=sorted.slice(maxPeers);
  kept.push({id:`__other__:${side}`,label:`${rest.length} more symbols`,kind:'external',
    weight:rest.reduce((n,p)=>n+p.weight,0),relationIds:rest.flatMap(p=>p.relationIds),
    synthetic:true,confidence:rest.some(p=>p.confidence!=='resolved')?'ambiguous':'resolved'});
  return {peers:kept,truncated:true};
}
export function buildFlowLens(graph:SourceGraph,kind:FlowKind,selectedId?:string|null,maxPeers=9):FlowLensModel {
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const edges=graph.edges.filter(e=>e.kind===kind);
  const degrees=new Map<string,number>();
  for(const edge of edges){const w=weight(edge);degrees.set(edge.source,(degrees.get(edge.source)??0)+w);degrees.set(edge.target,(degrees.get(edge.target)??0)+w);}
  const focus=(selectedId && byId.get(selectedId)) || [...graph.nodes]
    .sort((a,b)=>(degrees.get(b.id)??0)-(degrees.get(a.id)??0)||a.id.localeCompare(b.id))[0] || null;
  const workspaceTotal=edges.reduce((sum,e)=>sum+weight(e),0);
  const base={focus,kind,inbound:[],outbound:[],inboundTotal:0,outboundTotal:0,workspaceTotal,
    inboundShare:0,outboundShare:0,recursive:0,truncated:false,
    weightLabel:kind==='calls'?'Static call sites':kind==='imports'?'Static import relationships':kind==='creates'?'Static construction relationships':'Static references'} satisfies FlowLensModel;
  if(!focus || !KNOWN.has(kind))return base;
  const incoming=collect(edges,kind,byId,'incoming',focus.id,Math.max(1,maxPeers));
  const outgoing=collect(edges,kind,byId,'outgoing',focus.id,Math.max(1,maxPeers));
  const inboundTotal=incoming.peers.reduce((sum,p)=>sum+p.weight,0),outboundTotal=outgoing.peers.reduce((sum,p)=>sum+p.weight,0);
  return {...base,inbound:incoming.peers,outbound:outgoing.peers,inboundTotal,outboundTotal,
    inboundShare:workspaceTotal?inboundTotal/workspaceTotal:0,outboundShare:workspaceTotal?outboundTotal/workspaceTotal:0,
    recursive:edges.filter(e=>e.source===focus.id&&e.target===focus.id).reduce((sum,e)=>sum+weight(e),0),
    truncated:incoming.truncated||outgoing.truncated};
}
/** Geometry for a 3-column, two-sided Sankey; each ribbon width is proportional to
 * a static relationship count, never artificially weighted by node type or inferred runtime. */
export interface FlowRibbon {
  id:string; peerId:string; side:'incoming'|'outgoing'; path:string;
  thickness:number; weight:number; fromY:number; toY:number; confidence:FlowPeer['confidence'];
}
export interface FlowBar extends FlowPeer {side:'incoming'|'outgoing';x:number;y:number;width:number;height:number}
export interface FlowGeometry {bars:FlowBar[];ribbons:FlowRibbon[];center:{x:number;y:number;width:number;height:number};scale:number}
export function ribbonPath(x0:number,y0:number,x1:number,y1:number,thickness:number):string{
  const c=Math.max(20,(x1-x0)*0.47),half=thickness/2;
  return `M${x0},${y0-half} C${x0+c},${y0-half} ${x1-c},${y1-half} ${x1},${y1-half}`+
    ` L${x1},${y1+half} C${x1-c},${y1+half} ${x0+c},${y0+half} ${x0},${y0+half} Z`;
}
export function layoutFlowLens(model:FlowLensModel):FlowGeometry {
  const maxTotal=Math.max(1,model.inboundTotal,model.outboundTotal);
  const unit=Math.min(24,300/maxTotal);
  const top=126,centerX=484,centerWidth=145,leftX=76,leftWidth=174,rightX=864,rightWidth=174;
  const rowGap=13,minBar=25;
  const side=(peers:FlowPeer[],x:number,sideName:'incoming'|'outgoing'):FlowBar[]=>{
    const heights=peers.map(p=>Math.max(minBar,p.weight*unit));
    const total=heights.reduce((sum,h)=>sum+h,0)+Math.max(0,peers.length-1)*rowGap;
    let y=Math.max(top, top+(360-total)/2);
    return peers.map((peer,i)=>{const bar={...peer,side:sideName,x,y,width:sideName==='incoming'?leftWidth:rightWidth,height:heights[i]};y+=heights[i]+rowGap;return bar;});
  };
  const inbound=side(model.inbound,leftX,'incoming'),outbound=side(model.outbound,rightX,'outgoing');
  const centerHeight=Math.max(56,maxTotal*unit+20),centerY=top+(360-centerHeight)/2;
  let inPort=centerY+10,outPort=centerY+10;
  const ribbons:FlowRibbon[]=[];
  for(const bar of inbound){const thickness=bar.weight*unit;
    const fromY=bar.y+bar.height/2,toY=inPort+thickness/2;inPort+=thickness;
    ribbons.push({id:`in:${bar.id}`,peerId:bar.id,side:'incoming',path:ribbonPath(bar.x+bar.width,fromY,centerX,toY,thickness),thickness,weight:bar.weight,fromY,toY,confidence:bar.confidence});}
  for(const bar of outbound){const thickness=bar.weight*unit;
    const fromY=outPort+thickness/2,toY=bar.y+bar.height/2;outPort+=thickness;
    ribbons.push({id:`out:${bar.id}`,peerId:bar.id,side:'outgoing',path:ribbonPath(centerX+centerWidth,fromY,bar.x,toY,thickness),thickness,weight:bar.weight,fromY,toY,confidence:bar.confidence});}
  return {bars:[...inbound,...outbound],ribbons,center:{x:centerX,y:centerY,width:centerWidth,height:centerHeight},scale:unit};
}
