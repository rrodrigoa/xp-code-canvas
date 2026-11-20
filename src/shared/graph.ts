import type { Altitude, CanvasState, GraphNode, GraphEdge, SourceGraph } from './types';

const clean = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
const cloneNode = (n: GraphNode): GraphNode => ({ ...n });

/** Maps functions/methods to their visible container, no fabricated UML edges. */
export function visibleGraph(graph: SourceGraph, state: CanvasState): SourceGraph {
  if (state.altitude !== 'code') return aggregateGraph(graph, state.altitude);
  const byId = new Map(graph.nodes.map(n => [n.id, n]));
  const isDisplayed = (n: GraphNode): boolean => state.explodeMethods || !['method', 'property'].includes(n.kind);
  const visible = graph.nodes.filter(isDisplayed).map(cloneNode);
  const visibleIds = new Set(visible.map(n => n.id));
  const containerFor = (id: string): string => {
    let node = byId.get(id);
    while (node && !visibleIds.has(node.id)) node = node.parentId ? byId.get(node.parentId) : undefined;
    return node?.id ?? id;
  };
  const dedupe = new Map<string, GraphEdge>();
  for (const e of graph.edges) {
    const source = containerFor(e.source);
    const target = containerFor(e.target);
    if (source === target || !visibleIds.has(source) || !visibleIds.has(target)) continue;
    const key = `${source}|${target}|${e.kind}`;
    const current = dedupe.get(key);
    if (current) {
      current.count = (current.count ?? 1) + 1;
      current.memberEdgeIds = [...(current.memberEdgeIds ?? []), e.id];
      current.evidence.push(...e.evidence);
    } else {
      dedupe.set(key, { ...e, id: `view_${clean(key)}`, source, target, evidence: [...e.evidence], memberEdgeIds: [e.id], count: 1 });
    }
  }
  return { ...graph, nodes: visible, edges: [...dedupe.values()] };
}

export function aggregateGraph(graph: SourceGraph, altitude: Altitude): SourceGraph {
  if (altitude === 'code') return graph;
  const parents = new Map<string, string>();
  const aggregate = new Map<string, GraphNode>();
  const groupFor = (n: GraphNode): string => {
    if (altitude === 'module') return `${n.root}|module|${n.module}`;
    if (altitude === 'package') return `${n.root}|package|${n.module.includes('.') ? n.module.substring(0, n.module.lastIndexOf('.')) : '(root)'}`;
    return `${n.root}|architecture`;
  };
  for (const n of graph.nodes) {
    const key = groupFor(n);
    const groupName = altitude === 'architecture' ? n.root.split('/').pop() || 'Workspace'
      : altitude === 'package' ? n.module.includes('.') ? n.module.substring(0, n.module.lastIndexOf('.')) : '(root)'
      : n.module;
    const id = `group_${clean(key)}`;
    parents.set(n.id, id);
    if (!aggregate.has(id)) aggregate.set(id, {
      ...n, id, name: groupName, qualifiedName: groupName,
      kind: 'module', parentId: null, signature: '', source: '', attributes: [],
      operations: [], bases: [], decorators: [], members: [], count: 0,
    });
    const group = aggregate.get(id)!;
    group.members!.push(n.id);
    group.count = (group.count ?? 0) + 1;
  }
  const edges = new Map<string, GraphEdge>();
  for (const e of graph.edges) {
    const from = parents.get(e.source), to = parents.get(e.target);
    if (!from || !to || from === to) continue;
    const key = `${from}|${to}|${e.kind}`;
    if (!edges.has(key)) edges.set(key, {
      ...e, id: `aggregate_${clean(key)}`, source: from, target: to,
      evidence: [], memberEdgeIds: [], count: 0,
    });
    const next = edges.get(key)!;
    next.count = (next.count ?? 0) + 1;
    next.evidence.push(...e.evidence);
    next.memberEdgeIds!.push(e.id);
  }
  return { ...graph, nodes: [...aggregate.values()], edges: [...edges.values()] };
}

/** Source-backed bounded traversal; direction means original source -> target edges. */
export function traceGraph(graph: SourceGraph, start: string, direction: 'incoming' | 'outgoing', depth = 2): { nodes: string[]; edges: string[] } {
  if (!graph.nodes.some(n => n.id === start)) return { nodes: [], edges: [] };
  const nodes = new Set([start]);
  const edges = new Set<string>();
  let frontier = new Set([start]);
  for (let i = 0; i < Math.max(0, Math.min(depth, 20)); i++) {
    const next = new Set<string>();
    for (const edge of graph.edges) {
      const from = direction === 'incoming' ? edge.target : edge.source;
      const to = direction === 'incoming' ? edge.source : edge.target;
      if (!frontier.has(from)) continue;
      edges.add(edge.id);
      if (!nodes.has(to)) { nodes.add(to); next.add(to); }
    }
    frontier = next;
    if (frontier.size === 0) break;
  }
  return { nodes: [...nodes], edges: [...edges] };
}

export function symbolAt(graph: SourceGraph, uri: string, line: number): GraphNode | undefined {
  return graph.nodes.filter(n => n.uri === uri && n.kind !== 'module'
      && n.range.startLine <= line && n.range.endLine >= line)
    .sort((a, b) => (a.range.endLine - a.range.startLine) - (b.range.endLine - b.range.startLine))[0];
}
