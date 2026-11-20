import { describe, it, expect } from 'vitest';
import graphFixture from '../fixtures/sample-graph.json';
import { aggregateGraph, visibleGraph } from '../../src/shared/graph';
import { DEFAULT_CANVAS_STATE, type SourceGraph } from '../../src/shared/types';
const fixture = graphFixture as SourceGraph;

describe('four abstraction altitudes', () => {
  it('preserves code symbol identifiers in code mode', () => {
    expect(aggregateGraph(fixture, 'code')).toBe(fixture);
  });
  it('aggregates modules with real evidence and correct direction', () => {
    const aggregated = aggregateGraph(fixture, 'module');
    expect(aggregated.nodes).toHaveLength(3);
    const modules = new Map(aggregated.nodes.map(n => [n.id, n.name]));
    expect(aggregated.edges.map(e => [modules.get(e.source), modules.get(e.target), e.kind])).toContainEqual(['agent', 'tools', 'calls']);
    expect(aggregated.edges.every(e => e.count! >= 1 && e.memberEdgeIds?.length === e.count)).toBe(true);
  });
  it('groups packages and workspace root without inventing dependencies', () => {
    const packages = aggregateGraph(fixture, 'package');
    const architecture = aggregateGraph(fixture, 'architecture');
    expect(packages.nodes).toHaveLength(1);
    expect(architecture.nodes).toHaveLength(1);
    expect(architecture.edges).toHaveLength(0);
  });
  it('rolls up method edges into class card when not exploded', () => {
    const compact = visibleGraph(fixture, DEFAULT_CANVAS_STATE);
    const agent = compact.nodes.find(n => n.qualifiedName === 'agent.Agent')!;
    const tools = compact.nodes.find(n => n.qualifiedName === 'tools.search')!;
    expect(compact.edges.find(e => e.source === agent.id && e.target === tools.id)?.kind).toBe('calls');
    expect(compact.nodes.some(n => n.qualifiedName === 'agent.Agent.execute')).toBe(false);
    const exploded = visibleGraph(fixture, { ...DEFAULT_CANVAS_STATE, explodeMethods: true });
    expect(exploded.nodes.some(n => n.qualifiedName === 'agent.Agent.execute')).toBe(true);
  });
});
