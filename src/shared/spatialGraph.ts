/** Pure V8 spatial graph layout and metrics. No WebGL, React, AI, or Python execution.
 * All projections operate on SourceGraph evidence; coordinates never mutate source nodes.
 */
import type { GraphNode, SourceGraph } from './types';

export type SpatialLayoutKind = 'force' | 'hub' | 'folder' | 'dependency' | 'size' | 'class' | 'community' | 'review';
export type Vector3 = { x:number; y:number; z:number };
export type SpatialGraphPositions = Record<string,Vector3>;
export interface SpatialLayoutOptions { focusId?:string|null; focusedFile?:string|null; maxIterations?:number; pinned?:Readonly<Record<string,Vector3>>; }
export interface GraphMetrics { degree:number; inDegree:number; outDegree:number; weightedDegree:number; pagerank:number; sourceLines:number; folder:string; }
export const SPATIAL_LAYOUT_NAMES:Record<SpatialLayoutKind,string> = {
  force:'3D force-directed',hub:'Connectivity core',folder:'Folder constellations',
  dependency:'Dependency layers',size:'Code mass / periphery',
  class:'Class / module neighborhoods',community:'Connected communities',review:'Change / impact regions',
};
const PI=Math.PI;
const TAU=2*PI;
const safe=(v:number)=>Number.isFinite(v)?v:0;
const sorted=(nodes:readonly GraphNode[])=>[...nodes].sort((a,b)=>a.id.localeCompare(b.id));
const hash=(text:string)=>{let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;};
const between=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const norm=(p:Vector3)=>Math.hypot(p.x,p.y,p.z)||1;
const plus=(a:Vector3,b:Vector3):Vector3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale=(a:Vector3,s:number):Vector3=>({x:a.x*s,y:a.y*s,z:a.z*s});
const goldenAngle=PI*(3-Math.sqrt(5));
function spherePoint(index:number,total:number,phase=0):Vector3{
  const t=(index+.5)/Math.max(1,total),y=1-2*t,r=Math.sqrt(Math.max(0,1-y*y)),angle=goldenAngle*index+phase;
  return {x:Math.cos(angle)*r,y,z:Math.sin(angle)*r};
}
/** Folder grouping uses the source root to avoid collisions between independent workspaces.
 * Modules in the same directory share a spatial region; package/module node kinds don't change it.
 */
