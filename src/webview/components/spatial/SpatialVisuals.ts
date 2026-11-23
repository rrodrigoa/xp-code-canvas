/** V8.1 WebGL design system. True camera-facing THREE.Sprite UML cards, not
 * textured back-facing cubes. Source content and review flags come only from
 * the shared VisualizationProjection. Rendering is intentionally bounded. */
import * as THREE from 'three';
import type {VisualNode} from '../../../shared/visualizationProjection';
import type {GraphEdge} from '../../../shared/types';
import {nodeRole,NODE_COLOR_TOKEN,EDGE_COLOR_TOKEN,CHANGE_COLOR_TOKEN,edgeAppearance,spatialDetail} from '../../../shared/visualLanguage';
import {DEFAULT_SEMANTIC_ZOOM_STOPS,type SemanticZoomStops} from '../../../shared/semanticZoom';

export interface SpatialTheme {
  background:string; surface:string; surface2:string; text:string; muted:string; border:string; accent:string;
  roles:Record<string,string>; edges:Record<string,string>; changes:Record<string,string>;
}
const defaults={background:'#141820',surface:'#1d232d',surface2:'#25303d',text:'#d7deea',muted:'#9baabb',border:'#394553',accent:'#7baded'};
/** Read live CSS variable values from the same VS Code theme as 2D UML. */
export function spatialTheme(element?:HTMLElement|null):SpatialTheme{
  const style=typeof window==='undefined'?null:window.getComputedStyle(element??document.documentElement);
  const value=(token:string,fallback:string)=>{
    const v=style?.getPropertyValue(token).trim();return v&&!v.includes('var(')?v:fallback;
  };
  const roles:Record<string,string>={},edges:Record<string,string>={},changes:Record<string,string>={};
  const roleDefaults:Record<string,string>={module:'#b49cde',class:'#d7b46d',callable:'#83b4ee',data:'#79c5a2',external:'#8e9baa'};
  const edgeDefaults:Record<string,string>={imports:'#b292de',calls:'#659edc',creates:'#80bb8c',inherits:'#d9ac71',realizes:'#d9ac71',references:'#8996a7',contains:'#78889a'};
  const changeDefaults:Record<string,string>={ADDED:'#68bb85',MODIFIED:'#d6b56d',REMOVED:'#df777e',IMPACTED:'#76b7e8',AMBIGUOUS:'#d6ac67'};
  for(const [role,token] of Object.entries(NODE_COLOR_TOKEN))roles[role]=value(token,roleDefaults[role]);
  for(const [kind,token] of Object.entries(EDGE_COLOR_TOKEN))edges[kind]=value(token,edgeDefaults[kind]);
  for(const [status,token] of Object.entries(CHANGE_COLOR_TOKEN))changes[status]=value(token,changeDefaults[status]);
  return {background:value('--xp-surface-0',defaults.background),surface:value('--xp-surface-1',defaults.surface),surface2:value('--xp-surface-2',defaults.surface2),text:value('--xp-text',defaults.text),muted:value('--xp-muted',defaults.muted),border:value('--xp-border',defaults.border),accent:value('--xp-accent',defaults.accent),roles,edges,changes};
}
const canvas=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const rect=(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number,color:string)=>{
  ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();
};
function label(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,size:number,color:string,bold=false):void{
  ctx.font=`${bold?'650':'450'} ${size}px ${bold?'system-ui':'system-ui'}`;ctx.fillStyle=color;
  ctx.fillText(text,x,y,max);
}
function lines(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,color:string,n=2){
  const parts=text.split('\n');for(let i=0;i<Math.min(n,parts.length);i++)label(ctx,parts[i].slice(0,135),x,y+17*i,max,12,color);
}
function cardCanvas(v:VisualNode,tier:1|2|3,t:SpatialTheme):HTMLCanvasElement{
  const size=tier===1?{w:300,h:98}:tier===2?{w:370,h:214}:{w:420,h:274};
  const c=canvas(size.w*2,size.h*2),g=c.getContext('2d')!;g.scale(2,2);
  const {w,h}=size,n=v.symbol,status=v.reviewStatus,role=nodeRole(n.kind);
  const accent=t.roles[role]||t.accent,changed=status!=='UNCHANGED';
  rect(g,1,1,w-2,h-2,10,t.surface);
  g.strokeStyle=v.selected?t.accent:changed?t.changes[status]||t.border:t.border;
  g.lineWidth=v.selected?3:changed?2:1;
  if(n.stale||n.baselineOnly||n.confidence!=='resolved')g.setLineDash([6,4]);
  g.beginPath();g.roundRect(1,1,w-2,h-2,10);g.stroke();g.setLineDash([]);
  rect(g,2,2,w-4,5,3,accent);
  rect(g,12,16,32,32,7,t.surface2);label(g,n.kind==='class'?'C':n.kind==='module'?'M':n.kind==='property'?'P':n.kind==='external'?'?':'ƒ',21,38,24,18,accent,true);
  label(g,`«${n.stereotype??n.kind}»${n.async_?' · async':''}`,53,24,w-105,11,t.muted,true);
  label(g,n.name||n.module,53,44,w-105,16,t.text,true);
  const discussions=v.totalThreads??v.openThreads;
  if(discussions>0){rect(g,w-54,14,42,24,12,v.openThreads?t.changes.MODIFIED:t.muted);label(g,`◻ ${discussions}`,w-48,30,36,13,t.background,true);}
  if(changed){const statusColor=t.changes[status]||t.accent;rect(g,12,56,6,6,3,statusColor);label(g,status==='IMPACTED'?'Potential impact':status.toLowerCase(),24,63,w-35,11,statusColor,true);}
  else label(g,`${v.metrics.sourceLines} lines · ${v.metrics.degree} neighbors`,13,64,w-25,11,t.muted);
  if(tier>=2){
    g.strokeStyle=t.border;g.lineWidth=1;g.beginPath();g.moveTo(10,75);g.lineTo(w-10,75);g.stroke();
    if(n.kind==='class'){
      label(g,`ATTRIBUTES (${n.attributes.length})`,13,92,w-28,10,accent,true);
      lines(g,n.attributes.slice(0,2).map(a=>`  ${a.name}${a.type?': '+a.type:''}`).join('\n')||'  —',13,110,w-28,t.text,2);
      const operations=v.members?.filter(m=>m.kind==='method'||m.kind==='property').map(m=>m.signature||m.name)??n.operations;
      label(g,`OPERATIONS (${operations.length})`,13,141,w-28,10,accent,true);
      lines(g,operations.slice(0,tier===3?4:2).map(op=>`  ${op}`).join('\n')||'  —',13,160,w-28,t.text,tier===3?4:2);
      if(tier===3&&n.bases.length)label(g,`BASES · ${n.bases.join(', ')}`,13,238,w-28,11,t.muted);
    }else{
      label(g,'SIGNATURE',13,93,w-28,10,accent,true);
      lines(g,n.signature||n.qualifiedName,13,114,w-28,t.text,2);
      if(tier===3){label(g,'SOURCE STRUCTURE',13,159,w-28,10,accent,true);
        const regions=(n.anatomy??[]).slice(0,4);
        if(regions.length){
          const colors:Record<string,string>={branch:t.roles.callable,loop:t.roles.data,exception:t.changes.MODIFIED,
            context:t.roles.module,return:t.roles.class,raise:t.changes.REMOVED};
          regions.forEach((region,i)=>{
            rect(g,13,169+i*17,4,13,2,colors[region.kind]||accent);
            label(g,`${region.kind} · ${region.label} · L${region.range.startLine+1}`,25,180+i*17,w-40,11,t.text);
          });
        }else if(n.kind==='module'&&v.members?.length){
          lines(g,v.members.slice(0,4).map(m=>`${m.kind} · ${m.signature||m.name}`).join('\n'),13,179,w-28,t.text,4);
        }else if(n.source){
          lines(g,n.source.slice(0,600).split('\n').slice(0,4).join('\n'),13,179,w-28,t.muted,4);
        }else lines(g,n.docstring.slice(0,120)||'Inspect in editor for complete source',13,179,w-28,t.muted,3);
      }
    }
  }
  const bottom=tier===1?82:tier===2?198:258;
  g.fillStyle=t.surface2;g.fillRect(8,bottom-2,w-16,1);
  label(g,`${n.uri.split('/').pop()}  ·  L${n.range.startLine+1}${n.stale?' · stale':''}${n.baselineOnly?' · historical':''}`,13,bottom+11,w-28,10,t.muted);
  return c;
}
export interface CardSprite extends THREE.Sprite {userData:{symbolId:string;tier:number;zoom:number;appearance?:string};}
/** Default far sprites have NO CanvasTexture to keep 5,000-node views bounded. */
export function createCardSprite(v:VisualNode,t:SpatialTheme):CardSprite {
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({color:t.roles[nodeRole(v.symbol.kind)],transparent:true,opacity:v.dimmed?.24:.92,depthWrite:false}));
  sprite.scale.set(12,12,1);sprite.userData={symbolId:v.id,tier:0,zoom:0};
  return sprite as CardSprite;
}
export function setCardLOD(sprite:CardSprite,v:VisualNode,t:SpatialTheme,tier:0|1|2|3):boolean{
  const appearance=[v.selected,v.dimmed,v.reviewStatus,v.openThreads,v.totalThreads,v.symbol.contentHash,v.symbol.stale,v.symbol.baselineOnly].join(':');
  if(sprite.userData.tier===tier&&sprite.userData.appearance===appearance)return false;
  const material=sprite.material as THREE.SpriteMaterial;
  material.map?.dispose();material.map=null;material.color.set(t.roles[nodeRole(v.symbol.kind)]||t.accent);
  material.opacity=v.dimmed&&!v.selected?.24:1;material.depthWrite=false;material.transparent=true;
  if(tier===0){sprite.scale.set(v.selected?19:12,v.selected?19:12,1);material.needsUpdate=true;}
  else {const c=cardCanvas(v,tier,t);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
    material.map=texture;material.color.set('#ffffff');material.needsUpdate=true;
    const width=tier===1?77:tier===2?98:110,height=tier===1?25:tier===2?57:72;
    sprite.scale.set(width,height,1);
  }
  sprite.userData.tier=tier;sprite.userData.zoom=Number(v.selected);sprite.userData.appearance=appearance;return true;
}
export function disposeCard(sprite:THREE.Sprite){const mat=sprite.material as THREE.SpriteMaterial;mat.map?.dispose();mat.dispose();}
/** Budgeted per-node semantic LOD; selected cards always readable, remote nodes
 * collapse to colored front-facing tiles instead of allocating GPU textures. */
