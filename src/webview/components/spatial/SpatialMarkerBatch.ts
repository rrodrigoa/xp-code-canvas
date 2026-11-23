import * as THREE from 'three';
import {nodeRole} from '../../../shared/visualLanguage';
import type {VisualNode} from '../../../shared/visualizationProjection';
import type {SpatialTheme,CardSprite} from './SpatialVisuals';

/** One GPU draw for distant markers. Original source-ID sprites retain picking. */
export class SpatialMarkerBatch extends THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>{
  constructor(){super(new THREE.BufferGeometry(),new THREE.PointsMaterial({size:12,vertexColors:true,transparent:true,depthWrite:false}));this.raycast=()=>{};}
  rebuild(nodes:readonly {id:string;x:number;y:number;z:number;v:VisualNode}[],sprites:Map<string,CardSprite>,theme:SpatialTheme):void{
    const positions:number[]=[],colors:number[]=[];
    for(const node of nodes){const sprite=sprites.get(node.id);if(!sprite)continue;
      const far=sprite.userData.tier===0;sprite.visible=!far;
      if(far){const c=new THREE.Color(theme.roles[nodeRole(node.v.symbol.kind)]);positions.push(node.x,node.y,node.z);colors.push(c.r,c.g,c.b,node.v.dimmed?.24:.92);}
    }
    this.geometry.dispose();this.geometry=new THREE.BufferGeometry();
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));this.geometry.computeBoundingSphere();
  }
  release():void{this.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
