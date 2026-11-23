import * as THREE from 'three';
import type {SpatialEdgeObject} from './SpatialVisuals';

/** Batch identical line materials while retaining original edge objects for
 * ForceGraph's source-ID picking. No relation, dash, marker or badge is dropped. */
export class SpatialEdgeBatch extends THREE.Group {
  rebuild(edges:Iterable<SpatialEdgeObject>):void{
    this.release();
    const buckets=new Map<string,{positions:number[];material:THREE.LineBasicMaterial}>();
    const append=(geometry:THREE.BufferGeometry,material:THREE.LineBasicMaterial,matrix?:THREE.Matrix4,strip=false)=>{
      const key=`${material.color.getHexString()}:${material.opacity}`;
      let bucket=buckets.get(key);if(!bucket){bucket={positions:[],material};buckets.set(key,bucket);}
      const attr=geometry.getAttribute('position');if(!attr)return;
      const point=new THREE.Vector3();
      const push=(i:number)=>{point.fromBufferAttribute(attr,i);if(matrix)point.applyMatrix4(matrix);bucket!.positions.push(point.x,point.y,point.z);};
      if(strip){for(let i=1;i<attr.count;i++){push(i-1);push(i);}}
      else for(let i=0;i<attr.count;i++)push(i);
    };
    for(const edge of edges){
      const {segments,arrow}=edge.userData;
      if(!edge.userData.start)continue;
      append(segments.geometry,segments.material as THREE.LineBasicMaterial);segments.visible=false;
      arrow.updateMatrix();
      if(arrow instanceof THREE.Mesh){const geometry=new THREE.EdgesGeometry(arrow.geometry);append(geometry,arrow.material as THREE.LineBasicMaterial,arrow.matrix);geometry.dispose();}
      else if(arrow instanceof THREE.Line)append(arrow.geometry,arrow.material as THREE.LineBasicMaterial,arrow.matrix,true);
      arrow.visible=false;
    }
    for(const {positions,material} of buckets.values()){
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      const lines=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:material.color,transparent:true,opacity:material.opacity,depthWrite:false}));
      lines.raycast=()=>{};this.add(lines);
    }
  }
  release():void{
    for(const child of [...this.children]){const line=child as THREE.LineSegments;line.geometry.dispose();(line.material as THREE.Material).dispose();this.remove(child);}
  }
}
