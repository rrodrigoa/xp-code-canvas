import { describe, expect, it } from 'vitest';
import graphFixture from '../fixtures/sample-graph.json';
import { traceGraph, symbolAt } from '../../src/shared/graph';
import { initialLayout, realignFile } from '../../src/shared/layout';
import { DEFAULT_CANVAS_STATE, type SourceGraph } from '../../src/shared/types';
const graph = graphFixture as SourceGraph;
const find = (name: string) => graph.nodes.find(n => n.qualifiedName === name)!;

describe('source grounded navigation and graph state', () => {
  it('traces callers and callees without reversing arrows', () => {
    const target = find('tools.search');
    const incoming = traceGraph(graph, target.id, 'incoming');
    expect(incoming.nodes).toContain(find('agent.Agent.execute').id);
    const outbound = traceGraph(graph, find('agent.Agent.execute').id, 'outgoing');
    expect(outbound.nodes).toContain(target.id);
    expect(traceGraph(graph, target.id, 'outgoing').nodes).toEqual([target.id]);
  });
  it('focuses the deepest applicable symbol at a cursor', () => {
    const execute = find('agent.Agent.execute');
    expect(symbolAt(graph, execute.uri, execute.range.startLine)?.id).toBe(execute.id);
  });
  it('pinned positions survive layout recalculation but explicit align resets focused pin', () => {
    const agent = find('agent.Agent');
    const pinned = { [agent.id]: { x: 111, y: 333 } };
    const focus = { ...DEFAULT_CANVAS_STATE, focusedFile: agent.uri, pinned };
    expect(initialLayout(graph, focus)[agent.id]).toEqual(pinned[agent.id]);
    const reset = realignFile(graph, focus);
    expect(reset.pinned[agent.id]).toBeUndefined();
    expect(initialLayout(graph, reset)[agent.id].x).toBe(440);
  });
});
