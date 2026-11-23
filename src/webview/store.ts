import { create } from 'zustand';
import type { CanvasState, SourceGraph, XY, Altitude } from '../shared/types';
import { DEFAULT_CANVAS_STATE } from '../shared/types';
import { applySourceDelta, type SourceGraphDelta } from '../core/graph/GraphDelta';
import { bridge, request } from './bridge';
import type { BlameResult } from '../shared/blame';
import type { ReviewSnapshot } from '../review/reviewTypes';
import type {ReviewLineOverlay} from '../shared/reviewLineOverlay';

interface CanvasStore {
  graph: SourceGraph;
  state: CanvasState;
  baseline: string | null;
  review: ReviewSnapshot | null;
  setReview: (review: ReviewSnapshot) => void;
  clearReview: () => void;
  message: string;
  previews: Record<string,{contentHash:string;source?:string;stale:boolean;truncated?:boolean;error?:string}>;
  blames: Record<string,BlameResult>;
  inlineEditResults:Record<string,{ok:boolean;error?:string;sequence:number}>;
  /** Volatile, never persisted to VS Code workspaceState; preserves drafts across offscreen node virtualization. */
  inlineDrafts:Record<string,{originalSource:string;updatedSource:string;expectedHash:string}>;
  setInlineDraft:(nodeId:string,draft:{originalSource:string;updatedSource:string;expectedHash:string})=>void;
  clearInlineDraft:(nodeId:string)=>void;
  reviewLineOverlays:Record<string,ReviewLineOverlay>;
  acceptReviewLineOverlay:(result:ReviewLineOverlay)=>void;
  acceptInlineEditResult:(nodeId:string,ok:boolean,error?:string)=>void;
  acceptBlame:(result:BlameResult)=>void;
  back:()=>void; forward:()=>void;
  stateRevision: number;
  pendingState: boolean;
  acceptPreview: (nodeId:string,contentHash:string,source:string|undefined,stale:boolean,error?:string,truncated?:boolean)=>void;
  acknowledgeState: (revision:number)=>void;
  hydrate: (graph: SourceGraph, state?: CanvasState) => void;
  applyDelta: (delta:SourceGraphDelta)=>boolean;
  change: (patch: Partial<CanvasState>, persist?: boolean) => void;
  focus: (file?: string, node?: string) => void;
  select: (id: string | null) => void;
  pin: (id: string, position: XY) => void;
  moveNode: (id: string, position: XY) => void;
  unpin: (id: string) => void;
  goto: (altitude: Altitude) => void;
  status: (message: string) => void;
  showDiff: (graph: SourceGraph, baseline: string) => void;
}

