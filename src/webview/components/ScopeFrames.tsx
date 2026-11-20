import React,{useMemo} from 'react';
import {ViewportPortal} from '@xyflow/react';
import {scopeFrames} from '../../shared/semanticVisuals';
import type {UmlFlowNode} from './UmlNode';
/** Semantic file boundaries occupy the same transform as the graph. They have no hitbox,
 * do not change node positions, and never intercept drag/scroll gestures. */
export function ScopeFrames({nodes,enabled}:{nodes:UmlFlowNode[];enabled:boolean}){
  const frames=useMemo(()=>enabled?scopeFrames(nodes.filter(n=>!n.hidden).map(n=>({
    id:n.id,uri:n.data.symbol.uri,x:n.position.x,y:n.position.y,
    width:n.measured?.width??(n.data.detail===3?460:316),height:n.measured?.height??150,
  }))):[],[nodes,enabled]);
  if(!frames.length)return null;
  return <ViewportPortal>{frames.map(frame=><div key={frame.id} className="scope-frame" aria-hidden="true"
    style={{left:frame.x,top:frame.y,width:frame.width,height:frame.height}}>
    <span className="scope-frame-label"><i className="codicon codicon-file-code"/> {frame.label}<b>{frame.count}</b></span>
  </div>)}</ViewportPortal>;
}
