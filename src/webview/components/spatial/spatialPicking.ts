import * as THREE from 'three';
import type {Vector3} from '../../../shared/spatialGraph';
export interface PickNode extends Vector3{id:string;}
export interface PickLink{id:string;source:string|PickNode;target:string|PickNode;}
/** Screen-space broad phase for large graphs. It keeps pointer work linear in
 * symbols/relations instead of ray-testing every individual dash on every frame. */
export function pickSpatialGraph(x:number,y:number,width:number,height:number,camera:THREE.Camera,nodes:readonly PickNode[],links:readonly PickLink[],scaleFor:(id:string)=>THREE.Vector3|undefined):{nodeId?:string;edgeId?:string}{
  const projected=new Map<string,{x:number;y:number;z:number}>();
  let selected:string|undefined,depth=Infinity;
  const point=new THREE.Vector3(),right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  for(const n of nodes){
    point.set(n.x,n.y,n.z).project(camera);if(point.z<-1||point.z>1)continue;
    const screen={x:(point.x+1)*width/2,y:(1-point.y)*height/2,z:point.z};projected.set(n.id,screen);
    const scale=scaleFor(n.id);const size=scale?.x??12;
    point.set(n.x,n.y,n.z).addScaledVector(right,size/2).project(camera);
    const halfWidth=Math.max(4,Math.abs((point.x+1)*width/2-screen.x));
    const halfHeight=Math.max(4,halfWidth*(scale?.y??12)/size);
    if(Math.abs(x-screen.x)<=halfWidth&&Math.abs(y-screen.y)<=halfHeight&&screen.z<depth){selected=n.id;depth=screen.z;}
  }
  if(selected)return {nodeId:selected};
  let nearest=6,edgeId:string|undefined;
  for(const link of links){
    const a=projected.get(typeof link.source==='string'?link.source:link.source.id),b=projected.get(typeof link.target==='string'?link.target:link.target.id);if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/length)):0;
    const distance=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
    if(distance<nearest){nearest=distance;edgeId=link.id;}
  }
  return {edgeId};
}
