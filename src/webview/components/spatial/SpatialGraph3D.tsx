/** 3D renderer adapter. Source facts, review overlays, navigation and layout are
 * supplied by shared contracts; this component never analyzes Python code.
 * WebGL is optional and lazily loaded only when the user selects 3D.
 */
import React,{useEffect,useMemo,useRef,useState,useCallback} from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import type {SpatialLayoutKind,Vector3} from '../../../shared/spatialGraph';
import {SPATIAL_LAYOUT_NAMES,layoutSpatialGraph,classPartitions,communityPartitions,reviewPartitions} from '../../../shared/spatialGraph';
import type {VisualizationProjection,VisualNode} from '../../../shared/visualizationProjection';
import type {GraphNode,GraphEdge,SourceCursor} from '../../../shared/types';
import {spatialSourceCursor} from './spatialSourceCursor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import {request} from '../../bridge';
import {useCanvasStore} from '../../store';
import {InlinePythonEditor} from '../InlinePythonEditor';
import {spatialTheme,createCardSprite,setCardLOD,disposeCard,chooseCardTiers,
  createSpatialEdge,updateSpatialEdge,disposeSpatialEdge,type CardSprite,type SpatialEdgeObject} from './SpatialVisuals';
import {DEFAULT_SEMANTIC_ZOOM_STOPS,type SemanticZoomStops} from '../../../shared/semanticZoom';
import './spatial.css';
import {SpatialEdgeBatch} from './SpatialEdgeBatch';
import {SpatialMarkerBatch} from './SpatialMarkerBatch';
import {pickSpatialGraph} from './spatialPicking';

type Graph3DHandle={
  cameraPosition:(position?:Vector3,lookAt?:Vector3,ms?:number)=>Vector3|void;
  zoomToFit:(ms?:number,padding?:number,filter?:(node:SpatialNode)=>boolean)=>void;
  camera:()=>THREE.Camera;
  scene:()=>THREE.Scene;
  renderer:()=>THREE.WebGLRenderer;
  controls:()=>{enabled?:boolean;addEventListener?:(event:string,cb:()=>void)=>void;removeEventListener?:(event:string,cb:()=>void)=>void;target?:THREE.Vector3;enableDamping?:boolean;dampingFactor?:number;minDistance?:number;maxDistance?:number};
};
type SpatialNode={id:string;x:number;y:number;z:number;fx?:number;fy?:number;fz?:number;v:VisualNode;};
type SpatialLink={id:string;source:string|SpatialNode;target:string|SpatialNode;relation:GraphEdge;selected:boolean;dimmed:boolean;openThreads:number;totalThreads?:number;};
const Graph3D=ForceGraph3D as unknown as React.ComponentType<Record<string,unknown>&{ref?:React.Ref<Graph3DHandle>}>;
// A THREE.Sprite is a true camera-facing billboard. No back-of-card surface exists.
const GLOW_RADIUS=12;
const htmlSafe=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const round=(n:number)=>Math.round(n*10)/10;
const validPoint=(v:unknown):v is Vector3=>Boolean(v&&typeof v==='object'&&['x','y','z'].every(k=>Number.isFinite((v as Record<string,unknown>)[k])&&Math.abs((v as Record<string,number>)[k])<=1e6));
const visibleStatus=(v:VisualNode)=>v.reviewStatus==='IMPACTED'?'Potential impact':v.reviewStatus==='UNCHANGED'?'Unchanged':v.reviewStatus.toLowerCase();
function useWebGLAvailable():boolean|null{
  const [available,setAvailable]=useState<boolean|null>(null);
  useEffect(()=>{
    try{const el=document.createElement('canvas');const gl=el.getContext('webgl2');
      setAvailable(Boolean(gl));gl?.getExtension('WEBGL_lose_context')?.loseContext();}
    catch{setAvailable(false);}
  },[]);
  return available;
}
/** Folder volumes are presentation-only Three.js scene children, not graph nodes.
 * Their geometries/materials are disposed whenever the layout changes.
 */
