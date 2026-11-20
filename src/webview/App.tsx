import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap,
  useNodesState, useEdgesState, useReactFlow, useNodesInitialized, type NodeMouseHandler, type OnNodeDrag, type NodeChange,
} from '@xyflow/react';
import type { UmlFlowNode } from './components/UmlNode';
import type { UmlFlowEdge } from './components/UmlEdge';
import { UmlNodeComponent } from './components/UmlNode';
import { UmlEdgeComponent } from './components/UmlEdge';
import { CanvasToolbar } from './components/CanvasToolbar';
import { CanvasInspector } from './components/CanvasInspector';
import { GitTimeline } from './components/GitTimeline';
import { GitCommandStrip, type GitVisualMode } from './components/ui/GitCommandStrip';
import { SankeyLens } from './components/SankeyLens';
import { ScopeFrames } from './components/ScopeFrames';
import { detailForNode,createStructureIndex,summarizeStructure } from '../shared/semanticVisuals';
import { request, subscribe } from './bridge';
import { useCanvasStore } from './store';
import { visibleGraph, traceGraph } from '../shared/graph';
import { realignFile } from '../shared/layout';
import { orchestrateLayout, settleMeasuredLayout, layoutModeFor } from './layout/LayoutOrchestrator';
import {allocateEdgeLabels, bundleProjectedEdges, portForRelationship, portOffset} from './graph/EdgeRoutingService';
import {nodeSize} from './elkLayout';
import { projectMemberPorts } from './graph/MemberPortProjection';
import {estimatedHandles} from './graph/EstimatedHandles';
import { isZoomGesture, zoomAroundPointer, zoomFactor } from './interaction';
import type { Altitude, EdgeKind, GraphNode, LayoutMode } from '../shared/types';
import type { GitCommit } from '../shared/gitHistory';
import '@xyflow/react/dist/style.css';
import '@vscode/codicons/dist/codicon.css';
import './app.css';
import './styles/tokens.css';
import './styles/chrome.css';
import './styles/nodes.css';
import './styles/edges.css';
import './styles/git.css';
import './styles/sankey.css';

const nodeTypes={uml:UmlNodeComponent};
const edgeTypes={uml:UmlEdgeComponent};
const labels:Record<Altitude,string>={architecture:'Architecture',package:'Packages',module:'Modules',code:'Code'};
const graphIsEmpty=(length:number)=>length===0;

