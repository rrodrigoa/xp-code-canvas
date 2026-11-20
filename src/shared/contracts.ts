import { z } from 'zod';
import type { SourceGraph } from './types';

const location = z.object({
  startLine: z.number().int().nonnegative(), startCharacter: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(), endCharacter: z.number().int().nonnegative(),
}).passthrough();

export const graphProtocolV1 = z.object({
  schema: z.literal(1),
  nodes: z.array(z.object({
    id: z.string(), kind: z.enum(['module','class','function','method','property','external']),
    name: z.string(), qualifiedName: z.string(), uri: z.string(), root: z.string(),
    range: location, selectionRange: location, source: z.string(),
    version: z.number().int(), module: z.string(), moduleId: z.string(),
    confidence: z.enum(['resolved','ambiguous','unresolved']),
    structuralHash: z.string().optional(),
  }).passthrough()).max(150_000),
  edges: z.array(z.object({
    id: z.string(), source: z.string(), target: z.string(),
    kind: z.enum(['imports','calls','creates','inherits','references','contains','realizes']),
    confidence: z.enum(['resolved','ambiguous','unresolved']),
    evidence: z.array(z.object({ uri: z.string(), range: location, version: z.number().int(), language: z.string(), adapter: z.string() }).passthrough()),
  }).passthrough()).max(450_000),
  diagnostics: z.array(z.object({ uri: z.string(), severity: z.string(), message: z.string(), line: z.number().int() }).passthrough()),
}).passthrough();

export function parseGraph(value: unknown): SourceGraph {
  return graphProtocolV1.parse(value) as unknown as SourceGraph;
}