function safeDecode(value:string):string{try{return decodeURIComponent(value);}catch{return value;}}
export function folderOf(node:Pick<GraphNode,'root'|'uri'>):string{
  const raw=safeDecode(node.uri.replace(/\\/g,'/')).replace(/^file:\/\//,'');
  const root=safeDecode(node.root.replace(/\\/g,'/')).replace(/^file:\/\//,'').replace(/\/$/,'');
  const relative=raw.startsWith(root+'/')?raw.slice(root.length+1):raw;
  const pieces=relative.split('/').filter(Boolean);
  return `${root || '(workspace)'}/${pieces.slice(0,-1).join('/') || '(root)'}`;
}
export function graphMetrics(graph:SourceGraph):Map<string,GraphMetrics>{
  const nodes=sorted(graph.nodes),known=new Set(nodes.map(n=>n.id));
  const out=new Map(nodes.map(n=>[n.id,{degree:0,inDegree:0,outDegree:0,weightedDegree:0,pagerank:1/Math.max(1,nodes.length),
    sourceLines:Math.max(1,n.range.endLine-n.range.startLine+1),folder:folderOf(n)}] as [string,GraphMetrics]));
  const adjacency=new Map<string,Set<string>>(nodes.map(n=>[n.id,new Set<string>()]));
  const incoming=new Map<string,Set<string>>(nodes.map(n=>[n.id,new Set<string>()]));
  for(const e of graph.edges){if(!known.has(e.source)||!known.has(e.target))continue;
    const weight=between(e.count??1,1,20);
    out.get(e.source)!.outDegree++;out.get(e.target)!.inDegree++;
    out.get(e.source)!.weightedDegree+=weight;out.get(e.target)!.weightedDegree+=weight;
    adjacency.get(e.source)!.add(e.target);incoming.get(e.target)!.add(e.source);
  }
  const n=nodes.length;if(!n)return out;
  let ranks=new Map<string,number>(nodes.map(node=>[node.id,1/n]));
  // Weighted direction-aware PageRank; no convergence dependence on input ordering.
  for(let pass=0;pass<24;pass++){
    let dangling=0;for(const node of nodes)if(!adjacency.get(node.id)!.size)dangling+=ranks.get(node.id)!;
    const next=new Map<string,number>();
    for(const node of nodes){let value=(1-.85)/n+.85*dangling/n;
      for(const source of incoming.get(node.id)!){const degree=adjacency.get(source)!.size;if(degree)value+=.85*ranks.get(source)!/degree;}
      next.set(node.id,value);
    }ranks=next;
  }
  for(const node of nodes){const m=out.get(node.id)!;
    m.degree=new Set([...adjacency.get(node.id)!,...incoming.get(node.id)!]).size;
    m.pagerank=ranks.get(node.id)!;
  }
  return out;
}

function hubPositions(graph:SourceGraph,metrics:Map<string,GraphMetrics>,bySize=false):SpatialGraphPositions{
  const nodes=sorted(graph.nodes);const result:SpatialGraphPositions={};
  const order=[...nodes].sort((a,b)=>{
    const ma=metrics.get(a.id)!,mb=metrics.get(b.id)!;
    const wa=ma.pagerank*(nodes.length||1)*3+Math.log1p(ma.weightedDegree),wb=mb.pagerank*(nodes.length||1)*3+Math.log1p(mb.weightedDegree);
    return wb-wa||a.id.localeCompare(b.id);
  });
  const maximum=Math.max(1,...nodes.map(n=>metrics.get(n.id)!.sourceLines));
  for(let i=0;i<order.length;i++){
    const node=order[i],m=metrics.get(node.id)!;
    const sizeFactor=Math.log1p(m.sourceLines)/Math.log1p(maximum);
    // Most connected symbols occupy the core; size mode deliberately moves large code outward.
    const radial=bySize?95+500*sizeFactor+145*Math.sqrt(i/Math.max(1,order.length)):65+670*Math.sqrt(i/Math.max(1,order.length));
    const direction=spherePoint(i,order.length,(hash(node.id)%360)/57.296);
    result[node.id]=scale(direction,radial);
  }return result;
}
function folderPositions(graph:SourceGraph,metrics:Map<string,GraphMetrics>):SpatialGraphPositions{
  const groups=new Map<string,GraphNode[]>();
  for(const n of sorted(graph.nodes)){const key=metrics.get(n.id)!.folder;groups.set(key,[...(groups.get(key)??[]),n]);}
  const names=[...groups.keys()].sort(),out:SpatialGraphPositions={};
  for(let k=0;k<names.length;k++){
    const group=groups.get(names[k])!,center=scale(spherePoint(k,names.length),Math.max(250,390+names.length*16));
    const ranked=[...group].sort((a,b)=>metrics.get(b.id)!.weightedDegree-metrics.get(a.id)!.weightedDegree||a.id.localeCompare(b.id));
    const spread=Math.max(58,Math.min(240,40+28*Math.sqrt(group.length)));
    for(let i=0;i<ranked.length;i++){
      const direction=spherePoint(i,ranked.length,hash(names[k])%360);
      out[ranked[i].id]=plus(center,scale(direction,30+spread*Math.sqrt((i+.5)/ranked.length)));
    }
  }return out;
}
/** Generic stable groups for class, community and review partitions. Folder and
 * root remain canonical sources; no inferred module classification is written. */
function partitionPositions(graph:SourceGraph,groups:ReadonlyMap<string,string>,metrics:Map<string,GraphMetrics>):SpatialGraphPositions {
  const buckets=new Map<string,GraphNode[]>();
  for(const n of sorted(graph.nodes)){const key=groups.get(n.id)??'(other)';buckets.set(key,[...(buckets.get(key)??[]),n]);}
  const names=[...buckets.keys()].sort(),out:SpatialGraphPositions={};
  // Nonuniform region mass keeps large communities from overlapping neighbors.
  const largest=Math.max(1,...names.map(name=>buckets.get(name)!.length));
  const sceneRadius=390+Math.sqrt(names.length)*105+Math.sqrt(largest)*34;
  names.forEach((name,i)=>{
    const items=[...buckets.get(name)!].sort((a,b)=>metrics.get(b.id)!.weightedDegree-metrics.get(a.id)!.weightedDegree||a.id.localeCompare(b.id));
    const center=scale(spherePoint(i,names.length),sceneRadius);
    const spread=35+Math.sqrt(items.length)*36;
    items.forEach((n,j)=>{
      const direction=spherePoint(j,items.length,hash(name)/16384);
      out[n.id]=plus(center,scale(direction,(j?28:0)+spread*Math.sqrt((j+.5)/items.length)));
    });
  });
  return out;
}
/** Group methods/properties under their containing class, top-level functions under
 * their module, and standalone classes under their own name. */
export function classPartitions(graph:SourceGraph):Map<string,string>{
  const byId=new Map(graph.nodes.map(n=>[n.id,n])),out=new Map<string,string>();
  for(const n of sorted(graph.nodes)){
    let cur=n,group=n.moduleId||n.uri;const visited=new Set<string>();
    for(let i=0;i<16&&cur;i++){
      if(cur.kind==='class'){group=`class:${cur.id}`;break;}
      if(!cur.parentId||visited.has(cur.parentId))break;
      visited.add(cur.parentId);const next=byId.get(cur.parentId);if(!next)break;cur=next;
    }
    if(n.kind==='class')group=`class:${n.id}`;
    out.set(n.id,group);
  }return out;
}
/** Deterministic weighted label propagation. Communities are sourced exclusively
 * from existing graph edges; ties break lexicographically. O(iterations*(V+E)). */
export function communityPartitions(graph:SourceGraph,passes=8):Map<string,string>{
  const nodes=sorted(graph.nodes),ids=new Set(nodes.map(n=>n.id));
  const neighbors=new Map(nodes.map(n=>[n.id,new Map<string,number>()] as const));
  for(const e of graph.edges){if(e.source===e.target||!ids.has(e.source)||!ids.has(e.target))continue;
    const weight=Math.max(1,Math.min(10,e.count??1));
    neighbors.get(e.source)!.set(e.target,(neighbors.get(e.source)!.get(e.target)??0)+weight);
    neighbors.get(e.target)!.set(e.source,(neighbors.get(e.target)!.get(e.source)??0)+weight);
  }
  let labels=new Map(nodes.map(n=>[n.id,n.id] as const));
  for(let round=0;round<passes;round++){
    const next=new Map(labels);let changed=0;
    for(const n of nodes){const points=new Map<string,number>();
      for(const [other,weight] of neighbors.get(n.id)!){const label=labels.get(other)!;points.set(label,(points.get(label)??0)+weight);}
      if(!points.size)continue;
      // A small self vote stabilizes near-ties and prevents oscillation.
      points.set(labels.get(n.id)!, (points.get(labels.get(n.id)!)??0)+.3);
      const best=[...points].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
      if(best!==labels.get(n.id))changed++;
      next.set(n.id,best);
    }
    labels=next;if(!changed)break;
  }
  return new Map([...labels.entries()].map(([id,group])=>[id,`community:${group}`]));
}
/** Separate directly changed, potentially impacted and unchanged regions. Avoid
 * suggesting that a static impact candidate is proven runtime impact. */
export function reviewPartitions(graph:SourceGraph):Map<string,string>{
  return new Map(sorted(graph.nodes).map(n=>[n.id,
    n.change==='IMPACTED'?'2-potential-impact':
    n.change&&n.change!=='UNCHANGED'?`1-direct:${n.change}`:'3-unchanged-context']));
}
function dependencyPositions(graph:SourceGraph,focusId:string|null|undefined):SpatialGraphPositions{
  const nodes=sorted(graph.nodes),ids=new Set(nodes.map(n=>n.id));
  const outbound=new Map(nodes.map(n=>[n.id,[] as string[]] as const));
  const inbound=new Map(nodes.map(n=>[n.id,[] as string[]] as const));
  for(const e of graph.edges){if(!ids.has(e.source)||!ids.has(e.target))continue;outbound.get(e.source)!.push(e.target);inbound.get(e.target)!.push(e.source);}
  for(const a of [...outbound.values(),...inbound.values()])a.sort();
  const origin=focusId&&ids.has(focusId)?focusId:nodes[0]?.id;if(!origin)return {};
  const depth=new Map([[origin,0]]),queue=[origin];
  for(let q=0;q<queue.length;q++){
    const id=queue[q],d=depth.get(id)!;
    if(d>=7)continue;
    for(const next of outbound.get(id)??[])if(!depth.has(next)){depth.set(next,d+1);queue.push(next);}
    for(const next of inbound.get(id)??[])if(!depth.has(next)){depth.set(next,d+1);queue.push(next);}
  }
  const layers=new Map<number,string[]>();
  for(const n of nodes){const l=depth.get(n.id)??8;layers.set(l,[...(layers.get(l)??[]),n.id]);}
  const out:SpatialGraphPositions={};
  for(const [depth,items] of layers){const radius=depth?70+68*Math.sqrt(items.length):0;
    items.forEach((id,i)=>{const angle=TAU*i/items.length+(depth%2)*PI/4;
      out[id]={x:radius*Math.cos(angle),y:radius*Math.sin(angle),z:depth*180-240};
    });
  }return out;
}
function forcePositions(graph:SourceGraph,metrics:Map<string,GraphMetrics>,iterations:number):SpatialGraphPositions{
  const nodes=sorted(graph.nodes),n=nodes.length;
  const out=hubPositions(graph,metrics);if(n<=1)return out;
  // Bounded sampled repulsion (12 deterministic peers/node) avoids O(N^2) for large repos.
  // Spring forces follow actual source-backed edges, with a step-size cooling schedule.
  const linked=graph.edges.filter(e=>out[e.source]&&out[e.target]&&e.source!==e.target)
    .sort((a,b)=>a.id.localeCompare(b.id));
  const indices=nodes.map(node=>node.id);
  for(let round=0;round<iterations;round++){
    const forces=new Map(indices.map(id=>[id,{x:0,y:0,z:0}]));
    for(const edge of linked){const a=out[edge.source],b=out[edge.target],delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
      const d=norm(delta),strength=between((d-135)*.008,-3.5,3.5)*Math.min(3,Math.sqrt(edge.count??1));
      const f=scale(delta,strength/d);const fa=forces.get(edge.source)!,fb=forces.get(edge.target)!;
      fa.x+=f.x;fa.y+=f.y;fa.z+=f.z;fb.x-=f.x;fb.y-=f.y;fb.z-=f.z;
    }
    const pairs=Math.min(12,n-1);
    for(let i=0;i<n;i++){
      const id=indices[i],a=out[id],f=forces.get(id)!;
      for(let k=1;k<=pairs;k++){
        const j=(i+k*9973+round*13)%n;if(j===i)continue;
        const b=out[indices[j]],dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;
        const d2=Math.max(1800,dx*dx+dy*dy+dz*dz),mult=7000/(d2*Math.sqrt(d2));
        f.x+=dx*mult;f.y+=dy*mult;f.z+=dz*mult;
      }
    }
    const cooling=(1-round/Math.max(1,iterations))*.72;
    for(const id of indices){const v=out[id],f=forces.get(id)!;
      v.x+=between(f.x*.9-v.x*.0009,-16,16)*cooling;
      v.y+=between(f.y*.9-v.y*.0009,-16,16)*cooling;
      v.z+=between(f.z*.9-v.z*.0009,-16,16)*cooling;
    }
  }return out;
}
/** Stable coordinates sorted by symbol IDs, independent of graph input order.
 * Pin overrides are layout presentation only. Invalid positions are ignored.
 */
export function layoutSpatialGraph(graph:SourceGraph,kind:SpatialLayoutKind,options:SpatialLayoutOptions={}):SpatialGraphPositions{
  const metrics=graphMetrics(graph);
  const positions=kind==='folder'?folderPositions(graph,metrics):kind==='class'?partitionPositions(graph,classPartitions(graph),metrics)
    :kind==='community'?partitionPositions(graph,communityPartitions(graph),metrics)
    :kind==='review'?partitionPositions(graph,reviewPartitions(graph),metrics)
    :kind==='dependency'?dependencyPositions(graph,options.focusId)
    :kind==='size'?hubPositions(graph,metrics,true):kind==='force'?forcePositions(graph,metrics,between(options.maxIterations??32,1,80))
    :hubPositions(graph,metrics);
  for(const [id,p] of Object.entries(options.pinned??{}))if(positions[id]&&[p.x,p.y,p.z].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))positions[id]={x:safe(p.x),y:safe(p.y),z:safe(p.z)};
  return positions;
}
/** 2D folder/core layouts share the same graph organization with the spatial renderer.
 * Rendering owns card dimensions and collision correction after this projection.
 */
export function flattenSpatialLayout(graph:SourceGraph,kind:'folder'|'hub'|'class'|'community'|'review',scaleFactor=5):Record<string,{x:number;y:number}>{
  const points=layoutSpatialGraph(graph,kind);
  return Object.fromEntries(Object.entries(points).map(([id,p])=>[id,{x:p.x*scaleFactor,y:p.y*scaleFactor+p.z*scaleFactor*.33}]));
}
