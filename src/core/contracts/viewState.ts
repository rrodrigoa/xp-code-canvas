/** Defensive validation for persistent state and messages crossing the webview boundary. */
import { z } from 'zod';
import { DEFAULT_CANVAS_STATE, type CanvasState } from '../../shared/types';
import {validSemanticZoomStops} from '../../shared/semanticZoom';
const xy=z.object({x:z.number().finite().min(-1e7).max(1e7),y:z.number().finite().min(-1e7).max(1e7)});
const xyz=xy.extend({z:z.number().finite().min(-1e6).max(1e6)});
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
  layoutMode:z.enum(['architecture','file','investigation','change','spread','folder','hub','class','community','review']).optional(),
  semanticZoomStops:z.tuple([z.number(),z.number(),z.number()]).refine(validSemanticZoomStops,'Ordered semantic zoom thresholds required').optional(),
  nodeSizes:z.record(z.object({width:z.number().finite().min(340).max(1400),height:z.number().finite().min(260).max(1600)})).optional(),
  layoutPositions:z.record(z.record(xy)).optional(),
  spatialLayout:z.enum(['force','hub','folder','dependency','size','class','community','review']).optional(),
  spatialPositions:z.record(xyz).optional(),
  spatialCamera:z.object({position:xyz,target:xyz}).optional(),
  lens:z.enum(['uml','sankey','spatial']).optional(),flowKind:z.enum(['calls','imports','references','creates']).optional(),
}).strict();
export function validateViewState(value:unknown):CanvasState {
  const input=viewStateSchema.parse(value);
  if(Object.keys(input.pinned).length>20000 || Object.keys(input.manualPositions).length>20000)throw Error('Too many stored node positions');
  if(Object.entries(input.layoutPositions??{}).some(([key,value])=>!['architecture','file','investigation','change','spread','folder','hub','class','community','review'].includes(key)||Object.keys(value).length>12000))throw Error('Invalid layout snapshots');
  if(Object.keys(input.spatialPositions??{}).length>12000)throw Error('Too many saved 3D symbol positions');
  if(Object.keys(input.nodeSizes??{}).length>3000)throw Error('Too many saved preview dimensions');
  return input as CanvasState;
}
export function recoverViewState(value:unknown):CanvasState {
  const recovered=viewStateSchema.safeParse({...DEFAULT_CANVAS_STATE,...(typeof value==='object' && value!==null?value:{})});
  return recovered.success ? recovered.data as CanvasState : DEFAULT_CANVAS_STATE;
}
const cognitionAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('status'),key:z.string().min(1).max(2048),status:z.enum(['opened','reviewed','needs-evidence','unseen'])}),
  z.object({action:z.literal('question'),key:z.string().min(1).max(2048),body:z.string().min(2).max(4000)}),
  z.object({action:z.literal('answer'),key:z.string().min(1).max(2048),questionId:z.string().min(1).max(256),answered:z.boolean()}),
  z.object({action:z.enum(['bookmark','shelf']),key:z.string().min(1).max(2048),enabled:z.boolean()}),
]);
const reviewTarget=z.object({nodeId:z.string().max(256).optional(),edgeId:z.string().max(256).optional(),uri:z.string().max(4096).optional(),line:z.number().int().min(0).max(10000000).optional(),side:z.enum(['LEFT','RIGHT']).optional(),qualifiedName:z.string().max(1024).optional()}).strict();
const threadId=z.string().min(1).max(320);
const reviewAction=z.discriminatedUnion('action',[
  z.object({action:z.literal('add'),target:reviewTarget,body:z.string().min(1).max(16000)}),
  z.object({action:z.enum(['reply','githubReply']),threadId,body:z.string().min(1).max(16000)}),
  z.object({action:z.enum(['resolve','reopen','delete','githubResolve','githubReopen','githubPost']),threadId}),
  z.object({action:z.enum(['githubEdit','githubDelete']),threadId,commentId:threadId,body:z.string().max(16000).optional()}),
  z.object({action:z.literal('githubSubmit'),event:z.enum(['COMMENT','APPROVE','REQUEST_CHANGES']),body:z.string().max(16000)}),
  z.object({action:z.literal('refresh')}),
  z.object({action:z.enum(['markReviewed','unmarkReviewed']),path:z.string().min(1).max(2048)}),
]);
export const fromWebviewSchema=z.discriminatedUnion('type',[
  z.object({type:z.literal('reviewOpen'),scope:z.enum(['working','unstaged','staged','branch','pr']),reference:z.string().max(160).optional()}),
  z.object({type:z.literal('reviewAction'),action:reviewAction}),
  z.object({type:z.literal('reviewClose')}),
  z.object({type:z.literal('reviewCognition'),action:cognitionAction}),
  z.object({type:z.literal('reviewRevisionsRequest')}),
  z.object({type:z.literal('reviewRevisionLoad'),revision:z.string().min(1).max(64)}),
  z.object({type:z.literal('reviewDiff'),path:z.string().min(1).max(4096)}),
  z.object({type:z.literal('reviewOpenUrl'),url:z.string().url().max(2048)}),
  z.object({type:z.literal('ready')}),
  z.object({type:z.literal('openNode'),nodeId:z.string().max(256),cursor:z.object({line:z.number().int().min(0).max(10000000),character:z.number().int().min(0).max(1000000)}).optional()}),
  z.object({type:z.literal('selectNode'),nodeId:z.string().max(256)}),
  z.object({type:z.literal('focusFile'),uri:z.string().max(4096)}),
  z.object({type:z.literal('state'),state:viewStateSchema}),
  z.object({type:z.literal('command'),command:z.enum(['align','fit','reset','explode','reload'])}),
  z.object({type:z.literal('gitDiff'),baseline:z.string().max(120)}),
  z.object({type:z.literal('getGitHistory'),limit:z.number().int().min(1).max(160).optional()}),
  z.object({type:z.literal('getGitBlame'),nodeId:z.string().max(256)}),
  z.object({type:z.literal('openSourceRegion'),nodeId:z.string().max(256),regionId:z.string().max(120)}),
  z.object({type:z.literal('getSourcePreview'),nodeId:z.string().max(256),requestId:z.string().max(256),expectedHash:z.string().max(128)}),
  z.object({type:z.literal('applyInlineEdit'),nodeId:z.string().max(256),expectedHash:z.string().length(64).regex(/^[0-9a-f]+$/),originalSource:z.string().max(20000),updatedSource:z.string().max(20000)}),
  z.object({type:z.literal('getReviewLineOverlay'),nodeId:z.string().max(256)}),
]);
