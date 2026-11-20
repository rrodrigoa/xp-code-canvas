import { describe, expect, it } from 'vitest';
import graphFixture from '../fixtures/sample-graph.json';
import { overlayChanges, semanticDiff } from '../../src/shared/semanticDiff';
import type { SourceGraph } from '../../src/shared/types';
const original = graphFixture as SourceGraph;

describe('deterministic semantic Git diffs', () => {
  it('reports no differences for same structural fingerprints', () => {
    expect(semanticDiff(original, structuredClone(original)).changes).toHaveLength(0);
  });
  it('marks modifications and upstream impacted callers', () => {
    const modified = structuredClone(original);
    const target = modified.nodes.find(n => n.qualifiedName === 'tools.search')!;
    target.structuralHash = 'structural-change';
    const delta = semanticDiff(original, modified);
    expect(delta.changes.some(c => c.status === 'MODIFIED' && c.id === target.id)).toBe(true);
    expect(delta.impacted).toContain(modified.nodes.find(n => n.qualifiedName === 'agent.Agent.execute')!.id);
  });
  it('keeps removed code as baseline-only ghosts', () => {
    const modified = structuredClone(original);
    const removed = modified.nodes.find(n => n.qualifiedName === 'tools.search')!;
    modified.nodes = modified.nodes.filter(n => n.id !== removed.id);
    const result = overlayChanges(original, modified);
    expect(result.nodes.find(n => n.id === removed.id)).toMatchObject({ baselineOnly: true, change: 'REMOVED' });
  });
});

describe('relationship deltas', () => {
  it('reports a deleted call edge without inventing a replacement', () => {
    const newer = structuredClone(original);
    const removedCall = newer.edges.find(e => e.kind === 'calls')!;
    newer.edges = newer.edges.filter(e => e !== removedCall);
    const overlaid = overlayChanges(original, newer);
    expect(overlaid.edges.find(e => e.id === `ghost_${removedCall.id}`)?.change).toBe('REMOVED');
  });
});
