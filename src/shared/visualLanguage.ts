/** Renderer-neutral visual semantics. 2D SVG and 3D WebGL must consume the
 * same UML relationship grammar; colors are resolved from VS Code theme tokens.
 * Source/review facts are never inferred by renderers. */
import type {EdgeKind,GraphEdge,NodeKind,ChangeStatus} from './types';

export type NodeRole='module'|'class'|'callable'|'data'|'external';
export const nodeRole=(kind:NodeKind):NodeRole=>kind==='module'?'module':kind==='class'?'class':kind==='property'?'data':kind==='external'?'external':'callable';
export const NODE_COLOR_TOKEN:Record<NodeRole,string>={
  module:'--xp-role-module',class:'--xp-role-class',callable:'--xp-role-callable',
  data:'--xp-role-data',external:'--xp-role-external',
};
export const EDGE_COLOR_TOKEN:Record<EdgeKind,string>={
  imports:'--xp-edge-import',calls:'--xp-edge-call',creates:'--xp-edge-create',
  inherits:'--xp-edge-inheritance',realizes:'--xp-edge-inheritance',
  references:'--xp-edge-reference',contains:'--xp-edge-contain',
};
export const CHANGE_COLOR_TOKEN:Partial<Record<ChangeStatus,string>>={
  ADDED:'--xp-added',MODIFIED:'--xp-modified',REMOVED:'--xp-removed',
  IMPACTED:'--xp-impacted',AMBIGUOUS:'--xp-ambiguous',
};
export interface EdgeAppearance {
  colorToken:string; dashed:boolean; dash:number; gap:number;
  marker:'hollow-triangle'|'arrow'; opacity:number; width:number;
}
export function edgeAppearance(edge:Pick<GraphEdge,'kind'|'confidence'|'change'>,selected=false,dimmed=false):EdgeAppearance {
  const kind=edge.kind;
  const dashed=kind!=='inherits'||edge.confidence!=='resolved';
  return {colorToken:edge.change==='ADDED'?'--xp-added':edge.change==='REMOVED'?'--xp-removed':
      edge.change==='MODIFIED'?'--xp-modified':edge.confidence!=='resolved'?'--xp-ambiguous':EDGE_COLOR_TOKEN[kind],
    dashed,dash:kind==='contains'?2:7,gap:kind==='contains'?5:5,
    marker:kind==='inherits'||kind==='realizes'?'hollow-triangle':'arrow',
    opacity:dimmed?.12:edge.change==='REMOVED'?.40:edge.confidence!=='resolved'?.48:selected?1:.80,
    width:selected?2.7:edge.change&&edge.change!=='UNCHANGED'?2.1:1.75};
}
/** Pure zoom calculation, shared by 3D visual LOD and the user's 2D stops. */
export function spatialSemanticZoom(distance:number,reference=960):number{
  if(!Number.isFinite(distance))return .28;
  return Math.max(.28,Math.min(2.8,reference/(Math.max(0,distance)+240)));
}
export function spatialDetail(distance:number,stops:readonly [number,number,number],reference=960):0|1|2|3{
  const z=spatialSemanticZoom(distance,reference);
  return z>=stops[2]?3:z>=stops[1]?2:z>=stops[0]?1:0;
}
