import ELK from 'elkjs/lib/elk.bundled.js';
import type { GraphNode, SourceGraph, XY, CanvasState } from '../shared/types';
import {detailForNode} from '../shared/semanticVisuals';
const elk=new ELK();
export interface NodeSize { width:number; height:number }
export function nodeSize(node:GraphNode,state:CanvasState, memberCounts:ReadonlyMap<string,number>=new Map(),blameShown=false):NodeSize {
  const tier=detailForNode(state.zoom,state.expanded.includes(node.id),state.selectedNode===node.id);
  const custom=tier===3?state.nodeSizes?.[node.id]:undefined;
  // Match the visual card's bounded intrinsic width. Long Python signatures
  // get breathing room without creating unbounded horizontal lanes.
  const estimatedLabelWidth=Math.min(500,Math.max(node.name.length*7.1+76,(node.signature?.length??0)*5.5+68));
  const baseWidth=node.kind==='class'?316:node.kind==='module'?282:296;
  const width=tier===3?Math.max(470,Math.min(550,estimatedLabelWidth+120))
    :tier===2?Math.max(360,Math.min(420,estimatedLabelWidth+40))
    :tier===1?Math.max(baseWidth,Math.min(390,estimatedLabelWidth))
    :Math.min(310,baseWidth);
  const attributes=node.attributes?.length??0;
  const operations=memberCounts.get(node.id)??node.operations?.length??0;
  // Match CSS max-heights; reserve space for syntax preview and status strips.
  const classDetails=node.kind==='class'
    ? Math.min(178,31+Math.max(1,attributes)*22)+Math.min(178,31+Math.max(1,operations)*22)
    : node.signature?Math.min(110,35+Math.ceil(node.signature.length/37)*16):0;
  const docstring=node.kind!=='class'&&node.docstring?75:0;
  const anatomy=nestedAnatomyHeight(node,tier);
  const blameHeight=blameShown?(tier>=3?200:tier>=2?170:tier===1?65:0):0;
  const decorations=blameHeight+56+30+(node.change&&node.change!=='UNCHANGED'?32:0)+(node.stale?30:0)+12;
  if(tier===0)return {width,height:decorations+65};
  if(tier===1)return {width,height:decorations+classDetails+docstring};
  // Class field inventory adds two rows of non-interactive chips in anatomy mode.
  // Reserve its height so ELK and the file-focus lane do not overlap neighbors.
  const fieldInventory=node.kind==='class'&&attributes>0?Math.min(102,45+Math.ceil(Math.min(14,attributes)/4)*18):0;
  if(tier===2)return {width,height:decorations+220+fieldInventory+anatomy};
  return {width:custom?.width??width,height:custom?.height??decorations+220+fieldInventory+385+anatomy};
}
function nestedAnatomyHeight(node:GraphNode,tier:number):number {
  if(tier<2||!node.anatomy?.length)return 0;
  return 80+Math.min(8,node.anatomy.length)*26;
}
const SOURCE_ORDER=(a:GraphNode,b:GraphNode)=>a.uri.localeCompare(b.uri)||a.range.startLine-b.range.startLine||a.id.localeCompare(b.id);
function fallbackGrid(graph:SourceGraph,state:CanvasState,counts:ReadonlyMap<string,number>,blamed:ReadonlySet<string>=new Set(),measured:ReadonlyMap<string,NodeSize>=new Map()):Record<string,XY> {
  const positions:Record<string,XY>={};
  let rowHeight=0, x=40,y=50;
  for(const node of [...graph.nodes].sort(SOURCE_ORDER)){
    const size=(measured.get(node.id)??nodeSize(node,state,counts,blamed.has(node.id)));
    if(x>1340){x=40;y+=rowHeight+64;rowHeight=0;}
    positions[node.id]={x,y};x+=size.width+76;rowHeight=Math.max(rowHeight,size.height);
  }
  return positions;
}
function isFocusNode(n:GraphNode, file:string, graph:SourceGraph):boolean {
  if(n.uri!==file)return false;
  const higherLevel=graph.nodes.some(candidate=>candidate.uri===file && ['class','function'].includes(candidate.kind));
  return !higherLevel || ['module','class','function'].includes(n.kind);
}
/** Deterministic source-ordered center lane plus weighted-neighbor lanes.
 * Neighbor ranking minimizes crossing while variable-height stacks eliminate overlaps. */