export function cardTier(distance:number,stops:SemanticZoomStops=DEFAULT_SEMANTIC_ZOOM_STOPS):0|1|2|3{
  return spatialDetail(distance,stops);
}
export function chooseCardTiers(nodes:readonly {id:string;x:number;y:number;z:number;v:VisualNode}[],camera:{x:number;y:number;z:number},
  stops:SemanticZoomStops=DEFAULT_SEMANTIC_ZOOM_STOPS,budget=260,byteBudget=32*1024*1024):Map<string,0|1|2|3>{
  const ranks=nodes.map(n=>({n,d:Math.hypot(n.x-camera.x,n.y-camera.y,n.z-camera.z)}));
  ranks.sort((a,b)=>Number(b.n.v.selected)-Number(a.n.v.selected)||a.d-b.d||a.n.id.localeCompare(b.n.id));
  const result=new Map<string,0|1|2|3>();let textured=0,bytes=0;
  const cost=(tier:number)=>tier===3?840*548*4*4/3:tier===2?740*428*4*4/3:600*196*4*4/3;
  for(const {n,d} of ranks){let tier=cardTier(d,stops);
    if(n.v.selected)tier=Math.max(2,tier) as 0|1|2|3;
    if(tier>0){
      while(tier>0&&!n.v.selected&&(textured>=budget||bytes+cost(tier)>byteBudget))tier--;
      if(tier>0){textured++;bytes+=cost(tier);}
    }
    result.set(n.id,tier);
  }return result;
}

