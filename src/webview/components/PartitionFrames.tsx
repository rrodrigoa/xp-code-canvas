import React,{useMemo} from 'react';
import {ViewportPortal} from '@xyflow/react';
import type {UmlFlowNode} from './UmlNode';
import type {LayoutMode,SourceGraph} from '../../shared/types';
import {classPartitions,communityPartitions,reviewPartitions,folderOf} from '../../shared/spatialGraph';

/** Presentation-only labeled partitions; never changes source facts or node positions. */
export function PartitionFrames({nodes,graph,mode}:{nodes:UmlFlowNode[];graph:SourceGraph;mode:LayoutMode}){
  const frames=useMemo(()=>{
    if(!['folder','class','community','review'].includes(mode))return [];
    const keys=mode==='class'?classPartitions(graph):mode==='community'?communityPartitions(graph):mode==='review'?reviewPartitions(graph):null;
    const groups=new Map<string,UmlFlowNode[]>();
    for(const node of nodes){if(node.hidden)continue;
      const key=mode==='folder'?folderOf(node.data.symbol):keys?.get(node.id)??'(other)';
      groups.set(key,[...(groups.get(key)??[]),node]);
    }
    return [...groups.entries()].filter(([,items])=>items.length>=2)
      .sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,90)
      .map(([key,items])=>{
        const x=Math.min(...items.map(n=>n.position.x))-28,y=Math.min(...items.map(n=>n.position.y))-44;
        const right=Math.max(...items.map(n=>n.position.x+(n.measured?.width??n.data.cardWidth??320)))+28;
        const bottom=Math.max(...items.map(n=>n.position.y+(n.measured?.height??170)))+28;
        const label=mode==='folder'?key.split('/').slice(-2).join('/'):
          mode==='class'?items.find(n=>n.data.symbol.kind==='class')?.data.symbol.name??key.replace('class:',''):
          mode==='review'?key.replace(/^\d-/,'').replaceAll('-',' '):`Community ${key.replace('community:','').slice(-12)}`;
        return {id:key,x,y,width:right-x,height:bottom-y,label,count:items.length};
      });
  },[nodes,graph,mode]);
  if(!frames.length)return null;
  return <ViewportPortal>{frames.map(frame=><div key={frame.id} className={`partition-frame partition-${mode}`} aria-hidden="true"
    style={{left:frame.x,top:frame.y,width:frame.width,height:frame.height}}>
    <span className="partition-frame-label"><i className="codicon codicon-symbol-namespace"/>{frame.label}<b>{frame.count}</b></span>
  </div>)}</ViewportPortal>;
}
