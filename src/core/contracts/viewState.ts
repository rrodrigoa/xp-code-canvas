/** Defensive validation for persistent state and messages crossing the webview boundary. */
import { z } from 'zod';
import { DEFAULT_CANVAS_STATE, type CanvasState } from '../../shared/types';
const xy=z.object({x:z.number().finite().min(-1e7).max(1e7),y:z.number().finite().min(-1e7).max(1e7)});
const viewport=xy.extend({zoom:z.number().finite().min(.1).max(8)});
const edge=z.enum(['imports','calls','creates','inherits','references','contains','realizes']);
export const viewStateSchema=z.object({
  schema:z.literal(1), altitude:z.enum(['architecture','package','module','code']),
  focusedFile:z.string().max(4096).nullable(), selectedNode:z.string().max(256).nullable(),
  zoom:z.number().finite().min(.1).max(8),viewport,
  expanded:z.array(z.string().max(256)).max(10000), pinned:z.record(xy), manualPositions:z.record(xy),
  edgeKinds:z.array(edge).max(7),trace:z.enum(['all','incoming','outgoing']),traceDepth:z.number().int().min(1).max(20),
  history:z.array(z.string().max(256)).max(500),historyIndex:z.number().int().min(-1).max(500), explodeMethods:z.boolean(),
  altitudeViewports:z.record(viewport).optional(),
  layoutMode:z.enum(['architecture','file','investigation','change']).optional(),
  layoutPositions:z.record(z.record(xy)).optional(),
  lens:z.enum(['uml','sankey']).optional(),flowKind:z.enum(['calls','imports','references','creates']).optional(),
}).strict();
export function validateViewState(value:unknown):CanvasState {
  const input=viewStateSchema.parse(value);
  if(Object.keys(input.pinned).length>20000 || Object.keys(input.manualPositions).length>20000)throw Error('Too many stored node positions');
  if(Object.entries(input.layoutPositions??{}).some(([key,value])=>!['architecture','file','investigation','change'].includes(key)||Object.keys(value).length>12000))throw Error('Invalid layout snapshots');
  return input as CanvasState;
}
export function recoverViewState(value:unknown):CanvasState {
  const recovered=viewStateSchema.safeParse({...DEFAULT_CANVAS_STATE,...(typeof value==='object' && value!==null?value:{})});
  return recovered.success ? recovered.data as CanvasState : DEFAULT_CANVAS_STATE;
}
export const fromWebviewSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('ready')}),
  z.object({type:z.literal('openNode'),nodeId:z.string().max(256)}),
  z.object({type:z.literal('selectNode'),nodeId:z.string().max(256)}),
  z.object({type:z.literal('focusFile'),uri:z.string().max(4096)}),
  z.object({type:z.literal('state'),state:viewStateSchema}),
  z.object({type:z.literal('command'),command:z.enum(['align','fit','reset','explode','reload'])}),
  z.object({type:z.literal('gitDiff'),baseline:z.string().max(120)}),
  z.object({type:z.literal('getGitHistory'),limit:z.number().int().min(1).max(160).optional()}),
  z.object({type:z.literal('getGitBlame'),nodeId:z.string().max(256)}),
  z.object({type:z.literal('openSourceRegion'),nodeId:z.string().max(256),regionId:z.string().max(120)}),
  z.object({type:z.literal('getSourcePreview'),nodeId:z.string().max(256),requestId:z.string().max(256),expectedHash:z.string().max(128)}),
]);
