import type { GraphSnapshot, GraphDelta } from '../contracts/graph.v2';
import { graphSnapshotSchema } from '../contracts/graph.v2';

/** Atomic, validated graph revisions, not coupled to any editor or UI library. */
export class GraphStore {
  private snapshot?: GraphSnapshot;
  get(): GraphSnapshot | undefined { return this.snapshot; }
  replace(candidate: GraphSnapshot): GraphSnapshot {
    const next = graphSnapshotSchema.parse(candidate);
    if (this.snapshot && next.revision <= this.snapshot.revision) throw Error('Out-of-order graph snapshot');
    this.validate(next);
    this.snapshot = next;
    return next;
  }
  apply(delta: GraphDelta): GraphSnapshot {
    if (!this.snapshot || delta.baseRevision !== this.snapshot.revision) throw Error('Graph delta revision mismatch: request a snapshot');
    if (delta.nextRevision <= delta.baseRevision) throw Error('Graph delta revision must increase');
    const symbols = new Map(this.snapshot.symbols.map(s => [s.id,s]));
    const relations = new Map(this.snapshot.relations.map(e => [e.id,e]));
    for (const id of delta.removeSymbolIds) symbols.delete(id);
    for (const item of delta.upsertSymbols) symbols.set(item.id, item);
    for (const id of delta.removeRelationIds) relations.delete(id);
    for (const item of delta.upsertRelations) relations.set(item.id, item);
    return this.replace({ ...this.snapshot, revision: delta.nextRevision, sourceVersions: delta.sourceVersions,
      diagnostics: delta.diagnostics, availability: delta.availability, symbols: [...symbols.values()], relations: [...relations.values()] });
  }
  query(id: string): { symbol: GraphSnapshot['symbols'][number] | undefined; incoming: GraphSnapshot['relations']; outgoing: GraphSnapshot['relations'] } {
    const graph = this.snapshot;
    return { symbol: graph?.symbols.find(s => s.id === id), incoming: graph?.relations.filter(e => e.toSymbolId === id) ?? [],
      outgoing: graph?.relations.filter(e => e.fromSymbolId === id) ?? [] };
  }
  private validate(g: GraphSnapshot): void {
    const ids = new Set<string>();
    for (const s of g.symbols) {
      if (ids.has(s.id)) throw Error(`Duplicate semantic symbol ${s.id}`);
      ids.add(s.id);
      if (s.location.span.start.line > s.location.span.end.line) throw Error(`Reversed range on ${s.id}`);
      if (s.location.span.start.line === s.location.span.end.line && s.location.span.start.utf16Column > s.location.span.end.utf16Column) throw Error(`Reversed column on ${s.id}`);
    }
    for (const s of g.symbols) if (s.parentId && !ids.has(s.parentId)) throw Error(`Unknown parent ${s.parentId}`);
    const edges = new Set<string>();
    for (const e of g.relations) {
      if (edges.has(e.id)) throw Error(`Duplicate relation ${e.id}`);
      edges.add(e.id);
      if (!ids.has(e.fromSymbolId) || (e.toSymbolId && !ids.has(e.toSymbolId))) throw Error(`Dangling relation ${e.id}`);
      const evidence = new Set<string>();
      for (const site of e.evidence) { if (evidence.has(site.id)) throw Error(`Duplicate evidence ${site.id}`); evidence.add(site.id); }
    }
  }
}