const saved = bridge.getState() as CanvasState | undefined;
const initialState = saved?.schema === 1 ? { ...DEFAULT_CANVAS_STATE, ...saved, layoutMode:saved.layoutMode??(saved.focusedFile?'file':'architecture') } : DEFAULT_CANVAS_STATE;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let reviewReturnState:CanvasState|null=null;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  graph: { schema: 1, nodes: [], edges: [], diagnostics: [] },
  state: initialState, baseline: null, review:null, message: '', previews: {}, blames:{},inlineEditResults:{},inlineDrafts:{},reviewLineOverlays:{}, stateRevision: 0, pendingState: false,
  setReview:review=>{
    const current=get();
    // Replies and review progress must not recreate the graph or rearrange existing nodes.
    if(current.review?.reviewKey===review.reviewKey && current.review.createdAt===review.createdAt){
      set({review:{...review,graph:current.graph},message:review.message??''});return;
    }
    if(!current.review)reviewReturnState=current.state;
    const state={...current.state,altitude:'code' as const,layoutMode:'change' as const,trace:'all' as const};
    set({review,graph:review.graph,state,baseline:null,previews:{},blames:{},reviewLineOverlays:{},message:review.message??''});
  },
  clearReview:()=>{
    const previous=reviewReturnState;reviewReturnState=null;
    set(s=>({review:null,state:previous??s.state,baseline:null,message:''}));
    if(previous){bridge.setState(previous);request({type:'state',state:previous});}
  },
  setInlineDraft:(nodeId,draft)=>set(s=>({inlineDrafts:{...s.inlineDrafts,[nodeId]:draft}})),
  clearInlineDraft:nodeId=>set(s=>{const inlineDrafts={...s.inlineDrafts};delete inlineDrafts[nodeId];return {inlineDrafts};}),
  acceptReviewLineOverlay:result=>set(s=>({reviewLineOverlays:{...s.reviewLineOverlays,[result.nodeId]:result}})),
  acceptInlineEditResult:(nodeId,ok,error)=>set(s=>({inlineEditResults:{...s.inlineEditResults,[nodeId]:{ok,error,sequence:(s.inlineEditResults[nodeId]?.sequence??0)+1}}})),
  acceptBlame:result=>set(s=>{
    const node=s.graph.nodes.find(n=>n.id===result.nodeId);
    if(node&&result.sourceHash&&node.contentHash!==result.sourceHash)return s;
    if(!node&&result.status!=='unavailable')return s;
    return {blames:{...s.blames,[result.nodeId]:result}};
  }),
  acceptPreview: (nodeId,contentHash,source,stale,error,truncated=false) => set(s=>{
    const current=s.graph.nodes.find(n=>n.id===nodeId);
    if(!current || current.contentHash && contentHash!==current.contentHash)return s;
    return {previews:{...s.previews,[nodeId]:{contentHash,source,stale,error,truncated}}};
  }),
  acknowledgeState: revision => set(s=>({stateRevision:Math.max(s.stateRevision,revision),pendingState:false})),
  hydrate: (graph, state) => set(s => ({ graph:s.review?.graph??graph, state: !s.pendingState && state ? {...s.state,...state,layoutMode:state.layoutMode??(state.focusedFile?'file':'architecture')} : s.state, baseline: null, previews:{}, blames:{} })),
  applyDelta: delta => {
    const current=get();
    if(current.review || current.baseline || current.graph.revision!==delta.baseRevision)return false;
    try {
      const graph=applySourceDelta(current.graph,delta);
      const previews={...current.previews};
      for(const item of delta.upsertNodes)delete previews[item.id];
      for(const id of delta.removeNodeIds)delete previews[id];
      const blames={...current.blames};
    for(const item of delta.upsertNodes)delete blames[item.id];
    for(const id of delta.removeNodeIds)delete blames[id];
    set({graph,previews,blames});return true;
    }catch{return false;}
  },
  change: (patch, notify = true) => {
    const state = { ...get().state, ...patch };
    set({ state, pendingState: notify });
    bridge.setState(state);
    if (notify) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => request({ type: 'state', state }), 220);
    }
  },
  focus: (file, node) => {
    const state=get().state;
    if(node)get().select(node);
    get().change({focusedFile:file??state.focusedFile,selectedNode:node??get().state.selectedNode,layoutMode:file?'file':state.layoutMode});
  },
  select: id => {
    const old=get().state;
    if(!id){get().change({selectedNode:null});return;}
    if(id===old.selectedNode&&old.history[old.historyIndex]===id)return;
    const history=old.history.slice(0,old.historyIndex+1);
    if(history[history.length-1]!==id)history.push(id);
    if(history.length>100)history.shift();
    get().change({selectedNode:id,history,historyIndex:history.length-1});
  },
  back:()=>{
    const s=get().state;if(s.historyIndex<=0)return;
    const index=s.historyIndex-1,id=s.history[index];
    const node=get().graph.nodes.find(n=>n.id===id);
    get().change({historyIndex:index,selectedNode:id,focusedFile:node?.uri??s.focusedFile,altitude:'code',trace:'all',explodeMethods:s.explodeMethods||node?.kind==='method'||node?.kind==='property'});
  },
  forward:()=>{
    const s=get().state;if(s.historyIndex>=s.history.length-1)return;
    const index=s.historyIndex+1,id=s.history[index];
    const node=get().graph.nodes.find(n=>n.id===id);
    get().change({historyIndex:index,selectedNode:id,focusedFile:node?.uri??s.focusedFile,altitude:'code',trace:'all',explodeMethods:s.explodeMethods||node?.kind==='method'||node?.kind==='property'});
  },
  moveNode:(id,position)=>{
    const state=get().state,mode=state.layoutMode??(state.focusedFile?'file':'architecture');
    get().change({layoutPositions:{...state.layoutPositions,[mode]:{...(state.layoutPositions?.[mode]??{}),[id]:position}}});
  },
  pin: (id, position) => get().change({
    pinned: { ...get().state.pinned, [id]: position },
    manualPositions: { ...get().state.manualPositions, [id]: position },
  }),
  unpin: id => {
    const pinned = { ...get().state.pinned }, manualPositions = { ...get().state.manualPositions };
    delete pinned[id]; delete manualPositions[id];
    get().change({ pinned, manualPositions });
  },
  goto: altitude => {
    const old=get().state;
    if(old.altitude===altitude)return;
    const altitudeViewports={...old.altitudeViewports,[old.altitude]:old.viewport};
    get().change({altitude,altitudeViewports,viewport:altitudeViewports[altitude] ?? {x:0,y:0,zoom:1},layoutMode:altitude==='architecture'?'architecture':old.layoutMode});
  },
  status: message => set({ message }),
  showDiff: (graph, baseline) => set({ graph, baseline, blames:{}, message: `Showing semantic changes from ${baseline}` }),
}));
