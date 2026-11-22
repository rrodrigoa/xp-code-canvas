import type { GitCommit } from './gitHistory';
import type { BlameResult } from './blame';
export type NodeKind = 'module' | 'class' | 'function' | 'method' | 'property' | 'external';
export type EdgeKind = 'imports' | 'calls' | 'creates' | 'inherits' | 'references' | 'contains' | 'realizes';
export type Confidence = 'resolved' | 'ambiguous' | 'unresolved';
export type Altitude = 'architecture' | 'package' | 'module' | 'code';
export type LayoutMode = 'architecture' | 'file' | 'investigation' | 'change' | 'spread';
export type ChangeStatus = 'ADDED' | 'MODIFIED' | 'REMOVED' | 'IMPACTED' | 'UNCHANGED' | 'AMBIGUOUS';
export interface SourceRange { startLine: number; startCharacter: number; endLine: number; endCharacter: number; }
export interface Evidence { id?: string; uri: string; range: SourceRange; version: number; contentHash?: string; language: string; adapter: string; }
export type AnatomyKind = 'branch' | 'loop' | 'exception' | 'context' | 'return' | 'raise';
export interface CodeRegion { id:string; kind:AnatomyKind; label:string; depth:number; range:SourceRange; }
export interface Attribute { name: string; type: string | null; visibility: 'public' | 'protected' | 'private'; }
export interface GraphNode {
  id: string; kind: NodeKind; name: string; qualifiedName: string; uri: string; root: string;
  module: string; moduleId: string; parentId: string | null; range: SourceRange;
  selectionRange: SourceRange; version: number; visibility: string; decorators: string[];
  signature: string; docstring: string; attributes: Attribute[]; operations: string[];
  bases: string[]; async_: boolean; stereotype?: string | null; source: string;
  structuralHash?: string; contentHash?: string; stale?: boolean; confidence: Confidence; count?: number; members?: string[];
  change?: ChangeStatus; baselineOnly?: boolean; anatomy?: CodeRegion[];
}
export interface GraphEdge {
  id: string; source: string; target: string; kind: EdgeKind; confidence: Confidence;
  evidence: Evidence[]; count?: number; memberEdgeIds?: string[]; change?: ChangeStatus;
}
export interface Diagnostic { uri: string; severity: string; message: string; line: number; }
export interface SourceGraph { schema: 1; revision?: number; availability?: 'complete' | 'partial' | 'stale'; sourceVersions?: Record<string,string>; unresolved?: Array<{ownerId: string; expression: string; range: SourceRange; confidence: string}>; nodes: GraphNode[]; edges: GraphEdge[]; diagnostics: Diagnostic[]; stats?: Record<string, number>; }
export interface XY { x: number; y: number; }
export interface NodeDimensions { width: number; height: number; }
export interface SourceCursor { line: number; character: number; }
export interface CanvasState {
  schema: 1; altitude: Altitude; focusedFile: string | null; selectedNode: string | null;
  zoom: number; viewport: { x: number; y: number; zoom: number };
  expanded: string[]; pinned: Record<string, XY>; manualPositions: Record<string, XY>;
  edgeKinds: EdgeKind[]; trace: 'all' | 'incoming' | 'outgoing'; traceDepth: number;
  history: string[]; historyIndex: number; explodeMethods: boolean;
  altitudeViewports?: Partial<Record<Altitude,{x:number;y:number;zoom:number}>>;
  layoutMode?: LayoutMode; layoutPositions?: Partial<Record<LayoutMode,Record<string,XY>>>;
  /** Persisted viewport dimensions apply only to explicit expanded code previews. */
  nodeSizes?: Record<string, NodeDimensions>;
  lens?: 'uml' | 'sankey'; flowKind?: 'calls' | 'imports' | 'references' | 'creates';
}
export const DEFAULT_CANVAS_STATE: CanvasState = {
  schema: 1, altitude: 'code', focusedFile: null, selectedNode: null,
  zoom: 1, viewport: { x: 0, y: 0, zoom: 1 }, expanded: [], pinned: {}, manualPositions: {},
  edgeKinds: ['calls', 'imports', 'inherits', 'creates'], trace: 'all', traceDepth: 2,
  history: [], historyIndex: -1, explodeMethods: false, lens: 'uml', flowKind: 'calls', layoutMode:'architecture', layoutPositions:{},
};
import type { SourceGraphDelta } from '../core/graph/GraphDelta';
export type ToWebview =
  | { type: 'graph'; graph: SourceGraph; state: CanvasState }
  | { type: 'graphDelta'; delta: SourceGraphDelta }
  | { type: 'focus'; file?: string; node?: string }
  | { type: 'revealSymbol'; nodeId: string; file: string }
  | { type: 'status'; message: string }
  | { type: 'action'; action:'align'|'reset'|'fit'|'spread'|'history' }
  | { type: 'diff'; graph: SourceGraph; baseline: string }
  | { type: 'sourcePreview'; requestId: string; nodeId: string; contentHash: string; source?: string; stale: boolean; error?: string }
  | { type: 'stateAck'; revision: number }
  | { type: 'gitHistory'; commits: GitCommit[]; error?: string }
  | { type: 'gitBlame'; result: BlameResult };
export type FromWebview =
  | { type: 'ready' }
  | { type: 'openNode'; nodeId: string; cursor?: SourceCursor }
  | { type: 'selectNode'; nodeId: string }
  | { type: 'focusFile'; uri: string }
  | { type: 'state'; state: CanvasState }
  | { type: 'command'; command: 'align' | 'fit' | 'reset' | 'explode' | 'reload' }
  | { type: 'gitDiff'; baseline: string }
  | { type: 'getGitHistory'; limit?: number }
  | { type: 'getGitBlame'; nodeId: string }
  | { type: 'openSourceRegion'; nodeId:string; regionId:string }
  | { type: 'getSourcePreview'; nodeId: string; requestId: string; expectedHash: string };