export function focusedLaneLayout(graph:SourceGraph,state:CanvasState,counts:ReadonlyMap<string,number>=new Map(),blamed:ReadonlySet<string>=new Set(),measured:ReadonlyMap<string,NodeSize>=new Map()):Record<string,XY> {
  const focus=state.focusedFile;
  if(!focus)return fallbackGrid(graph,state,counts,blamed,measured);
  const center=graph.nodes.filter(n=>isFocusNode(n,focus,graph)).sort(SOURCE_ORDER);
  if(!center.length)return fallbackGrid(graph,state,counts,blamed,measured);
  // Escape the single-column dead end automatically on very large workspaces.
  // File focus remains a vertical stack for small files, but large projects
  // are wrapped into a balanced grid sorted with the focused file first.
  if(center.length>18 || graph.nodes.length>130){
    const order=[...graph.nodes].sort((a,b)=>Number(b.uri===focus)-Number(a.uri===focus)||SOURCE_ORDER(a,b));
    const cols=Math.max(3,Math.min(28,Math.ceil(Math.sqrt(order.length))));
    const rows=Math.ceil(order.length/cols);
    const columnWidths=new Array<number>(cols).fill(0);
    for(let i=0;i<order.length;i++){const n=order[i];columnWidths[i%cols]=Math.max(columnWidths[i%cols],(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).width);}
    const columnXs:number[]=[];let x=50;
    for(let c=0;c<cols;c++){columnXs[c]=x;x+=columnWidths[c]+75;}
    const out:Record<string,XY>={};let y=70;
    for(let row=0;row<rows;row++){let height=0;
      for(let col=0;col<cols;col++){const n=order[row*cols+col];if(!n)break;
        out[n.id]={x:columnXs[col],y};
        height=Math.max(height,(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).height);
      }
      y+=height+66;
    }
    return out;
  }
  const centerIds=new Set(center.map(n=>n.id));
  const order=new Map(center.map((n,i)=>[n.id,i]));
  const inbound=new Set<string>(),outbound=new Set<string>();
  const affinities=new Map<string,number[]>();
  for(const edge of graph.edges){
    if(centerIds.has(edge.target)&&!centerIds.has(edge.source)) {inbound.add(edge.source);affinities.set(edge.source,[...(affinities.get(edge.source)??[]),order.get(edge.target)!]);}
    if(centerIds.has(edge.source)&&!centerIds.has(edge.target)){outbound.add(edge.target);affinities.set(edge.target,[...(affinities.get(edge.target)??[]),order.get(edge.source)!]);}
  }
  const centerWidth=Math.max(...center.map(n=>(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).width));
  const left=graph.nodes.filter(n=>inbound.has(n.id)&&!centerIds.has(n.id));
  const right=graph.nodes.filter(n=>outbound.has(n.id)&&!centerIds.has(n.id)&&!inbound.has(n.id));
  const placed=new Set([...centerIds,...left.map(n=>n.id),...right.map(n=>n.id)]);
  const others=graph.nodes.filter(n=>!placed.has(n.id)).sort(SOURCE_ORDER);
  const leftWidth=Math.max(300,...left.map(n=>(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).width));
  const centerX=leftWidth+178;
  const rightX=centerX+centerWidth+190;
  const otherX=rightX+Math.max(300,...right.map(n=>(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).width))+210;
  const positions:Record<string,XY>={};
  let centerY=72;
  for(const node of center){positions[node.id]={x:centerX,y:centerY};centerY+=(measured.get(node.id)??nodeSize(node,state,counts,blamed.has(node.id))).height+68;}
  const centerYForOrder=(index:number)=>positions[center[index].id].y;
  function rank(nodes:GraphNode[]){
    return [...nodes].sort((a,b)=>{
      const av=affinities.get(a.id),bv=affinities.get(b.id);
      const ac=av?.length ? av.reduce((x,y)=>x+y,0)/av.length : Infinity;
      const bc=bv?.length ? bv.reduce((x,y)=>x+y,0)/bv.length : Infinity;
      return (Number.isFinite(ac)?ac:Infinity)-(Number.isFinite(bc)?bc:Infinity)||SOURCE_ORDER(a,b);
    });
  }
  function stack(nodes:GraphNode[],x:number){
    let nextY=72;
    for(const n of rank(nodes)){
      const affinity=affinities.get(n.id);
      const wished=affinity?.length ? affinity.reduce((sum,i)=>sum+centerYForOrder(i),0)/affinity.length : nextY;
      const y=Math.max(nextY,wished);positions[n.id]={x,y};nextY=y+(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).height+54;
    }
  }
  stack(left,centerX-leftWidth-178);stack(right,rightX);
  let peripheralY=72;
  for(const n of others){positions[n.id]={x:otherX,y:peripheralY};peripheralY+=(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id))).height+48;}
  return positions;
}
function withManualPositions(positions:Record<string,XY>,state:CanvasState):Record<string,XY>{
  for(const [id,pos] of Object.entries(state.manualPositions)) if(id in positions) positions[id]={...pos};
  for(const [id,pos] of Object.entries(state.pinned)) if(id in positions) positions[id]={...pos};
  return positions;
}
/** Global ELK layout; focused mode uses constrained file lanes and barycentric neighbor ordering.
 * Source graph never mutates. Independent manual and pinned nodes always take precedence. */
