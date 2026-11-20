import { create } from 'zustand';
import type { CanvasState, SourceGraph, XY, Altitude } from '../shared/types';
import { DEFAULT_CANVAS_STATE } from '../shared/types';
import { applySourceDelta, type SourceGraphDelta } from '../core/graph/GraphDelta';
import { bridge, request } from './bridge';
import type { BlameResult } from '../shared/blame';

interface CanvasStore {
  graph: SourceGraph;
  state: CanvasState;
  baseline: string | null;
  message: string;
  previews: Record<string,{contentHash:string;source?:string;stale:boolean;error?:string}>;
  blames: Record<string,BlameResult>;
  acceptBlame:(result:BlameResult)=>void;
  back:()=>void; forward:()=>void;
  stateRevision: number;
  pendingState: boolean;
  acceptPreview: (nodeId:string,contentHash:string,source:string|undefined,stale:boolean,error?:string)=>void;
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

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  graph: { schema: 1, nodes: [], edges: [], diagnostics: [] },
  state: initialState, baseline: null, message: '', previews: {}, blames:{}, stateRevision: 0, pendingState: false,
  acceptBlame:result=>set(s=>{
    const node=s.graph.nodes.find(n=>n.id===result.nodeId);
    if(node&&result.sourceHash&&node.contentHash!==result.sourceHash)return s;
    if(!node&&result.status!=='unavailable')return s;
    return {blames:{...s.blames,[result.nodeId]:result}};
  }),
  acceptPreview: (nodeId,contentHash,source,stale,error) => set(s=>{
    const current=s.graph.nodes.find(n=>n.id===nodeId);
    if(!current || current.contentHash && contentHash!==current.contentHash)return s;
    return {previews:{...s.previews,[nodeId]:{contentHash,source,stale,error}}};
  }),
  acknowledgeState: revision => set(s=>({stateRevision:Math.max(s.stateRevision,revision),pendingState:false})),
  hydrate: (graph, state) => set(s => ({ graph, state: !s.pendingState && state ? {...s.state,...state,layoutMode:state.layoutMode??(state.focusedFile?'file':'architecture')} : s.state, baseline: null, previews:{}, blames:{} })),
  applyDelta: delta => {
    const current=get();
    if(current.baseline || current.graph.revision!==delta.baseRevision)return false;
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
