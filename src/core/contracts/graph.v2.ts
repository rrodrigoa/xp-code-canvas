/** Canonical source graph (never ReactFlow state, text, or a Git diff overlay). */
import { z } from 'zod';
import * as crypto from 'node:crypto';
import type { SourceGraph } from '../../shared/types';

const position = z.object({ line: z.number().int().nonnegative(), utf16Column: z.number().int().nonnegative().max(100000) }).strict();
const span = z.object({ start: position, end: position }).strict();
export const documentSnapshotSchema = z.object({
  workspaceId: z.string().min(1), uri: z.string().min(1), language: z.literal('python'),
  sourceOrigin: z.enum(['open-buffer', 'disk', 'git-commit', 'git-index']),
  documentVersion: z.number().int().nonnegative().optional(), contentHash: z.string().min(8),
}).strict();
export type DocumentSnapshot = z.infer<typeof documentSnapshotSchema>;
const ref = z.object({ uri: z.string().min(1), documentVersion: z.number().int().nonnegative().optional(), contentHash: z.string(), span, selectionSpan: span }).strict();
const kind = z.enum(['module', 'class', 'function', 'method', 'property', 'external']);
const relationKind = z.enum(['calls', 'imports', 'inherits', 'creates', 'references', 'contains', 'realizes']);
export const symbolSchema = z.object({
  id: z.string().min(8), identityVersion: z.literal(2), workspaceId: z.string(), kind, moduleId: z.string(), parentId: z.string().nullable(),
  name: z.string(), qualifiedName: z.string(), location: ref, signature: z.string(),
  hashes: z.object({ signature: z.string(), body: z.string(), structure: z.string() }).strict(),
  modifiers: z.array(z.string()), stereotype: z.string().nullable(), stale: z.boolean(),
}).strict();
const evidenceSchema = z.object({ id: z.string().min(8), source: ref, producer: z.string(), reason: z.string(), confidence: z.enum(['resolved', 'possible', 'unresolved']) }).strict();
export const relationSchema = z.object({
  id: z.string().min(8), fromSymbolId: z.string(), toSymbolId: z.string().optional(), kind: relationKind,
  evidence: z.array(evidenceSchema).min(1), resolution: z.enum(['exact', 'candidate-set', 'unresolved']), candidateIds: z.array(z.string()).optional(),
}).strict();
export const graphSnapshotSchema = z.object({
  schemaVersion: z.literal(2), workspaceId: z.string(), revision: z.number().int().nonnegative(),
  sourceVersions: z.record(z.string()), symbols: z.array(symbolSchema).max(500000), relations: z.array(relationSchema).max(1000000),
  diagnostics: z.array(z.object({ uri: z.string(), severity: z.string(), message: z.string(), line: z.number() })),
  availability: z.enum(['complete', 'partial', 'stale']),
}).strict();
export type GraphSnapshot = z.infer<typeof graphSnapshotSchema>;
export interface GraphDelta {
  baseRevision: number; nextRevision: number;
  upsertSymbols: GraphSnapshot['symbols']; removeSymbolIds: string[];
  upsertRelations: GraphSnapshot['relations']; removeRelationIds: string[];
  sourceVersions: Record<string,string>; diagnostics: GraphSnapshot['diagnostics']; availability: GraphSnapshot['availability'];
}
const digest = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const pos = (line: number, col: number) => ({ line, utf16Column: col });
const convert = (s: { startLine: number; startCharacter: number; endLine: number; endCharacter: number }) => ({
  start: pos(s.startLine, s.startCharacter), end: pos(s.endLine, s.endCharacter),
});
/** Temporary compatibility adapter. Only accepts source-backed V1 facts; intentionally strips source text. */
export function fromLegacyGraph(graph: SourceGraph, workspaceId: string, revision: number): GraphSnapshot {
  const symbols: GraphSnapshot['symbols'] = graph.nodes.map(node => {
    const contentHash = node.contentHash ?? digest(`${node.uri}:${node.version}:${node.structuralHash ?? ''}`);
    return {
      id: node.id, identityVersion: 2, workspaceId, kind: node.kind, moduleId: node.moduleId,
      parentId: node.parentId, name: node.name, qualifiedName: node.qualifiedName,
      location: { uri: node.uri, documentVersion: node.version, contentHash, span: convert(node.range), selectionSpan: convert(node.selectionRange) },
      signature: node.signature, hashes: { signature: digest(node.signature), body: node.structuralHash ?? '', structure: node.structuralHash ?? '' },
      modifiers: [...node.decorators, ...(node.async_ ? ['async'] : [])], stereotype: node.stereotype ?? null, stale: Boolean(node.stale),
    };
  });
  const nodeIds = new Set(symbols.map(s => s.id));
  const relations: GraphSnapshot['relations'] = graph.edges.map(e => ({
    id: e.id, fromSymbolId: e.source, toSymbolId: e.target, kind: e.kind,
    evidence: e.evidence.map(site => ({ id: site.id ?? digest(JSON.stringify([e.id,site.uri,site.range])), producer: site.adapter,
      reason: e.kind, confidence: e.confidence === 'resolved' ? 'resolved' : e.confidence === 'ambiguous' ? 'possible' : 'unresolved',
      source: { uri: site.uri, documentVersion: site.version, contentHash: site.contentHash ?? '',
        span: convert(site.range), selectionSpan: convert(site.range) } })),
    resolution: e.confidence === 'resolved' ? 'exact' : e.confidence === 'ambiguous' ? 'candidate-set' : 'unresolved',
  }));
  for (const fact of graph.unresolved ?? []) {
    const owner = graph.nodes.find(node => node.id === fact.ownerId);
    if (!owner) continue;
    const location = { uri: owner.uri, documentVersion: owner.version, contentHash: owner.contentHash ?? '',
      span: convert(fact.range), selectionSpan: convert(fact.range) };
    relations.push({ id: digest(JSON.stringify([fact.ownerId,fact.expression,fact.range])), fromSymbolId: fact.ownerId,
      kind: 'calls', resolution: 'unresolved', evidence: [{id:digest(JSON.stringify([fact.ownerId,fact.range,'unresolved'])),
      source: location, producer:'python-ast', reason:`Unresolved dynamic call: ${fact.expression}`,confidence:'unresolved'}] });
  }
  for (const symbol of symbols) if (symbol.parentId !== null && !nodeIds.has(symbol.parentId)) throw Error(`Missing parent ${symbol.parentId}`);
  const snapshot: GraphSnapshot = { schemaVersion: 2, workspaceId, revision, symbols, relations,
    sourceVersions: Object.fromEntries(graph.nodes.filter(n => n.kind === 'module').map(n => [n.uri, n.contentHash ?? digest(`${n.uri}:${n.version}`)])),
    diagnostics: graph.diagnostics, availability: graph.availability ?? (graph.diagnostics.length ? 'partial' : 'complete') };
  return graphSnapshotSchema.parse(snapshot);
}
