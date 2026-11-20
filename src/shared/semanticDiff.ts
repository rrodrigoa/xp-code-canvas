import type { GraphNode, GraphEdge, SourceGraph, ChangeStatus } from './types';

export interface SemanticChange { id: string; status: ChangeStatus; before?: GraphNode; after?: GraphNode; reason: string; }
export interface SymbolCorrespondence { beforeId: string; afterId: string; confidence: 'certain' | 'candidate'; reason: string; }
export interface SemanticDelta { changes: SemanticChange[]; impacted: string[]; correspondence: SymbolCorrespondence[]; }

/** Compare normalized AST fingerprints, never infer certainty about renames. */
export function semanticDiff(before: SourceGraph, after: SourceGraph): SemanticDelta {
  const old = new Map(before.nodes.map(n => [n.id, n]));
  const latest = new Map(after.nodes.map(n => [n.id, n]));
  const changes: SemanticChange[] = [];
  const changed = new Set<string>();
  for (const node of after.nodes) {
    const previous = old.get(node.id);
    if (!previous) { changes.push({ id: node.id, status: 'ADDED', after: node, reason: 'New stable identity' }); changed.add(node.id); }
    else if (previous.structuralHash !== node.structuralHash) {
      changes.push({ id: node.id, status: 'MODIFIED', before: previous, after: node, reason: 'Python AST changed' }); changed.add(node.id);
    }
  }
  for (const node of before.nodes) if (!latest.has(node.id)) {
    changes.push({ id: node.id, status: 'REMOVED', before: node, reason: 'Missing current identity; move/rename not proven' });
    changed.add(node.id);
  }
  // Moves/renames are candidates only: matching syntax does not prove semantic identity.
  const removed = changes.filter(c=>c.status==='REMOVED' && c.before);
  const added = changes.filter(c=>c.status==='ADDED' && c.after);
  const correspondence: SymbolCorrespondence[]=[];
  for (const oldChange of removed) {
    const matches=added.filter(next=>next.after?.kind===oldChange.before?.kind &&
      next.after?.structuralHash===oldChange.before?.structuralHash && next.after?.name===oldChange.before?.name);
    if(matches.length===1)correspondence.push({beforeId:oldChange.id,afterId:matches[0].id,confidence:'candidate',
      reason:'Same declaration kind, short name and source AST fingerprint; move not proven'});
  }
  const impacted = new Set<string>();
  const reverse = new Map<string, string[]>();
  // Removed dependencies still matter for impact analysis; live-only edges miss them.
  for (const edge of [...before.edges, ...after.edges]) {
    if (!['calls', 'imports', 'inherits', 'creates'].includes(edge.kind)) continue;
    reverse.set(edge.target, [...(reverse.get(edge.target) ?? []), edge.source]);
  }
  const queue = [...changed];
  for (let i = 0; i < queue.length && i < 10000; i++) {
    for (const caller of reverse.get(queue[i]) ?? []) {
      if (impacted.has(caller) || changed.has(caller)) continue;
      impacted.add(caller); queue.push(caller);
    }
  }
  return { changes, impacted: [...impacted], correspondence };
}

function edgeIdentity(edge: GraphEdge): string {
  // Locations are provenance, not identity. Moving a callsite down by a line is not
  // a semantic graph relationship change.
  return `${edge.source}|${edge.target}|${edge.kind}|${edge.confidence}`;
}

/** Semantic edge changes are based on direction, type and evidence confidence. */
export function semanticEdgeDiff(before: SourceGraph, after: SourceGraph): Map<string, ChangeStatus> {
  const oldKeys = new Set(before.edges.map(edgeIdentity));
  const newKeys = new Set(after.edges.map(edgeIdentity));
  const results = new Map<string, ChangeStatus>();
  for (const edge of after.edges) {
    if (!oldKeys.has(edgeIdentity(edge))) results.set(edgeIdentity(edge), 'ADDED');
  }
  for (const edge of before.edges) {
    if (!newKeys.has(edgeIdentity(edge))) results.set(edgeIdentity(edge), 'REMOVED');
  }
  return results;
}

export function overlayChanges(before: SourceGraph, after: SourceGraph): SourceGraph {
  const delta = semanticDiff(before, after);
  const edgeStatuses = semanticEdgeDiff(before, after);
  const changeById = new Map(delta.changes.map(c => [c.id, c]));
  const impacted = new Set(delta.impacted);
  const nodes = after.nodes.map(n => ({ ...n, change: changeById.get(n.id)?.status ?? (impacted.has(n.id) ? 'IMPACTED' as const : undefined) }));
  for (const change of delta.changes.filter(c => c.status === 'REMOVED')) {
    nodes.push({ ...change.before!, change: 'REMOVED', baselineOnly: true });
  }
  const edges = after.edges.map(e => ({ ...e, change: edgeStatuses.get(edgeIdentity(e)) }));
  for (const edge of before.edges) if (edgeStatuses.get(edgeIdentity(edge)) === 'REMOVED') {
    edges.push({ ...edge, id: `ghost_${edge.id}`, change: 'REMOVED' });
  }
  return { ...after, nodes, edges };
}
