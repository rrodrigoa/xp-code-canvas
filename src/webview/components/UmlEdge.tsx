import React from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow } from '@xyflow/react';
import type { EdgeProps, Edge } from '@xyflow/react';
import type { GraphEdge } from '../../shared/types';
import { placeEdgeLabel } from '../edgeLabels';
export type UmlFlowEdge=Edge<{relation:GraphEdge;reveal?:boolean;labelPosition?:{x:number;y:number}},'uml'>;
const colorByKind:Record<string,string>={
  inherits:'var(--xp-edge-inheritance)',realizes:'var(--xp-edge-inheritance)',
  calls:'var(--xp-edge-call)',imports:'var(--xp-edge-import)',
  creates:'var(--xp-edge-create)',references:'var(--xp-edge-reference)',contains:'var(--xp-edge-contain)',
};
export function UmlEdgeComponent({id,sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,data,selected}:EdgeProps<UmlFlowEdge>){
  const flow=useReactFlow();
  const relation=data?.relation;
  if(!relation)return null;
  const [path,labelX,labelY]=getSmoothStepPath({sourceX,sourceY,targetX,targetY,sourcePosition,targetPosition,borderRadius:14,offset:32});
  const umlTriangle=['inherits','realizes'].includes(relation.kind);
  const isSolid=relation.kind==='inherits';
  const stroke=colorByKind[relation.kind]??'var(--xp-edge-reference)';
  const marker=`uml-arrow-${id.replace(/[^a-zA-Z0-9]/g,'_')}`;
  const changed=relation.change&&relation.change!=='UNCHANGED';
  const showLabel=Boolean(selected||data?.reveal);
  const boxes=showLabel?flow.getNodes().map(n=>({x:n.position.x,y:n.position.y,width:n.measured?.width??300,height:n.measured?.height??130})):[];
  const label=showLabel?(data?.labelPosition??placeEdgeLabel({x:sourceX,y:sourceY},{x:targetX,y:targetY},boxes,96,{x:labelX,y:labelY})):null;
  return <>
    <defs><marker id={marker} markerWidth="13" markerHeight="13" refX="10.5" refY="6" orient="auto" markerUnits="userSpaceOnUse">
      {umlTriangle?<path d="M2 1 L10 6 L2 11 Z" fill="var(--xp-surface-1)" stroke={stroke} strokeWidth="1.7"/>:<path d="M2 2 L10 6 L2 10" fill="none" stroke={stroke} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>}
    </marker></defs>
    <BaseEdge id={id} path={path} markerEnd={`url(#${marker})`} className={`uml-relation relation-${relation.kind}${changed?' relation-changed':''}`}
      interactionWidth={24} style={{stroke,strokeWidth:selected||data?.reveal?2.7:1.75,
        strokeDasharray:isSolid?undefined:relation.kind==='contains'?'2 5':'6 5',
        opacity:relation.change==='REMOVED'?.34:relation.confidence!=='resolved'?.42:selected||data?.reveal?1:.78}}/>
    {label&&<EdgeLabelRenderer><div className={`edge-label nodrag nopan ${relation.confidence!=='resolved'?'edge-uncertain':''}`} style={{position:'absolute',transform:`translate(-50%, -50%) translate(${label.x}px,${label.y}px)`,pointerEvents:'none'}} role="note"
      title={relation.evidence.map(e=>`${e.uri}:${e.range.startLine+1}`).join('\n')}>
      <span className="edge-label-dot" style={{background:stroke}}/> «{relation.kind}»{(relation.count??1)>1?` ×${relation.count}`:''}{changed?` · ${relation.change?.toLowerCase()}`:''}
    </div></EdgeLabelRenderer>}
  </>;
}