export async function calculateLayout(graph:SourceGraph,state:CanvasState,counts:ReadonlyMap<string,number>=new Map(),blamed:ReadonlySet<string>=new Set(),measured:ReadonlyMap<string,NodeSize>=new Map()):Promise<Record<string,XY>> {
  if(!graph.nodes.length)return {};
  if(state.focusedFile)return withManualPositions(focusedLaneLayout(graph,state,counts,blamed,measured),state);
  const fallback=fallbackGrid(graph,state,counts,blamed,measured);
  // Real workers keep cyclic/large ELK jobs off the interaction thread.
  const engine=typeof window==='undefined'?elk:(await import('./layout/browserElk')).createBrowserElk();
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const work=engine.layout({
      id:'root',layoutOptions:{
        'elk.algorithm':'layered','elk.direction':'RIGHT','elk.edgeRouting':'ORTHOGONAL',
        'elk.spacing.nodeNode':'70','elk.layered.spacing.nodeNodeBetweenLayers':'130',
        'elk.spacing.edgeNode':'30','elk.spacing.edgeEdge':'20',
        'elk.layered.crossingMinimization.strategy':'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy':'BRANDES_KOEPF',
        'elk.layered.considerModelOrder.strategy':'NODES_AND_EDGES',
        'elk.padding':'[top=60,left=70,bottom=60,right=70]',
      },
      children:graph.nodes.map(n=>({id:n.id,...(measured.get(n.id)??nodeSize(n,state,counts,blamed.has(n.id)))})),
      edges:graph.edges.filter(e=>e.source!==e.target).map(e=>({id:e.id,sources:[e.source],targets:[e.target]})),
    });
    const result=await Promise.race([work,new Promise<never>((_resolve,reject)=>{
      timer=setTimeout(()=>reject(new Error('Layout exceeded interactive time budget')),10000);
    })]);
    for(const node of result.children??[]) if(Number.isFinite(node.x)&&Number.isFinite(node.y)) fallback[node.id]={x:node.x!,y:node.y!};
  }catch{
    // Source-ordered collision-free fallback; invalid or dense cyclic graphs remain navigable.
  }finally{
    if(timer)clearTimeout(timer);
    if(engine!==elk&&'terminateWorker' in engine)engine.terminateWorker();
  }
  return withManualPositions(fallback,state);
}
