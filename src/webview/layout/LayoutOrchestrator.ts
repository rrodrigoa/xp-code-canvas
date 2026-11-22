/** V6: presentation-only layout engine. Never mutates the source graph.
 * Geometry is expressed in world coordinates (unscaled pixels). */
import type {CanvasState, GraphNode, SourceGraph, XY} from '../../shared/types';
import {calculateLayout, nodeSize, type NodeSize} from '../elkLayout';

export type LayoutMode='architecture'|'file'|'investigation'|'change'|'spread';
export type NodeDimensions=ReadonlyMap<string,NodeSize>;
export interface LayoutBox extends XY {id:string;width:number;height:number;pinned?:boolean}

export function layoutModeFor(state:CanvasState):LayoutMode {
  return state.layoutMode??(state.focusedFile?'file':'architecture');
}
export function visualBounds(node:GraphNode,state:CanvasState, measured:NodeDimensions, counts:ReadonlyMap<string,number>,blamed:ReadonlySet<string>):NodeSize {
  return measured.get(node.id)??nodeSize(node,state,counts,blamed.has(node.id));
}
function sourceOrder(a:GraphNode,b:GraphNode):number {
  return a.uri.localeCompare(b.uri)||a.range.startLine-b.range.startLine||a.id.localeCompare(b.id);
}
function placeColumn(nodes:GraphNode[],x:number, size:(node:GraphNode)=>NodeSize, top=80, gap=64):Record<string,XY> {
  const output:Record<string,XY>={};let y=top;
  for(const node of nodes){output[node.id]={x,y};y+=size(node).height+gap;}
  return output;
}
function threeLanes(graph:SourceGraph,center:GraphNode[], size:(n:GraphNode)=>NodeSize):Record<string,XY> {
  const centerSet=new Set(center.map(n=>n.id));
  const callers=new Set<string>(),callees=new Set<string>();
  for(const edge of graph.edges){
    if(centerSet.has(edge.target)&&!centerSet.has(edge.source))callers.add(edge.source);
    if(centerSet.has(edge.source)&&!centerSet.has(edge.target))callees.add(edge.target);
  }
  const incoming=graph.nodes.filter(n=>callers.has(n.id)&&!centerSet.has(n.id)).sort(sourceOrder);
  const outgoing=graph.nodes.filter(n=>callees.has(n.id)&&!centerSet.has(n.id)&&!callers.has(n.id)).sort(sourceOrder);
  const others=graph.nodes.filter(n=>!centerSet.has(n.id)&&!callers.has(n.id)&&!callees.has(n.id)).sort(sourceOrder);
  const leftWidth=Math.max(280,...incoming.map(n=>size(n).width));
  const centerWidth=Math.max(300,...center.map(n=>size(n).width));
  const rightWidth=Math.max(300,...outgoing.map(n=>size(n).width));
  const centerX=leftWidth+230;
  return {
    ...placeColumn(center,centerX,size,80,76),
    ...placeColumn(incoming,70,size,80,56),
    ...placeColumn(outgoing,centerX+centerWidth+190,size,80,56),
    ...placeColumn(others,centerX+centerWidth+rightWidth+420,size,80,45),
  };
}
/** Balanced 2-D packing with source-order stability. A dense workspace never becomes a 500-card column.
 * Grouped ordering keeps related file symbols neighbors, and rows use measured card heights.
 * No relationships or source coordinates are modified. */
export function spreadLayout(graph:SourceGraph,size:(node:GraphNode)=>NodeSize,focusedFile?:string|null):Record<string,XY> {
  const sorted=[...graph.nodes].sort((a,b)=>
    (Number(b.uri===focusedFile)-Number(a.uri===focusedFile))||sourceOrder(a,b));
  if(!sorted.length)return {};
  // For ~584 symbols this produces ~23 columns and ~26 rows instead of a >100kpx lane.
  const columns=Math.max(2,Math.min(30,Math.ceil(Math.sqrt(sorted.length))));
  const gapX=88,gapY=76;
  const widths=Array.from({length:columns},()=>0);
  const rows:GraphNode[][]=[];
  for(let i=0;i<sorted.length;i+=columns)rows.push(sorted.slice(i,i+columns));
  for(const row of rows)row.forEach((n,index)=>{widths[index]=Math.max(widths[index],size(n).width);});
  const xs:number[]=[];let x=60;
  for(let c=0;c<columns;c++){xs[c]=x;x+=widths[c]+gapX;}
  const output:Record<string,XY>={};let y=64;
  for(const row of rows){
    let height=0;
    row.forEach((node,index)=>{output[node.id]={x:xs[index],y};height=Math.max(height,size(node).height);});
    y+=height+gapY;
  }
  return output;
}

