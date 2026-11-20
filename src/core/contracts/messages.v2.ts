import { z } from 'zod';
export const requestEnvelopeSchema = z.object({ protocolVersion: z.literal(2), requestId: z.string().min(1).max(120),
  workspaceId: z.string(), graphRevision: z.number().int().nonnegative(),
  type: z.enum(['sourcePreview/get', 'navigation/open', 'graph/query', 'view/statePatch']),
  payload: z.unknown(),
}).strict();
export const responseEnvelopeSchema = z.object({ protocolVersion: z.literal(2), requestId: z.string().min(1),
  graphRevision: z.number().int().nonnegative(), ok: z.boolean(), payload: z.unknown(), error: z.string().optional(),
}).strict();
export type RequestEnvelope = z.infer<typeof requestEnvelopeSchema>;