function CanvasBody(){
  const graph=useCanvasStore(s=>s.graph),state=useCanvasStore(s=>s.state);
  const message=useCanvasStore(s=>s.message),baseline=useCanvasStore(s=>s.baseline),blames=useCanvasStore(s=>s.blames);
  const change=useCanvasStore(s=>s.change),focus=useCanvasStore(s=>s.focus),select=useCanvasStore(s=>s.select),hydrate=useCanvasStore(s=>s.hydrate),status=useCanvasStore(s=>s.status),showDiff=useCanvasStore(s=>s.showDiff),goto=useCanvasStore(s=>s.goto);
  const [nodes,setNodes,onNodesChange]=useNodesState<UmlFlowNode>([]);
  const [layoutBusy,setLayoutBusy]=useState(false);
  const [edges,setEdges,onEdgesChange]=useEdgesState<UmlFlowEdge>([]);
  const [search,setSearch]=useState(''),[gitBaseline,setGitBaseline]=useState('HEAD');
  const [showHelp,setShowHelp]=useState(false),[showFilters,setShowFilters]=useState(false);
  const [gitOpen,setGitOpen]=useState(false),[gitCommands,setGitCommands]=useState(false),[gitMode,setGitMode]=useState<GitVisualMode|null>(null),[commits,setCommits]=useState<GitCommit[]>([]),[gitError,setGitError]=useState(''),[gitLoading,setGitLoading]=useState(false);
  const [changeMode,setChangeMode]=useState<'all'|'direct'|'impact'>('all');
  const [inspecting,setInspecting]=useState(false),[showMinimap,setShowMinimap]=useState(false),[hoveredEdge,setHoveredEdge]=useState<string|null>(null),[selectedEdgeId,setSelectedEdgeId]=useState<string|null>(null),[layoutEpoch,setLayoutEpoch]=useState(0);
  const measuredRef=useRef<Map<string,{width:number;height:number}>>(new Map());
  const measureFrame=useRef<number|null>(null);
  const flow=useReactFlow<UmlFlowNode,UmlFlowEdge>();
  const nodesInitialized=useNodesInitialized();
  const [initialFitPending,setInitialFitPending]=useState(true);
  useEffect(()=>{
    if(!initialFitPending||!nodesInitialized||!nodes.length)return;
    const current=useCanvasStore.getState().state;
    const work=current.viewport.x===0&&current.viewport.y===0
      ?flow.fitView({padding:.18,maxZoom:1})
      :flow.setViewport(current.viewport);
    void work.then(()=>setInitialFitPending(false));
  },[initialFitPending,nodesInitialized,nodes.length,flow]);
  const regionRef=useRef<HTMLElement|null>(null);
  const previousAltitude=useRef(state.altitude);
  const previousFocus=useRef<string|null>(state.focusedFile);
  const fitLayoutRef=useRef(false);
  const searchRevealRef=useRef<string|null>(null);
  const projected=useMemo(()=>visibleGraph(graph,state),[graph,state.altitude,state.explodeMethods]);
  // Edges are a visual projection: re-bundle on zoom without relaying out the nodes.
  // Resolve member ports *after* bundling so a multi-method bundle cannot
  // accidentally inherit the first edge's member handle.
  const displayEdges=useMemo(()=>bundleProjectedEdges(projected.edges,state.zoom),[projected,state.zoom]);
  const displayedGraph=useMemo(()=>({...projected,edges:displayEdges}),[projected,displayEdges]);
  const memberProjection=useMemo(()=>projectMemberPorts(displayedGraph,graph),[displayedGraph,graph]);
  const portKinds=useMemo(()=>{
    const map=new Map<string,Set<EdgeKind>>();
    for(const edge of displayEdges){for(const id of [edge.source,edge.target]){
      const kinds=map.get(id)??new Set<EdgeKind>();kinds.add(edge.kind);map.set(id,kinds);
    }}
    return map;
  },[displayEdges]);
  const byId=useMemo(()=>new Map(graph.nodes.map(n=>[n.id,n])),[graph]);
  const fullMembers=useMemo(()=>{
    const result=new Map<string,GraphNode[]>();
    for(const n of graph.nodes)if(n.parentId)result.set(n.parentId,[...(result.get(n.parentId)??[]),n]);
    for(const values of result.values())values.sort((a,b)=>a.range.startLine-b.range.startLine);
    return result;
  },[graph]);
  const expanded=useMemo(()=>new Set(state.expanded),[state.expanded]);
  const blamed=useMemo(()=>new Set(Object.keys(blames)),[blames]);
  const memberCounts=useMemo(()=>new Map([...fullMembers.entries()].map(([id,members])=>[id,members.filter(m=>m.kind==='method'||m.kind==='property').length])),[fullMembers]);
  const layoutMode=layoutModeFor(state);
  const layoutAnchor=layoutMode==='investigation'?state.selectedNode:null;
  const structureIndex=useMemo(()=>createStructureIndex(graph),[graph]);
  const partSummaries=useMemo(()=>new Map(projected.nodes.map(n=>[n.id,summarizeStructure(n,graph,18,structureIndex)])),[projected,graph,structureIndex]);
  const files=useMemo(()=>graph.nodes.filter(n=>n.kind==='module').sort((a,b)=>a.module.localeCompare(b.module)),[graph]);
  const inspectPart=useCallback((id:string)=>{
    const symbol=useCanvasStore.getState().graph.nodes.find(n=>n.id===id);
    if(!symbol)return;
    const current=useCanvasStore.getState().state;
    useCanvasStore.getState().select(id);
    useCanvasStore.getState().change({altitude:'code',
      explodeMethods:current.explodeMethods||symbol.kind==='method'||symbol.kind==='property'});
  },[]);
  const toggleExpand=useCallback((id:string)=>{
    const next=new Set(useCanvasStore.getState().state.expanded);
    if(next.has(id))next.delete(id);else next.add(id);
    useCanvasStore.getState().change({expanded:[...next]});
  },[]);

  useEffect(()=>subscribe(data=>{
    if(data.type==='graph')hydrate(data.graph,data.state);
    if(data.type==='graphDelta'&&!useCanvasStore.getState().applyDelta(data.delta))request({type:'ready'});
    if(data.type==='diff')showDiff(data.graph,data.baseline);
    if(data.type==='sourcePreview')useCanvasStore.getState().acceptPreview(data.nodeId,data.contentHash,data.source,data.stale,data.error);
    if(data.type==='stateAck')useCanvasStore.getState().acknowledgeState(data.revision);
    if(data.type==='focus'){focus(data.file,data.node);if(data.node)setInspecting(true);}
    if(data.type==='action'){
      if(data.action==='align'){
        const store=useCanvasStore.getState();store.change(realignFile(store.graph,store.state));setLayoutEpoch(v=>v+1);
      }else if(data.action==='reset'){
        useCanvasStore.getState().change({pinned:{},manualPositions:{},layoutPositions:{}});setLayoutEpoch(v=>v+1);
      }else if(data.action==='fit')void flow.fitView({padding:.18,duration:380});
    }
    if(data.type==='gitBlame')useCanvasStore.getState().acceptBlame(data.result);
    if(data.type==='gitHistory'){setCommits(data.commits);setGitError(data.error??'');setGitLoading(false);}
    if(data.type==='status')status(data.message);
  }),[hydrate,showDiff,focus,status,flow]);
  useEffect(()=>{request({type:'ready'});},[]);

  // A consistent wheel model: ordinary wheel scrolls text / pans vertically;
  // Ctrl/Cmd+wheel zooms the canvas at the pointer, regardless of target.
  useEffect(()=>{
    const region=regionRef.current;if(!region)return;
    const handleWheel=(event:WheelEvent)=>{
      if(!isZoomGesture(event))return;
      event.preventDefault();event.stopImmediatePropagation();
      const rect=region.getBoundingClientRect();
      const pointer={x:event.clientX-rect.left,y:event.clientY-rect.top};
      void flow.setViewport(zoomAroundPointer(flow.getViewport(),pointer,zoomFactor(event.deltaY)));
    };
    region.addEventListener('wheel',handleWheel,{capture:true,passive:false});
    return ()=>region.removeEventListener('wheel',handleWheel,{capture:true});
  },[flow]);

  useEffect(()=>{
    if(previousAltitude.current===state.altitude)return;
    previousAltitude.current=state.altitude;
    void flow.setViewport(state.viewport,{duration:150});
  },[state.altitude,flow,state.viewport]);

  useEffect(()=>{
    let cancelled=false;
    setLayoutBusy(true);
    (async()=>{
      const positions=await orchestrateLayout(projected,state,memberCounts,blamed,measuredRef.current);
      if(cancelled)return;
      setNodes(projected.nodes.map(n=>({
        id:n.id,type:'uml',position:positions[n.id]??{x:0,y:0},
        // Virtualized offscreen cards start from estimates; DOM measurements
        // replace these bounds as soon as a card enters the viewport.
        initialWidth:projected.nodes.length>300?nodeSize(n,state,memberCounts,blamed.has(n.id)).width:undefined,
        initialHeight:projected.nodes.length>300?nodeSize(n,state,memberCounts,blamed.has(n.id)).height:undefined,
        measured:projected.nodes.length>300?nodeSize(n,state,memberCounts,blamed.has(n.id)):undefined,
        handles:projected.nodes.length>300?estimatedHandles(
          nodeSize(n,state,memberCounts,blamed.has(n.id)).width,nodeSize(n,state,memberCounts,blamed.has(n.id)).height,
          [...(portKinds.get(n.id)??new Set<EdgeKind>(['calls']))],memberProjection.members.get(n.id)??[]):undefined,
        data:{symbol:n,members:fullMembers.get(n.id)??[],summary:partSummaries.get(n.id)!,detail:detailForNode(state.zoom,expanded.has(n.id),state.selectedNode===n.id),onExpand:toggleExpand,onInspectPart:inspectPart,expanded:expanded.has(n.id),pinned:Boolean(state.pinned[n.id]),portKinds:[...(portKinds.get(n.id)??new Set<EdgeKind>(['calls']))],memberPorts:memberProjection.members.get(n.id)??[],cardWidth:nodeSize(n,state,memberCounts,blamed.has(n.id)).width},
        selected:n.id===state.selectedNode,
      })));
      setLayoutBusy(false);
      const reveal=searchRevealRef.current;
      if(reveal&&projected.nodes.some(n=>n.id===reveal)){
        searchRevealRef.current=null;
        previousFocus.current=state.focusedFile;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(!cancelled)void flow.fitView({nodes:[{id:reveal}],padding:.35,maxZoom:1.4,duration:330});
        }));
      }
      if(fitLayoutRef.current){
        fitLayoutRef.current=false;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(!cancelled)void flow.fitView({padding:.18,maxZoom:1,duration:0});
        }));
      }
      if(state.focusedFile!==previousFocus.current){
        previousFocus.current=state.focusedFile;
        const own=projected.nodes.filter(n=>n.uri===state.focusedFile&&(['class','function','module'].includes(n.kind)));
        // Measure nodes on the next paint before fitting the focused file.
        if(own.length)requestAnimationFrame(()=>requestAnimationFrame(()=>{
          if(!cancelled)void flow.fitView({nodes:own.map(n=>({id:n.id})),padding:.38,maxZoom:1,duration:410});
        }));
      }
    })();
    return ()=>{cancelled=true;};
    // A layout is only recomputed on semantic/layout/size changes, never during a drag.
  },[projected,state.altitude,state.focusedFile,state.explodeMethods,state.layoutMode,layoutAnchor,layoutEpoch]);

  // Edges and source-backed member ports have their own lifecycle. Updating
  // them never resets manually arranged node positions or triggers ELK.
  useEffect(()=>{
    setEdges(displayEdges.map(e=>({id:e.id,source:e.source,target:e.target,type:'uml',
      sourceHandle:memberProjection.edges.get(e.id)?.sourceHandle??portForRelationship(e.kind,'source'),
      targetHandle:memberProjection.edges.get(e.id)?.targetHandle??portForRelationship(e.kind,'target'),
      data:{relation:e}})));
  },[displayEdges,memberProjection,setEdges]);
  useEffect(()=>{
    setNodes(current=>current.map(n=>({...n,data:{...n.data,
      portKinds:[...(portKinds.get(n.id)??new Set<EdgeKind>(['calls']))],
      memberPorts:memberProjection.members.get(n.id)??[],
    }})));
  },[portKinds,memberProjection,setNodes]);

  useEffect(()=>{
    const zoom=state.zoom;
    setNodes(current=>current.map(n=>({...n,data:{...n.data,expanded:expanded.has(n.id),pinned:Boolean(state.pinned[n.id]),
      detail:detailForNode(zoom,expanded.has(n.id),n.id===state.selectedNode),
      cardWidth:nodeSize(n.data.symbol,state,memberCounts,blamed.has(n.id)).width,
    },selected:n.id===state.selectedNode})));
  },[expanded,state.zoom,state.pinned,state.selectedNode,setNodes]);

  /** React Flow reports DOM measurements after node expansion. Correct only collisions;
   * never reflow the whole graph when someone scrolls or changes semantic zoom. */
  const handleNodeChanges=useCallback((changes:NodeChange<UmlFlowNode>[])=>{
    onNodesChange(changes);
    let resized=false;
    for(const item of changes){
      if(item.type==='dimensions'&&item.dimensions){
        const existing=measuredRef.current.get(item.id);
        if(!existing||Math.abs(existing.width-item.dimensions.width)>2||Math.abs(existing.height-item.dimensions.height)>2){
          measuredRef.current.set(item.id,{width:item.dimensions.width,height:item.dimensions.height});resized=true;
        }
      }
    }
    if(!resized)return;
    if(measureFrame.current!==null)cancelAnimationFrame(measureFrame.current);
    measureFrame.current=requestAnimationFrame(()=>{
      measureFrame.current=null;
      setNodes(current=>{
        const measuredIds=new Set(changes.filter(c=>c.type==='dimensions').map(c=>c.id));
        const boxes=current.filter(n=>!n.hidden).map(n=>({id:n.id,x:n.position.x,y:n.position.y,
          width:measuredRef.current.get(n.id)?.width??n.measured?.width??nodeSize(n.data.symbol,state,memberCounts,blamed.has(n.id)).width,
          height:measuredRef.current.get(n.id)?.height??n.measured?.height??nodeSize(n.data.symbol,state,memberCounts,blamed.has(n.id)).height,
          pinned:Boolean(state.pinned[n.id])}));
        const settled=settleMeasuredLayout(boxes,state.selectedNode,36);
        return current.map(node=>{
          const n=measuredIds.has(node.id)&&node.handles?{...node,handles:undefined}:node;
          return settled[n.id]&&(
          Math.abs(n.position.x-settled[n.id].x)>1||Math.abs(n.position.y-settled[n.id].y)>1
        )?{...n,position:settled[n.id]}:n;});
      });
    });
  },[onNodesChange,setNodes,state.selectedNode,state.pinned,state,memberCounts,blamed]);
  useEffect(()=>()=>{if(measureFrame.current!==null)cancelAnimationFrame(measureFrame.current);},[]);

  const selected=state.selectedNode?byId.get(state.selectedNode)??projected.nodes.find(n=>n.id===state.selectedNode):undefined;
  const crumbs=useMemo(()=>{
    const result:GraphNode[]=[];let n=selected;const seen=new Set<string>();
    while(n&&!seen.has(n.id)&&result.length<7){seen.add(n.id);result.unshift(n);n=n.parentId?byId.get(n.parentId):undefined;}
    return result;
  },[selected,byId]);
  const directlyChanged=useMemo(()=>new Set(projected.nodes.filter(n=>n.change&&['ADDED','MODIFIED','REMOVED'].includes(n.change)).map(n=>n.id)),[projected]);
  const affected=useMemo(()=>new Set(projected.nodes.filter(n=>n.change&&n.change!=='UNCHANGED').map(n=>n.id)),[projected]);
  const selectedEdges=useMemo(()=>projected.edges.filter(e=>e.source===selected?.id||e.target===selected?.id),[projected,selected?.id]);
  const trace=useMemo(()=>state.selectedNode&&state.trace!=='all'?traceGraph(projected,state.selectedNode,state.trace,state.traceDepth):null,[projected,state.selectedNode,state.trace,state.traceDepth]);
  const matches=useMemo(()=>new Set(projected.nodes.filter(n=>!search.trim()||`${n.qualifiedName} ${n.uri}`.toLowerCase().includes(search.trim().toLowerCase())).map(n=>n.id)),[projected,search]);
  // Allocate all currently highlighted relationship labels as one non-overlapping set.
  const edgeLabelPositions=useMemo(()=>{
    if(!hoveredEdge&&!selectedEdgeId&&!state.selectedNode)return new Map<string,{x:number;y:number}>();
    const byPosition=new Map(nodes.map(n=>[n.id,n]));
    const nodeRects=nodes.filter(n=>!n.hidden).map(n=>({x:n.position.x,y:n.position.y,
      width:n.measured?.width??320,height:n.measured?.height??160}));
    const requests=displayEdges.filter(e=>e.id===hoveredEdge||e.id===selectedEdgeId||e.source===state.selectedNode||e.target===state.selectedNode)
      .map(e=>{
        const start=byPosition.get(e.source),end=byPosition.get(e.target);
        if(!start||!end)return null;
        return {id:e.id,text:`${e.kind} ×${e.count??1}`,
          start:{x:start.position.x+(start.measured?.width??320),y:start.position.y+(start.measured?.height??160)*portOffset(e.kind)/100},
          end:{x:end.position.x,y:end.position.y+(end.measured?.height??160)*portOffset(e.kind)/100},
          priority:e.id===selectedEdgeId?3:e.id===hoveredEdge?2:1};
      }).filter((r):r is NonNullable<typeof r>=>r!==null);
    return new Map(allocateEdgeLabels(requests,nodeRects,28).map(item=>[item.id,{x:item.x,y:item.y}]));
  },[nodes,displayEdges,hoveredEdge,selectedEdgeId,state.selectedNode]);

  // Node visibility and edge-label effects must be independent: labels depend on node geometry.
  useEffect(()=>{
    const traceNodes=new Set(trace?.nodes??[]);
    setNodes(current=>current.map(n=>{
      const hidden=!matches.has(n.id)||Boolean(trace&&!traceNodes.has(n.id));
      const className=baseline&&changeMode!=='all'&&!(changeMode==='direct'?directlyChanged:affected).has(n.id)?'canvas-muted-node':'';
      return n.hidden===hidden&&n.className===className?n:{...n,hidden,className};
    }));
  },[trace,matches,baseline,changeMode,directlyChanged,affected,setNodes]);
  useEffect(()=>{
    const visibleTypes=new Set(state.edgeKinds),traceEdges=new Set(trace?.edges??[]);
    setEdges(current=>current.map(e=>{
      const hidden=!visibleTypes.has(e.data!.relation.kind)||!matches.has(e.source)||!matches.has(e.target)||Boolean(trace&&!traceEdges.has(e.id));
      const className=baseline&&changeMode!=='all'&&!(changeMode==='direct'?directlyChanged:affected).has(e.source)&&!(changeMode==='direct'?directlyChanged:affected).has(e.target)?'canvas-muted-edge':'';
      const reveal=e.id===hoveredEdge||e.id===selectedEdgeId||Boolean(state.selectedNode&&(e.source===state.selectedNode||e.target===state.selectedNode));
      const labelPosition=edgeLabelPositions.get(e.id);
      if(e.hidden===hidden&&e.className===className&&e.data?.reveal===reveal&&
          e.data?.labelPosition?.x===labelPosition?.x&&e.data?.labelPosition?.y===labelPosition?.y)return e;
      return {...e,hidden,className,data:{...e.data!,labelPosition,reveal}};
    }));
  },[state.edgeKinds,state.selectedNode,trace,matches,hoveredEdge,selectedEdgeId,edgeLabelPositions,setEdges,baseline,changeMode,directlyChanged,affected]);

  const back=useCanvasStore(s=>s.back),forward=useCanvasStore(s=>s.forward);
  const onNodeClick:NodeMouseHandler<UmlFlowNode>=useCallback((_event,node)=>{select(node.id);setGitOpen(false);setInspecting(true);request({type:'selectNode',nodeId:node.id});},[select]);
  const moveNode=useCanvasStore(s=>s.moveNode);
  const onNodeDragStop:OnNodeDrag<UmlFlowNode>=useCallback((_event,node)=>moveNode(node.id,node.position),[moveNode]);
  const handleAlign=()=>{change(realignFile(projected,state));setLayoutEpoch(v=>v+1);};
  const handleReset=()=>{change({pinned:{},manualPositions:{},layoutPositions:{}});setLayoutEpoch(v=>v+1);};
  const handleReflow=()=>setLayoutEpoch(v=>v+1);
  const selectFile=(uri:string)=>{change({focusedFile:uri||null,selectedNode:null,layoutMode:uri?'file':'architecture'});setInspecting(false);setLayoutEpoch(v=>v+1);};
  const changeLayout=(layoutMode:LayoutMode)=>{fitLayoutRef.current=true;change({layoutMode});setLayoutEpoch(v=>v+1);};
  const explore=(direction:'incoming'|'outgoing')=>{change({trace:direction});setInspecting(false);};
  const loadGit=()=>{setGitLoading(true);setGitError('');request({type:'getGitHistory',limit:100});};
  const toggleGit=()=>{setGitCommands(v=>!v);setShowHelp(false);setShowFilters(false);};
  const activateGitMode=(mode:GitVisualMode)=>{setGitMode(mode);setGitCommands(false);
    if(mode==='history'){loadGit();setGitOpen(true);setInspecting(false);}
    else if(mode==='blame'&&state.selectedNode){request({type:'getGitBlame',nodeId:state.selectedNode});setInspecting(true);setGitOpen(false);}
    else if(mode==='changes'){compare();setGitOpen(false);setInspecting(false);}
  };
  const compare=(revision=gitBaseline)=>{setGitBaseline(revision);request({type:'gitDiff',baseline:revision});};
  const zoomBy=(delta:number)=>{const region=regionRef.current;const bounds=region?.getBoundingClientRect();
    const center={x:(bounds?.width??800)/2,y:(bounds?.height??600)/2};
    void flow.setViewport(zoomAroundPointer(flow.getViewport(),center,delta));};
  const pickSymbol=(id:string)=>{
    const symbol=graph.nodes.find(n=>n.id===id);if(!symbol)return;
    searchRevealRef.current=id;
    select(id);change({altitude:'code',focusedFile:symbol.uri,layoutMode:'investigation',trace:'all',
      explodeMethods:state.explodeMethods||symbol.kind==='method'||symbol.kind==='property'});
    setLayoutEpoch(v=>v+1);
    setInspecting(true);
  };
  const focusLabel=files.find(f=>f.uri===state.focusedFile)?.module||'Workspace overview';
  const counts={symbols:projected.nodes.length,links:projected.edges.length};

  return <div className="canvas-shell">
    <CanvasToolbar onBack={back} onForward={forward} state={state} files={files} symbols={graph.nodes} onPick={pickSymbol} search={search} setSearch={setSearch} baseline={gitBaseline} setBaseline={setGitBaseline}
      gitOpen={gitCommands} filterOpen={showFilters} onGoto={goto} onFocusFile={selectFile} onAlign={handleAlign} onReflow={handleReflow} onReset={handleReset}
      onFit={()=>void flow.fitView({padding:.17,duration:360})} onExplode={()=>change({explodeMethods:!state.explodeMethods})} onCompare={()=>compare()}
      onHistory={toggleGit} onFilter={()=>{setShowFilters(s=>!s);setGitOpen(false);}} onFiltersChange={(edgeKinds:EdgeKind[])=>change({edgeKinds})}
      onTraceChange={trace=>change({trace})} onDepthChange={traceDepth=>change({traceDepth})}
      onRefresh={()=>request({type:'command',command:'reload'})} onHelp={()=>{setGitOpen(false);setInspecting(false);setShowHelp(s=>!s);}}
      onLens={lens=>{change({lens});setGitOpen(false);setInspecting(false);setShowFilters(false);}} onLayout={changeLayout}/>
    <main ref={regionRef} className="graph-region" tabIndex={0} aria-busy={layoutBusy||initialFitPending} aria-label="Interactive Python UML graph" onKeyDown={e=>{
      if(e.altKey&&e.key==='ArrowLeft'){e.preventDefault();back();setInspecting(true);}
      if(e.altKey&&e.key==='ArrowRight'){e.preventDefault();forward();setInspecting(true);}
      if(e.key==='Escape'){setInspecting(false);setGitOpen(false);setShowHelp(false);}
    }}>
      <ReactFlow<UmlFlowNode,UmlFlowEdge> nodes={nodes} edges={edges} onNodesChange={handleNodeChanges} onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop}
        onEdgeMouseEnter={(_event,edge)=>setHoveredEdge(edge.id)} onEdgeMouseLeave={()=>setHoveredEdge(null)}
        onEdgeClick={(_event,edge)=>setSelectedEdgeId(prev=>prev===edge.id?null:edge.id)}
        onPaneClick={()=>{setInspecting(false);setSelectedEdgeId(null);}} nodesConnectable={false} minZoom={.28} maxZoom={2.8}
        zoomOnScroll={false} panOnScroll={true} panOnScrollSpeed={.8} zoomOnPinch={false}
        zoomOnDoubleClick={false} panOnDrag={true} onlyRenderVisibleElements={!initialFitPending||projected.nodes.length>300}
        defaultViewport={state.viewport}
        onMoveEnd={(_event,viewport)=>{
          if(viewport.zoom!==state.zoom||viewport.x!==state.viewport.x||viewport.y!==state.viewport.y)change({zoom:viewport.zoom,viewport});
        }}
        proOptions={{hideAttribution:false}}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--xp-grid-dot)"/>
        <ScopeFrames nodes={nodes.filter(n=>n.data.symbol.uri===state.focusedFile)} enabled={state.altitude==='code'&&Boolean(state.focusedFile)&&state.lens!=='sankey'}/>
        {showMinimap&&<MiniMap className="canvas-minimap" pannable zoomable nodeColor={node=>node.selected?'var(--xp-accent)':'var(--xp-minimap-node)'}/>}
      </ReactFlow>
      {state.lens==='sankey'&&<SankeyLens graph={projected} selectedId={state.selectedNode} kind={state.flowKind??'calls'}
        onKind={flowKind=>change({flowKind})} onSelect={select} onBack={()=>change({lens:'uml'})}/>}
      <div className="graph-context" aria-label="Graph context"><div className="graph-context-title"><i className="codicon codicon-file-directory"/>{focusLabel}</div>
        {crumbs.length>0&&<nav className="graph-breadcrumbs" aria-label="Selected symbol ancestry">{crumbs.map((crumb,i)=><React.Fragment key={crumb.id}>{i>0&&<i className="codicon codicon-chevron-right" aria-hidden="true"/>}<button className="nodrag nopan" onClick={()=>{select(crumb.id);setInspecting(true);}} title={crumb.qualifiedName}>{crumb.name}</button></React.Fragment>)}</nav>}<div className="graph-context-meta"><span>{labels[state.altitude]}</span><span className="meta-divider"/><span>{layoutMode[0].toUpperCase()+layoutMode.slice(1)} layout</span><span className="meta-divider"/><span>{counts.symbols} symbols</span><span className="meta-divider"/><span>{counts.links} links</span></div></div>
      {baseline&&<div className="git-change-lens" role="group" aria-label="Git change emphasis"><span><i className="codicon codicon-git-compare"/> Compare {baseline.slice(0,12)}</span>{(['all','direct','impact'] as const).map(mode=><button key={mode} aria-pressed={changeMode===mode} className={changeMode===mode?'active':''} onClick={()=>setChangeMode(mode)}>{mode==='direct'?'Changed':mode==='impact'?'Changed + impact':'All'}</button>)}<button title="Return to current graph" aria-label="Refresh source graph" onClick={()=>request({type:'command',command:'reload'})}><i className="codicon codicon-refresh"/></button></div>}
      <div className="canvas-navigation" role="toolbar" aria-label="Zoom and canvas navigation">
        <button className="icon-button" aria-label="Zoom out" title="Zoom out" onClick={()=>zoomBy(1/1.22)}><i className="codicon codicon-remove"/></button>
        <span className="zoom-value" aria-label={`Canvas zoom ${Math.round(state.zoom*100)} percent`}>{Math.round(state.zoom*100)}%</span>
        <button className="icon-button" aria-label="Zoom in" title="Zoom in" onClick={()=>zoomBy(1.22)}><i className="codicon codicon-add"/></button>
        <span className="mini-separator"/>
        <button className="icon-button" aria-label="Fit canvas" title="Fit all symbols" onClick={()=>void flow.fitView({padding:.17,duration:360})}><i className="codicon codicon-screen-full"/></button>
        <button className={`icon-button ${showMinimap?'is-active':''}`} aria-label="Toggle minimap" title="Toggle minimap" aria-pressed={showMinimap} onClick={()=>setShowMinimap(s=>!s)}><i className="codicon codicon-map"/></button>
      </div>
      {state.lens!=='sankey'&&<div className="semantic-key" aria-label="Color legend for Python code constructs">
        <span><i className="key-mark role-module"/> Module</span><span><i className="key-mark role-class"/> Class</span>
        <span><i className="key-mark role-callable"/> Callable</span><span><i className="key-mark role-data"/> Data</span>
        <span className="semantic-key-note">Git changes use separate markers</span>
      </div>}
      <div className="wheel-hint" aria-label="Mouse controls">Scroll to pan <span>·</span> Ctrl + scroll to zoom</div>
      {graphIsEmpty(graph.nodes.length)&&<div className="empty-overlay"><div className="empty-icon"><i className="codicon codicon-type-hierarchy"/></div><h2>Explore code as a system</h2><p>Open a Python workspace to see classes, functions, and source-backed relationships. Keep editing in the standard VS Code editor.</p><button className="button-primary" onClick={()=>request({type:'command',command:'reload'})}>Index workspace</button></div>}
      {showHelp&&<div className="floating-popover help-dialog" role="dialog" aria-label="Canvas interaction guide"><button className="icon-button close-float" aria-label="Close help" onClick={()=>setShowHelp(false)}><i className="codicon codicon-close"/></button><span className="drawer-eyebrow">CONTROLS</span><h2>Work naturally</h2>
        <div className="shortcut-row"><span>Scroll</span><kbd>Wheel</kbd><small>Pan vertically; scroll inside source previews</small></div>
        <div className="shortcut-row"><span>Zoom</span><kbd>Ctrl / Cmd + Wheel</kbd><small>Zoom around pointer anywhere</small></div>
        <div className="shortcut-row"><span>Move graph</span><kbd>Drag background</kbd><small>Pan in any direction</small></div>
        <div className="shortcut-row"><span>Rearrange</span><kbd>Drag UML node</kbd><small>Connection ports stay attached</small></div>
        <div className="shortcut-row"><span>Edit code</span><kbd>Open in Editor</kbd><small>Standard editor, same editor group</small></div>
        <p className="help-hint">Edge labels appear on hover or selection; the full relationship evidence is available from the node inspector.</p>
      </div>}
      {inspecting&&selected&&<CanvasInspector selected={selected} edges={selectedEdges} blame={blames[selected.id]} onClose={()=>setInspecting(false)} onExplore={explore} onClear={()=>{change({trace:'all'});setInspecting(false);}}/>}
      {gitCommands&&<GitCommandStrip selectedName={selected?.name} mode={gitMode} onMode={activateGitMode} onClose={()=>setGitCommands(false)} hasBaseline={Boolean(baseline)}/>}
      {gitOpen&&<GitTimeline commits={commits} selected={gitBaseline} loading={gitLoading} error={gitError}
        onSelect={setGitBaseline} onCompare={compare} onClose={()=>setGitOpen(false)} onRefresh={loadGit}/>}
      {(message||baseline||graph.diagnostics.length>0)&&<div className="status-message" role="status"><i className={`codicon codicon-${graph.diagnostics.length?'warning':'info'}`}/>{message||`${graph.diagnostics.length} analyzer diagnostics`}{baseline?` · baseline ${baseline}`:''}</div>}
    </main>
  </div>;
}
export default function App(){return <ReactFlowProvider><CanvasBody/></ReactFlowProvider>;}