function partitionRegions(keys:ReadonlyMap<string,string>,nodes:readonly SpatialNode[],theme:ReturnType<typeof spatialTheme>):THREE.Group{
  const group=new THREE.Group();group.name='xp-spatial-partition-regions';
  const buckets=new Map<string,SpatialNode[]>();
  for(const n of nodes){const key=keys.get(n.id)??'(other)';buckets.set(key,[...(buckets.get(key)??[]),n]);}
  for(const [folder,members] of [...buckets.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,80)){if(members.length<2)continue;
    const center=members.reduce((s,n)=>({x:s.x+n.x/members.length,y:s.y+n.y/members.length,z:s.z+n.z/members.length}),{x:0,y:0,z:0});
    const radius=Math.max(48,...members.map(n=>Math.hypot(n.x-center.x,n.y-center.y,n.z-center.z)+GLOW_RADIUS+12));
    const direct=members.filter(n=>!['UNCHANGED','IMPACTED'].includes(n.v.reviewStatus)).length;
    const impacted=members.filter(n=>n.v.reviewStatus==='IMPACTED').length;
    const geometry=new THREE.SphereGeometry(radius,16,12);
    const material=new THREE.MeshBasicMaterial({color:direct?theme.changes.ADDED:impacted?theme.changes.IMPACTED:theme.accent,transparent:true,opacity:direct?0.20:0.10,side:THREE.BackSide,depthWrite:false,wireframe:true});
    const shell=new THREE.Mesh(geometry,material);shell.position.set(center.x,center.y,center.z);
    shell.raycast=()=>{};group.add(shell);
    // Keep per-folder labels crisp without injecting HTML into WebGL tooltips.
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=72;
    const ctx=canvas.getContext('2d');if(!ctx)continue;
    ctx.fillStyle=theme.surface;ctx.fillRect(0,0,512,72);
    ctx.fillStyle=theme.text;ctx.font='25px system-ui';
    const label=folder.split('/').slice(-2).join('/')||'workspace';
    const caption=direct?`${direct} directly changed` : impacted?`${impacted} potentially affected`:'unchanged context';
    ctx.fillText(`${label.slice(0,18)} · ${caption}`.slice(0,37),17,45);
    const texture=new THREE.CanvasTexture(canvas);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true}));
    sprite.scale.set(135,19,1);sprite.position.set(center.x,center.y+radius+19,center.z);sprite.raycast=()=>{};group.add(sprite);
  }
  return group;
}
function releaseFolderRegions(group:THREE.Group):void{
  group.traverse(child=>{
    if(child instanceof THREE.Mesh){child.geometry.dispose();(child.material as THREE.Material).dispose();}
    if(child instanceof THREE.Sprite){const mat=child.material as THREE.SpriteMaterial;mat.map?.dispose();mat.dispose();}
  });
}
function SpatialSelection({node,compareActive,readOnly,onFocus,onDismiss,onReview,openThreads}: {
  node:GraphNode;compareActive:boolean;readOnly:boolean;onFocus:()=>void;onDismiss:()=>void;
  onReview:()=>void;openThreads:number;
}){
  const preview=useCanvasStore(s=>s.previews[node.id]),draft=useCanvasStore(s=>s.inlineDrafts[node.id]),editResult=useCanvasStore(s=>s.inlineEditResults[node.id]);
  const setDraft=useCanvasStore(s=>s.setInlineDraft),clearDraft=useCanvasStore(s=>s.clearInlineDraft);
  const reviewScope=useCanvasStore(s=>s.review?.scope);
  const editable=!readOnly&&(!reviewScope||reviewScope==='working'||reviewScope==='unstaged');
  const [editing,setEditing]=useState(false),[cursor,setCursor]=useState<SourceCursor|null>(null);
  const sourceRef=useRef<HTMLPreElement|null>(null);
  const captureCursor=()=>setCursor(sourceRef.current?spatialSourceCursor(sourceRef.current,window.getSelection(),node.range.startLine,node.range.startCharacter)??null:null);
  useEffect(()=>{if(!node.baselineOnly&&!readOnly)request({type:'getSourcePreview',nodeId:node.id,requestId:`3d:${node.id}:${node.version}`,expectedHash:node.contentHash??''});},[node.id,node.version,node.contentHash,node.baselineOnly,readOnly]);
  useEffect(()=>{setEditing(false);setCursor(null);},[node.id]);
  const hasCurrentSource=Boolean(preview?.source&&!preview.stale&&!preview.truncated&&!node.stale&&!node.baselineOnly);
  return <aside className="spatial-inspector" role="region" aria-label={`3D selected symbol ${node.qualifiedName}`} data-testid="spatial-inspector">
    <header><span className="spatial-eyebrow">SELECTED SYMBOL</span><button aria-label="Close 3D symbol inspector" onClick={onDismiss}><i aria-hidden="true" className="codicon codicon-close"/></button></header>
    <h2>{node.qualifiedName}</h2><p>{node.kind} · {node.uri.split('/').pop()} · L{node.range.startLine+1}–{node.range.endLine+1}</p>
    {node.signature&&<code className="spatial-signature">{node.signature}</code>}
    <div className="spatial-actions">
      <button onClick={onFocus}><i aria-hidden="true" className="codicon codicon-target"/> Center camera</button>
      <button title={cursor?`Open editor at L${cursor.line+1}:${cursor.character+1}`:'Open editor at symbol start'} onClick={()=>request({type:'openNode',nodeId:node.id,...(!readOnly&&cursor?{cursor}:{})})}><i aria-hidden="true" className="codicon codicon-go-to-file"/> {cursor?`Edit L${cursor.line+1}`:'Open editor'}</button>
      <button onClick={()=>request({type:'getGitBlame',nodeId:node.id})}><i aria-hidden="true" className="codicon codicon-git-commit"/> Blame</button>
      <button onClick={onReview} title="Open graph review discussions" disabled={!compareActive}><i aria-hidden="true" className="codicon codicon-comment-discussion"/> Discuss {openThreads?`(${openThreads})`:''}</button>
      <button disabled={!hasCurrentSource||!editable} title={!editable?'Historical review source is read-only':'Edit current Python source'} onClick={()=>setEditing(v=>!v)}><i aria-hidden="true" className="codicon codicon-edit"/> {editing?'Show source':'Edit inline'}</button>
    </div>
    {compareActive&&<p className="spatial-note">Changed symbols retain their Git state. Faded symbols are context, not proven safe or unaffected.</p>}
    {editing&&hasCurrentSource&&editable?
      <InlinePythonEditor nodeId={node.id} initialSource={preview!.source!} hash={node.contentHash??''} startLine={node.range.startLine} startCharacter={node.range.startCharacter}
        initialDraft={draft} onDraftChange={text=>setDraft(node.id,{originalSource:draft?.originalSource??preview!.source!,updatedSource:text,expectedHash:draft?.expectedHash??node.contentHash??''})}
        result={editResult} onClose={()=>{clearDraft(node.id);setEditing(false);}}/>
    :<pre ref={sourceRef} className="spatial-source nowheel" tabIndex={0} aria-label="Selectable Python source preview" onMouseUp={captureCursor} onKeyUp={captureCursor}><code dangerouslySetInnerHTML={{__html:Prism.highlight(readOnly?'Historical review frame — use the review diff to inspect source at that revision.':preview?.source??(node.baselineOnly?'Historical symbol · open review diff for source':'Select a node to load its current source'),Prism.languages.python,'python')}}/></pre>}
  </aside>;
}

