import type { CanvasState, GraphNode, SourceGraph, XY } from './types';

export interface LayoutNode { id: string; position: XY; }
const WIDTH = 300;
const HEIGHT = 168;

/** Pure deterministic starting positions. Dragged/pinned positions win. */
export function initialLayout(graph: SourceGraph, state: CanvasState): Record<string, XY> {
  const positions: Record<string, XY> = {};
  const focus = state.focusedFile;
  const centered = focus ? graph.nodes.filter(n => n.uri === focus && (n.kind === 'class' || n.kind === 'function')) : [];
  const centerIds = new Set(centered.map(n => n.id));
  const inbound = new Set<string>(), outbound = new Set<string>();
  for (const e of graph.edges) {
    if (centerIds.has(e.target) && !centerIds.has(e.source)) inbound.add(e.source);
    if (centerIds.has(e.source) && !centerIds.has(e.target)) outbound.add(e.target);
  }
  const sortNodes = (ns: GraphNode[]) => ns.sort((a, b) => a.uri.localeCompare(b.uri) || a.range.startLine - b.range.startLine || a.id.localeCompare(b.id));
  if (centered.length) {
    sortNodes(centered).forEach((n, i) => positions[n.id] = { x: 440, y: i * (HEIGHT + 48) });
    // Exploded methods form a child lane beside their owning class, never in a random outer column.
    const methods = graph.nodes.filter(n => n.parentId && centerIds.has(n.parentId) && ['method', 'property'].includes(n.kind));
    const methodIds = new Set(methods.map(n => n.id));
    const offsetForClass = new Map<string, number>();
    sortNodes(methods).forEach(n => {
      const idx = offsetForClass.get(n.parentId!) ?? 0;
      offsetForClass.set(n.parentId!, idx + 1);
      const parent = positions[n.parentId!]!;
      positions[n.id] = { x: parent.x + WIDTH + 72, y: parent.y + idx * (HEIGHT + 32) };
    });
    const others = graph.nodes.filter(n => !centerIds.has(n.id) && !methodIds.has(n.id));
    const left = sortNodes(others.filter(n => inbound.has(n.id)));
    const right = sortNodes(others.filter(n => outbound.has(n.id) && !inbound.has(n.id)));
    const rest = sortNodes(others.filter(n => !inbound.has(n.id) && !outbound.has(n.id)));
    left.forEach((n, i) => positions[n.id] = { x: 16, y: i * (HEIGHT + 40) });
    right.forEach((n, i) => positions[n.id] = { x: 862, y: i * (HEIGHT + 40) });
    rest.forEach((n, i) => positions[n.id] = { x: 1284 + Math.floor(i / 12) * 380, y: (i % 12) * (HEIGHT + 26) });
  } else {
    sortNodes(graph.nodes.slice()).forEach((n, i) => positions[n.id] = { x: (i % 4) * (WIDTH + 74), y: Math.floor(i / 4) * (HEIGHT + 54) });
  }
  for (const [id, pos] of Object.entries(state.manualPositions)) if (positions[id]) positions[id] = { ...pos };
  for (const [id, pos] of Object.entries(state.pinned)) if (positions[id]) positions[id] = { ...pos };
  return positions;
}

/** Deliberate re-align ignores manual positions only for symbols in the focused file. */
export function realignFile(graph: SourceGraph, state: CanvasState): CanvasState {
  if (!state.focusedFile) return state;
  const centered = graph.nodes.filter(n => n.uri === state.focusedFile && ['class', 'function'].includes(n.kind));
  const manualPositions = { ...state.manualPositions };
  const pinned = { ...state.pinned };
  const mode=state.layoutMode??(state.focusedFile?'file':'architecture');
  const positions={...state.layoutPositions?.[mode]};
  for (const n of centered) { delete manualPositions[n.id]; delete pinned[n.id]; delete positions[n.id]; }
  return { ...state, manualPositions, pinned, layoutPositions:{...state.layoutPositions,[mode]:positions} };
}