export function investigationLayout(graph:SourceGraph,focusId:string|undefined,size:(n:GraphNode)=>NodeSize):Record<string,XY>|undefined {
  const focus=graph.nodes.find(n=>n.id===focusId);
  if(!focus)return;
  return threeLanes(graph,[focus],size);
}
const changeOrder:Record<string,number>={ADDED:0,MODIFIED:1,REMOVED:2,IMPACTED:3,AMBIGUOUS:4,UNCHANGED:5};
/** Changes are grouped into separate left-to-right columns. Unknown/unchanged symbols stay available, not removed. */
export function changeLayout(graph:SourceGraph,size:(n:GraphNode)=>NodeSize):Record<string,XY> {
  const columns=new Map<number,GraphNode[]>();
  for(const node of graph.nodes){const rank=changeOrder[node.change??'UNCHANGED']??5;columns.set(rank,[...(columns.get(rank)??[]),node]);}
  let x=64;const results:Record<string,XY>={};
  for(const rank of [...columns.keys()].sort((a,b)=>a-b)){
    const members=(columns.get(rank)??[]).sort(sourceOrder);
    Object.assign(results,placeColumn(members,x,size,110,58));
    x+=Math.max(280,...members.map(n=>size(n).width))+145;
  }
  return results;
}

/** Collision correction after DOM measurement. Handles pinned anchors, with deterministic ordering.
 * This is incremental: nodes are displaced only when they actually intersect.
 * It deliberately moves nodes downwards within columns to preserve graph mental map. */
export function settleMeasuredLayout(
  boxes:readonly LayoutBox[],anchorId:string|null=null,gap=30
):Record<string,XY> {
  const positions:Record<string,XY>={};
  const sorted=[...boxes].sort((a,b)=>Number(b.id===anchorId)-Number(a.id===anchorId)||Number(!!b.pinned)-Number(!!a.pinned)||a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
  const binSize=256,grid=new Map<string,LayoutBox[]>();
  const bins=(box:LayoutBox)=>{
    const cells:string[]=[];
    const left=Math.floor((box.x-gap)/binSize),right=Math.floor((box.x+box.width+gap)/binSize);
    const top=Math.floor((box.y-gap)/binSize),bottom=Math.floor((box.y+box.height+gap)/binSize);
    for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)cells.push(`${x}:${y}`);
    return cells;
  };
  for(const box of sorted){
    let y=box.y;
    if(!box.pinned&&box.id!==anchorId){
      for(let iteration=0;iteration<boxes.length+1;iteration++){
        const probe={...box,y};
        const candidates=new Set<LayoutBox>();
        for(const bin of bins(probe))for(const neighbor of grid.get(bin)??[])candidates.add(neighbor);
        let next=y;
        for(const prev of candidates){
          const xOverlap=box.x<prev.x+prev.width+gap&&box.x+box.width+gap>prev.x;
          const yOverlap=y<prev.y+prev.height+gap&&y+box.height+gap>prev.y;
          if(xOverlap&&yOverlap)next=Math.max(next,prev.y+prev.height+gap);
        }
        if(next===y)break;
        y=next;
      }
    }
    const current={...box,y};positions[box.id]={x:box.x,y};
    for(const bin of bins(current))grid.set(bin,[...(grid.get(bin)??[]),current]);
  }
  return positions;
}

/** Save per-mode/manual overrides, respect explicit pins, reuse measured bounds.
 * Automatic modes only change the view projection, not Python graph data. */
export async function orchestrateLayout(
  graph:SourceGraph,state:CanvasState,counts:ReadonlyMap<string,number>,blamed:ReadonlySet<string>,
  measured:NodeDimensions=new Map()
):Promise<Record<string,XY>> {
  const mode=layoutModeFor(state),size=(n:GraphNode)=>visualBounds(n,state,measured,counts,blamed);
  let positions:Record<string,XY>;
  if(mode==='spread')positions=spreadLayout(graph,size,state.focusedFile);
  else if(mode==='investigation')positions=investigationLayout(graph,state.selectedNode??undefined,size)??await calculateLayout(graph,state,counts,blamed,measured);
  else if(mode==='change')positions=changeLayout(graph,size);
  else positions=await calculateLayout(graph,{...state,focusedFile:mode==='file'?state.focusedFile:null},counts,blamed,measured);
  const remembered=state.layoutPositions?.[mode]??{};
  for(const [id,pos] of Object.entries(remembered))if(id in positions)positions[id]=pos;
  for(const [id,pos] of Object.entries(state.pinned))if(id in positions)positions[id]=pos;
  return positions;
}