export interface SpatialGraph3DProps {
  projection:VisualizationProjection; layout:SpatialLayoutKind; onLayout:(kind:SpatialLayoutKind)=>void;
  onSelect:(id:string)=>void; onEdge:(id:string)=>void; onDismiss:()=>void;
  focusedFile:string|null; selectedId:string|null; readOnly:boolean; comparison:boolean;
  showDetails:boolean; semanticZoomStops?:SemanticZoomStops;onReviewNode:(id:string)=>void; fitEpoch:number; positions?:Record<string,Vector3>; onPosition:(id:string,position:Vector3)=>void;
  camera?:{position:Vector3;target:Vector3};onCamera:(position:Vector3,target:Vector3)=>void;
}
export function SpatialGraph3D(props:SpatialGraph3DProps){
  const {projection,layout,onLayout,focusedFile,selectedId,positions={},onPosition}=props;
  const available=useWebGLAvailable();
  const [contextLost,setContextLost]=useState(false);
  const ref=useRef<Graph3DHandle|null>(null),rootRef=useRef<HTMLDivElement|null>(null);
  const [size,setSize]=useState({width:900,height:640});
  const [hover,setHover]=useState<string|null>(null),[folder,setFolder]=useState('all');
  const [labels,setLabels]=useState(true);
  const [themeEpoch,setThemeEpoch]=useState(0);
  const theme=useMemo(()=>spatialTheme(rootRef.current),[themeEpoch]);
  const spriteRefs=useRef(new Map<string,CardSprite>());
  const edgeRefs=useRef(new Map<string,SpatialEdgeObject>());
  const edgeBatch=useRef<SpatialEdgeBatch|null>(null),batchFrame=useRef<number|null>(null);
  const markerBatch=useRef<SpatialMarkerBatch|null>(null);
  const scheduleEdgeBatch=useCallback(()=>{
    if(batchFrame.current!==null)return;
    batchFrame.current=requestAnimationFrame(()=>{
      batchFrame.current=null;const fg=ref.current;if(!fg)return;
      if(!edgeBatch.current)edgeBatch.current=new SpatialEdgeBatch();
      if(edgeBatch.current.parent!==fg.scene())fg.scene().add(edgeBatch.current);
      edgeBatch.current.rebuild(edgeRefs.current.values());
    });
  },[]);
  const spatialRef=useRef<SpatialNode[]>([]);
  const stops=props.semanticZoomStops??DEFAULT_SEMANTIC_ZOOM_STOPS;
  const stopsRef=useRef(stops);stopsRef.current=stops;
  useEffect(()=>{const observer=new MutationObserver(()=>setThemeEpoch(v=>v+1));
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['class','style']});
    observer.observe(document.body,{attributes:true,attributeFilter:['class','style']});
    return ()=>observer.disconnect();},[]);
  const cameraSaved=useRef(props.camera),onCameraRef=useRef(props.onCamera);
  useEffect(()=>{cameraSaved.current=props.camera;},[props.camera]);
  useEffect(()=>{onCameraRef.current=props.onCamera;},[props.onCamera]);
  useEffect(()=>{
    const element=rootRef.current;if(!element)return;
    const observer=new ResizeObserver(entries=>{const rect=entries[0]?.contentRect;if(rect)setSize({width:Math.max(320,rect.width),height:Math.max(240,rect.height)});});
    observer.observe(element);return ()=>observer.disconnect();
  },[]);
  const visible=useMemo(()=>projection.nodes.filter(n=>n.visible&&(folder==='all'||n.folder===folder)),[projection,folder]);
  const visibleIds=useMemo(()=>new Set(visible.map(n=>n.id)),[visible]);
  const visibilityKey=JSON.stringify([...visibleIds]);
  const graph=useMemo(()=>({...projection.graph,nodes:visible.map(v=>v.symbol),
    edges:projection.edges.filter(e=>e.visible&&visibleIds.has(e.relation.source)&&visibleIds.has(e.relation.target)).map(e=>e.relation)}),[projection.graph,visibilityKey,projection.edges.map(e=>`${e.id}:${e.visible}`).join('|')]);
  const layoutFocus=layout==='dependency'?selectedId:null;
  const calculated=useMemo(()=>layoutSpatialGraph(graph,layout,{focusId:layoutFocus,focusedFile,pinned:positions}),[graph,layout,layoutFocus,focusedFile,positions]);
  const spatialData=useMemo(()=>({nodes:visible.map(v=>({...calculated[v.id],id:v.id,fx:undefined,fy:undefined,fz:undefined,v})),
    links:projection.edges.filter(e=>e.visible&&visibleIds.has(e.relation.source)&&visibleIds.has(e.relation.target)).map(e=>({
      id:e.id,source:e.relation.source,target:e.relation.target,relation:e.relation,selected:e.selected,dimmed:e.dimmed,openThreads:e.openThreads,totalThreads:e.totalThreads,
    }))}),[graph,calculated]);
  const visualById=new Map(visible.map(v=>[v.id,v]));
  for(const n of spatialData.nodes)n.v=visualById.get(n.id)!;
  const edgeVisualById=new Map(projection.edges.map(e=>[e.id,e]));
  for(const link of spatialData.links){const v=edgeVisualById.get(link.id);if(v)Object.assign(link,{relation:v.relation,selected:v.selected,dimmed:v.dimmed,openThreads:v.openThreads,totalThreads:v.totalThreads});}
  const edgeDecorationKey=spatialData.links.map(l=>`${l.id}:${l.selected}:${l.dimmed}:${l.openThreads}:${l.totalThreads}:${l.relation.change}`).join('|');
  const dashBudget=spatialData.links.length>10000?3:spatialData.links.length>2000?6:spatialData.links.length>600?12:70;
  spatialRef.current=spatialData.nodes;
  // Dispose stale graph objects by stable ID, and release everything on unmount.
  useEffect(()=>{
    const ids=new Set(spatialData.nodes.map(n=>n.id)),links=new Set(spatialData.links.map(l=>l.id));
    for(const [id,sprite] of spriteRefs.current){if(!ids.has(id)){disposeCard(sprite);spriteRefs.current.delete(id);}}
    for(const [id,edge] of edgeRefs.current){if(!links.has(id)){disposeSpatialEdge(edge);edgeRefs.current.delete(id);}}
    scheduleEdgeBatch();
  },[spatialData]);
  useEffect(()=>()=>{
    if(batchFrame.current!==null)cancelAnimationFrame(batchFrame.current);
    batchFrame.current=null;
    edgeBatch.current?.removeFromParent();edgeBatch.current?.release();edgeBatch.current=null;
    markerBatch.current?.release();markerBatch.current=null;
    for(const sprite of spriteRefs.current.values())disposeCard(sprite);spriteRefs.current.clear();
    for(const edge of edgeRefs.current.values())disposeSpatialEdge(edge);edgeRefs.current.clear();
  },[]);
  const partitionKeys=useMemo(()=>{
    if(layout==='folder'){const folderById=new Map(visible.map(v=>[v.id,v.folder]));return new Map<string,string>(graph.nodes.map(n=>[n.id,folderById.get(n.id)??'(root)'] as [string,string]));}
    if(layout==='class')return classPartitions(graph);
    if(layout==='community')return communityPartitions(graph);
    if(layout==='review')return reviewPartitions(graph);
    return new Map<string,string>();
  },[graph,layout,visible]);
  useEffect(()=>{
    if(!['folder','class','community','review'].includes(layout)||!available)return;
    let cancelled=false,added:THREE.Group|null=null;
    const frame=requestAnimationFrame(()=>{
      if(cancelled||!ref.current)return;
      added=partitionRegions(partitionKeys,spatialData.nodes,theme);
      ref.current.scene().add(added);
    });
    return ()=>{cancelled=true;cancelAnimationFrame(frame);if(added){ref.current?.scene().remove(added);releaseFolderRegions(added);}};
  },[layout,available,partitionKeys,spatialData.nodes,theme]);
  // Forcegraph mutates x/y/z and link endpoints in its own graphData, never SourceGraph.
  useEffect(()=>{
    const fg=ref.current;if(!fg)return;
    const snapshot=cameraSaved.current;
    if(snapshot)fg.cameraPosition(snapshot.position,snapshot.target,0);
    else fg.zoomToFit(500,90);
  },[layout,folder,available,themeEpoch]);
  useEffect(()=>{if(props.fitEpoch>0)ref.current?.zoomToFit(400,90);},[props.fitEpoch]);
  const persistCamera=useCallback(()=>{
    const fg=ref.current; if(!fg)return;
    try{const camera=fg.camera();const p=camera.position;const t=fg.controls().target;
      if(t)onCameraRef.current({x:p.x,y:p.y,z:p.z},{x:t.x,y:t.y,z:t.z});}
    catch{ /* stale graph / context loss: camera persistence is best-effort */ }
  },[]);
  const refreshCardLOD=useCallback(()=>{
    const camera=ref.current?.camera();if(!camera)return;
    const tiers=chooseCardTiers(spatialRef.current,camera.position,stopsRef.current,260);
    for(const node of spatialRef.current){const sprite=spriteRefs.current.get(node.id);
      if(sprite)setCardLOD(sprite,node.v,theme,tiers.get(node.id)??0);
    }
    if(!markerBatch.current)markerBatch.current=new SpatialMarkerBatch();
    if(markerBatch.current.parent!==ref.current?.scene())ref.current?.scene().add(markerBatch.current);
    markerBatch.current.rebuild(spatialRef.current,spriteRefs.current,theme);
    const renderer=ref.current?.renderer(),info=renderer?.info;
    if(rootRef.current&&info&&renderer){
      rootRef.current.dataset.gpuTextures=String(info.memory.textures);rootRef.current.dataset.gpuGeometries=String(info.memory.geometries);rootRef.current.dataset.drawCalls=String(info.render.calls);rootRef.current.dataset.renderedNodes=String(spatialRef.current.length);
      const gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
      rootRef.current.dataset.gpuRenderer=String(gl.getParameter(debug?debug.UNMASKED_RENDERER_WEBGL:gl.RENDERER));
      const textures=new Map<string,THREE.Texture>();
      ref.current?.scene().traverse(object=>{const material=(object as THREE.Sprite).material as THREE.SpriteMaterial|undefined;if(material?.map)textures.set(material.map.uuid,material.map);});
      rootRef.current.dataset.estimatedTextureBytes=String([...textures.values()].reduce((sum,t)=>{const image=t.image as {width?:number;height?:number}|undefined;return sum+(image?.width??0)*(image?.height??0)*4*(t.generateMipmaps?4/3:1);},0));
    }
  },[theme]);
  useEffect(()=>{
    const canvas=ref.current?.renderer().domElement;if(!canvas)return;
    const lost=(event:Event)=>{event.preventDefault();setContextLost(true);};
    canvas.addEventListener('webglcontextlost',lost);
    return ()=>canvas.removeEventListener('webglcontextlost',lost);
  },[available,themeEpoch]);
  useEffect(()=>{const fg=ref.current;if(!fg)return;
    let lodTimer:ReturnType<typeof setTimeout>|undefined,persistTimer:ReturnType<typeof setTimeout>|undefined;
    const controls=fg.controls();controls.enableDamping=true;controls.dampingFactor=.11;
    controls.minDistance=24;controls.maxDistance=12000;
    const changed=()=>{
      if(lodTimer)clearTimeout(lodTimer);lodTimer=setTimeout(refreshCardLOD,100);
      if(persistTimer)clearTimeout(persistTimer);persistTimer=setTimeout(persistCamera,600);
    };
    controls.addEventListener?.('change',changed);requestAnimationFrame(refreshCardLOD);
    return ()=>{controls.removeEventListener?.('change',changed);
      if(lodTimer)clearTimeout(lodTimer);if(persistTimer)clearTimeout(persistTimer);persistCamera();};
  },[persistCamera,refreshCardLOD,available,spatialData,themeEpoch]);
  useEffect(()=>{
    refreshCardLOD();const timer=setTimeout(refreshCardLOD,180);
    return ()=>clearTimeout(timer);
  },[refreshCardLOD,spatialData,stops,projection]);
  const centerOn=useCallback((id:string)=>{
    const n=spatialData.nodes.find(n=>n.id===id);if(!n||!ref.current)return;
    const camera=ref.current.camera(),target=new THREE.Vector3(n.x,n.y,n.z);
    const direction=camera.position.clone().sub(ref.current.controls().target??new THREE.Vector3()).normalize();
    if(direction.length()<.01)direction.set(0,0,1);
    const distance=130;
    ref.current.cameraPosition({x:n.x+direction.x*distance,y:n.y+direction.y*distance,z:n.z+direction.z*distance},{x:target.x,y:target.y,z:target.z},550);
  },[spatialData]);
  useEffect(()=>{if(available&&selectedId&&spatialData.nodes.some(n=>n.id===selectedId))centerOn(selectedId);},[selectedId,available]);
  const selected=projection.nodes.find(n=>n.id===selectedId)?.symbol;
  const nodeFactory=useCallback((node:SpatialNode)=>{
    const existing=spriteRefs.current.get(node.id);if(existing)disposeCard(existing);
    const sprite=createCardSprite(node.v,theme);
    spriteRefs.current.set(node.id,sprite);
    return sprite;
  },[theme]);
  const edgeFactory=useCallback((link:SpatialLink)=>{
    const existing=edgeRefs.current.get(link.id);if(existing)disposeSpatialEdge(existing);
    const group=createSpatialEdge(link.relation,link.selected,link.dimmed,theme,link.totalThreads??link.openThreads);
    edgeRefs.current.set(link.id,group);return group;
  },[theme,edgeDecorationKey]);
  const focusDirection=useCallback((direction:THREE.Vector3)=>{
    const fg=ref.current;if(!fg)return;
    const camera=fg.camera();const target=fg.controls().target??new THREE.Vector3();
    const currentDistance=camera.position.distanceTo(target);
    const p=target.clone().addScaledVector(direction.normalize(),Math.max(80,currentDistance));
    fg.cameraPosition({x:p.x,y:p.y,z:p.z},{x:target.x,y:target.y,z:target.z},450);
  },[]);
  const dolly=useCallback((scale:number)=>{
    const fg=ref.current;if(!fg)return;const camera=fg.camera(),target=fg.controls().target??new THREE.Vector3();
    const delta=camera.position.clone().sub(target).multiplyScalar(scale);
    delta.clampLength(24,12000);
    const position=target.clone().add(delta);
    fg.cameraPosition({x:position.x,y:position.y,z:position.z},{x:target.x,y:target.y,z:target.z},220);
  },[]);
  const onWheelCapture=useCallback((event:React.WheelEvent<HTMLDivElement>)=>{
    // OrbitControls owns the wheel: users expect ordinary scroll to zoom in 3D.
    // Source inspectors and controls retain native scrolling behavior.
    if((event.target as HTMLElement).closest('.spatial-inspector,.spatial-controls'))event.stopPropagation();
  },[]);
  const drag=useRef<{node:SpatialNode;plane:THREE.Plane;startX:number;startY:number;moved:boolean}|null>(null);
  const pointerStart=useRef<{x:number;y:number}|null>(null);
  const pointer=(event:React.PointerEvent<HTMLDivElement>)=>{
    const canvas=ref.current?.renderer().domElement;if(!canvas||event.target!==canvas)return null;
    const rect=canvas.getBoundingClientRect();return {canvas,x:event.clientX-rect.left,y:event.clientY-rect.top,width:rect.width,height:rect.height};
  };
  const pick=(p:{x:number;y:number;width:number;height:number})=>pickSpatialGraph(p.x,p.y,p.width,p.height,ref.current!.camera(),spatialData.nodes,spatialData.links,id=>spriteRefs.current.get(id)?.scale);
  const onPointerDownCapture=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(spatialData.nodes.length<=300||event.button!==0)return;
    const p=pointer(event);if(!p)return;pointerStart.current={x:p.x,y:p.y};
    const hit=pick(p),node=spatialData.nodes.find(n=>n.id===hit.nodeId);if(!node)return;
    const camera=ref.current!.camera();drag.current={node,plane:new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),new THREE.Vector3(node.x,node.y,node.z)),startX:p.x,startY:p.y,moved:false};
    ref.current!.controls().enabled=false;p.canvas.setPointerCapture(event.pointerId);event.stopPropagation();event.nativeEvent.stopImmediatePropagation();
  };
  const onPointerMoveCapture=(event:React.PointerEvent<HTMLDivElement>)=>{
    const active=drag.current,p=pointer(event);if(!active||!p)return;
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x/p.width*2-1,1-p.y/p.height*2),ref.current!.camera());
    const position=ray.ray.intersectPlane(active.plane,new THREE.Vector3());if(!position)return;
    active.moved||=Math.hypot(p.x-active.startX,p.y-active.startY)>3;
    Object.assign(active.node,{x:position.x,y:position.y,z:position.z});spriteRefs.current.get(active.node.id)?.position.copy(position);
    for(const link of spatialData.links){const a=typeof link.source==='string'?spatialData.nodes.find(n=>n.id===link.source):link.source,b=typeof link.target==='string'?spatialData.nodes.find(n=>n.id===link.target):link.target;
      if(a&&b&&(a.id===active.node.id||b.id===active.node.id)){const object=edgeRefs.current.get(link.id);if(object)updateSpatialEdge(object,{start:a,end:b},link.relation,dashBudget);}}
    scheduleEdgeBatch();event.stopPropagation();event.nativeEvent.stopImmediatePropagation();
  };
  const onPointerUpCapture=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(spatialData.nodes.length<=300||event.button!==0)return;
    const p=pointer(event);if(!p)return;const active=drag.current;drag.current=null;
    if(active){ref.current!.controls().enabled=true;p.canvas.releasePointerCapture(event.pointerId);
      if(active.moved)onPosition(active.node.id,{x:round(active.node.x),y:round(active.node.y),z:round(active.node.z)});else props.onSelect(active.node.id);
      event.stopPropagation();event.nativeEvent.stopImmediatePropagation();
    }else if(pointerStart.current&&Math.hypot(p.x-pointerStart.current.x,p.y-pointerStart.current.y)<4){const hit=pick(p);if(hit.nodeId)props.onSelect(hit.nodeId);else if(hit.edgeId)props.onEdge(hit.edgeId);else props.onDismiss();}
    pointerStart.current=null;
  };
  return <div className="spatial-root" ref={rootRef} data-testid="spatial-3d" aria-label="Interactive three-dimensional UML graph" onWheelCapture={onWheelCapture}
    onPointerDownCapture={onPointerDownCapture} onPointerMoveCapture={onPointerMoveCapture} onPointerUpCapture={onPointerUpCapture} onPointerCancelCapture={()=>{drag.current=null;pointerStart.current=null;if(ref.current)ref.current.controls().enabled=true;}}>
    {available===null?<div className="spatial-fallback" role="status">Checking WebGL support…</div>:!available||contextLost?<div className="spatial-fallback" role="status"><h2>3D rendering is unavailable</h2><p>WebGL is disabled or its context was lost. The complete 2D UML and reviews remain available. Switch to UML above.</p></div>:
      <Graph3D key={`theme-${themeEpoch}`} ref={ref} width={size.width} height={size.height} graphData={spatialData}
        controlType="orbit" backgroundColor={theme.background} enableNodeDrag enablePointerInteraction={spatialData.nodes.length<=300}
        d3AlphaDecay={1} cooldownTicks={0} warmupTicks={0} nodeThreeObject={nodeFactory}
        nodeLabel={(node:SpatialNode)=>`<div class="spatial-tip"><strong>${htmlSafe(node.v.symbol.qualifiedName)}</strong><small>${htmlSafe(node.v.folder)}</small><small>${htmlSafe(visibleStatus(node.v))} · ${node.v.metrics.sourceLines} lines · ${node.v.metrics.degree} neighbors · ${node.v.openThreads} open threads</small></div>`}
        linkLabel={(link:SpatialLink)=>`${htmlSafe(link.relation.kind)} · ${link.relation.count??1} static references · ${htmlSafe(link.relation.confidence)}${link.openThreads?' · '+link.openThreads+' open threads':''}`}
        linkThreeObject={edgeFactory} linkThreeObjectExtend={false}
        linkPositionUpdate={(obj:THREE.Object3D,points:{start:Vector3;end:Vector3},link:SpatialLink)=>{
          const previous=(obj as SpatialEdgeObject).userData.start;
          const unchanged=previous?.x===points.start.x&&previous?.y===points.start.y&&previous?.z===points.start.z&&
            (obj as SpatialEdgeObject).userData.end?.x===points.end.x&&(obj as SpatialEdgeObject).userData.end?.y===points.end.y&&(obj as SpatialEdgeObject).userData.end?.z===points.end.z;
          const result=updateSpatialEdge(obj,points,link.relation,dashBudget);if(!unchanged)scheduleEdgeBatch();return result;
        }}
        linkDirectionalArrowLength={0} linkDirectionalParticles={0}
        onNodeHover={(n:SpatialNode|null)=>setHover(n?.id??null)}
        onNodeClick={(n:SpatialNode)=>props.onSelect(n.id)}
        onNodeRightClick={(n:SpatialNode)=>{props.onSelect(n.id);request({type:'getGitBlame',nodeId:n.id});}}
        onNodeDragEnd={(n:SpatialNode)=>{if(validPoint(n))onPosition(n.id,{x:round(n.x),y:round(n.y),z:round(n.z)});}}
        onLinkClick={(l:SpatialLink)=>props.onEdge(l.id)} onBackgroundClick={props.onDismiss}/>
    }
    <div className="spatial-controls" role="group" aria-label="3D graph layouts and navigation">
      <div className="spatial-kicker"><i aria-hidden="true" className="codicon codicon-type-hierarchy"/> XP CANVAS · 3D</div>
      <label>Organization<select aria-label="3D graph organization" value={layout} onChange={e=>onLayout(e.target.value as SpatialLayoutKind)}>{Object.entries(SPATIAL_LAYOUT_NAMES).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>
      <label>Folder<select aria-label="3D folder filter" value={folder} onChange={e=>setFolder(e.target.value)}><option value="all">All folders</option>{projection.folders.map(f=><option value={f} key={f}>{f.split('/').slice(-2).join('/')}</option>)}</select></label>
      <div className="spatial-camera-buttons" role="group" aria-label="3D camera navigation">
        <button aria-label="Zoom in 3D graph" title="Zoom in" onClick={()=>dolly(.78)}>＋</button>
        <button aria-label="Zoom out 3D graph" title="Zoom out" onClick={()=>dolly(1.28)}>－</button>
        <button onClick={()=>ref.current?.zoomToFit(400,90)} title="Fit entire spatial graph">Fit all</button>
        <button onClick={()=>selectedId&&centerOn(selectedId)} disabled={!selectedId}>Focus</button>
      </div>
      <div className="spatial-camera-buttons" role="group" aria-label="Camera angle presets">
        <button onClick={()=>focusDirection(new THREE.Vector3(0,0,1))} title="Look from front">Front</button>
        <button onClick={()=>focusDirection(new THREE.Vector3(0,1,.001))} title="Look from above">Top</button>
        <button onClick={()=>focusDirection(new THREE.Vector3(1,.2,.3))} title="Look from side">Side</button>
        <button onClick={()=>focusDirection(new THREE.Vector3(1,.8,1))} title="Isometric view">Isometric</button>
      </div>
      <label className="spatial-label-toggle"><input type="checkbox" checked={labels} onChange={e=>setLabels(e.target.checked)}/> Show selected details</label>
      <div className="spatial-numbers">{spatialData.nodes.length.toLocaleString()} symbols · {spatialData.links.length.toLocaleString()} relations · billboards with bounded detail</div>
      <p>Drag to orbit · right-drag to pan · wheel to zoom · click a front-facing card to inspect. UML colors, dashed links and review badges match 2D.</p>
    </div>
    {selected&&labels&&props.showDetails&&<SpatialSelection node={selected} compareActive={props.comparison} readOnly={props.readOnly} openThreads={projection.nodes.find(n=>n.id===selected.id)?.openThreads??0} onFocus={()=>centerOn(selected.id)} onDismiss={props.onDismiss} onReview={()=>props.onReviewNode(selected.id)}/>}
    <div className="spatial-uml-key" aria-label="3D UML colors and relationships">
      <span><i aria-hidden="true" className="spatial-key-mark role-module"/>Module</span>
      <span><i aria-hidden="true" className="spatial-key-mark role-class"/>Class</span>
      <span><i aria-hidden="true" className="spatial-key-mark role-callable"/>Callable</span>
      <span><i aria-hidden="true" className="spatial-key-mark role-data"/>Data</span>
      <span className="spatial-key-line">── Inherits</span>
      <span className="spatial-key-line is-dashed">┄ ┄ Calls / imports / implements</span>
    </div>
    {hover&&<span className="spatial-focus-prompt" aria-live="off">Hover: {projection.nodes.find(n=>n.id===hover)?.symbol.name}</span>}
    {props.comparison&&<div className="spatial-review-legend" aria-label="3D review coloring"><span className="spatial-color-dot added"/> Changed <span className="spatial-color-dot impacted"/> Potential impact <span className="spatial-color-dot faded"/> Unchanged context</div>}
  </div>;
}