export interface SpatialEdgeObject extends THREE.Group {
  userData:{start?:THREE.Vector3;end?:THREE.Vector3;segments:THREE.LineSegments;arrow:THREE.Object3D;badge?:THREE.Sprite};
}
function badgeSprite(count:number,t:SpatialTheme):THREE.Sprite {
  const c=canvas(86,42),g=c.getContext('2d')!;rect(g,1,1,84,40,19,t.changes.MODIFIED);label(g,`◻ ${count}`,14,28,64,22,t.background,true);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));s.scale.set(27,13,1);return s;
}
/** Custom Three.js line geometry avoids the 2D-only linkLineDash API. */
export function createSpatialEdge(edge:GraphEdge,selected:boolean,dimmed:boolean,t:SpatialTheme,reviewCount=0):SpatialEdgeObject {
  const style=edgeAppearance(edge,selected,dimmed);
  const color=t.changes[edge.change??'UNCHANGED']??t.changes.AMBIGUOUS;
  const ink=edge.change==='ADDED'||edge.change==='MODIFIED'||edge.change==='REMOVED'?color:edge.confidence!=='resolved'?t.changes.AMBIGUOUS:t.edges[edge.kind];
  const group=new THREE.Group() as SpatialEdgeObject;
  const geometry=new THREE.BufferGeometry();
  const segments=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:ink,transparent:true,opacity:style.opacity,depthWrite:false}));
  group.add(segments);
  let arrow:THREE.Object3D;
  if(style.marker==='hollow-triangle'){
    arrow=new THREE.Mesh(new THREE.ConeGeometry(3.3,9,3),new THREE.MeshBasicMaterial({color:ink,wireframe:true,transparent:true,opacity:style.opacity,depthWrite:false}));
  }else{
    const a=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-4,-4,0),new THREE.Vector3(0,0,0),new THREE.Vector3(4,-4,0)]);
    arrow=new THREE.Line(a,new THREE.LineBasicMaterial({color:ink,transparent:true,opacity:style.opacity,depthWrite:false}));
  }
  arrow.raycast=()=>{};group.add(arrow);
  const badge=reviewCount>0?badgeSprite(reviewCount,t):undefined;if(badge){badge.raycast=()=>{};group.add(badge);}
  group.userData={segments,arrow,badge};return group;
}
export function updateSpatialEdge(obj:THREE.Object3D,points:{start:{x:number;y:number;z:number};end:{x:number;y:number;z:number}},
  relation:GraphEdge,maxDashSegments=70):boolean{
  const o=obj as SpatialEdgeObject;const {segments,arrow,badge}=o.userData;
  if(!segments||!arrow||!points?.start||!points?.end)return false;
  const previousStart=o.userData.start,previousEnd=o.userData.end;
  if(previousStart&&previousEnd&&previousStart.x===points.start.x&&previousStart.y===points.start.y&&previousStart.z===points.start.z&&previousEnd.x===points.end.x&&previousEnd.y===points.end.y&&previousEnd.z===points.end.z)return true;
  const start=new THREE.Vector3(points.start.x,points.start.y,points.start.z),end=new THREE.Vector3(points.end.x,points.end.y,points.end.z);
  const difference=end.clone().sub(start),distance=difference.length();if(distance<.01)return true;
  const unit=difference.clone().normalize(),head=end.clone().addScaledVector(unit,-12);
  const span=head.distanceTo(start);const style=edgeAppearance(relation);
  const dash=style.dash*2.2,gap=style.gap*2.2;
  const coordinates:number[]=[];
  if(style.dashed){
    // Cap segment count for dense graphs; preserve visible gaps with rescaled periods.
    const total=Math.max(1,Math.min(maxDashSegments,Math.ceil(span/(dash+gap))));
    const segmentLen=span/total;const fraction=dash/(dash+gap);
    for(let i=0;i<total;i++){
      const a=start.clone().addScaledVector(unit,i*segmentLen),b=a.clone().addScaledVector(unit,segmentLen*fraction);
      coordinates.push(a.x,a.y,a.z,b.x,b.y,b.z);
    }
  }else coordinates.push(start.x,start.y,start.z,head.x,head.y,head.z);
  segments.geometry.dispose();segments.geometry=new THREE.BufferGeometry();
  segments.geometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));
  segments.geometry.computeBoundingSphere();
  arrow.position.copy(head);arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),unit);
  if(badge)badge.position.copy(start.clone().lerp(end,.52));
  o.userData.start=start;o.userData.end=end;return true;
}
export function disposeSpatialEdge(group:THREE.Object3D):void{
  group.traverse(child=>{
    if(child instanceof THREE.Line||child instanceof THREE.LineSegments||child instanceof THREE.Mesh){child.geometry.dispose();(child.material as THREE.Material).dispose();}
    if(child instanceof THREE.Sprite){const mat=child.material as THREE.SpriteMaterial;mat.map?.dispose();mat.dispose();}
  });
}
