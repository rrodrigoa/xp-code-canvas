import {Position,type NodeHandle} from '@xyflow/react';
import type {EdgeKind} from '../../shared/types';
import type {MemberPort} from './MemberPortProjection';
import {portForRelationship,portOffset} from './EdgeRoutingService';
/** Initial offscreen geometry uses the same typed ports as the real card.
 * React Flow replaces it with DOM measurements when the card enters view. */
export function estimatedHandles(width:number,height:number,kinds:EdgeKind[],members:MemberPort[]):NodeHandle[]{
  const handles:NodeHandle[]=[];
  for(const kind of kinds)for(const type of ['source','target'] as const){
    handles.push({id:portForRelationship(kind,type),type,position:type==='source'?Position.Right:Position.Left,
      x:type==='source'?width-5:-5,y:height*portOffset(kind)/100-5,width:10,height:10});
  }
  for(const member of members){
    const siblings=members.filter(p=>p.side===member.side),index=siblings.indexOf(member);
    handles.push({id:member.id,type:member.side,position:member.side==='source'?Position.Right:Position.Left,
      x:member.side==='source'?width-5:-5,y:height*(25+(index+1)/(siblings.length+1)*53)/100-5,width:10,height:10});
  }
  return handles;
}
