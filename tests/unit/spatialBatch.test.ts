import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {SpatialEdgeBatch} from '../../src/webview/components/spatial/SpatialEdgeBatch';
import {createSpatialEdge,updateSpatialEdge,disposeSpatialEdge,spatialTheme} from '../../src/webview/components/spatial/SpatialVisuals';
describe('spatial relationship batching',()=>{
  it('keeps every relation and marker in grouped draws and retains source picking objects',()=>{
    const theme=spatialTheme();
    const objects=(['calls','imports','inherits','realizes','creates','references','contains'] as const).map((kind,i)=>{
      const relation={id:kind,kind,source:'a',target:'b',confidence:'resolved' as const,evidence:[]};
      const edge=createSpatialEdge(relation,false,false,theme);updateSpatialEdge(edge,{start:{x:0,y:i*20,z:0},end:{x:400,y:i*20,z:20}},relation);return edge;
    });
    const batch=new SpatialEdgeBatch();batch.rebuild(objects);
    expect(batch.children.length).toBeGreaterThan(0);expect(batch.children.length).toBeLessThan(objects.length*2);
    const vertices=batch.children.reduce((sum,c)=>sum+(c as THREE.LineSegments).geometry.getAttribute('position').count,0);
    expect(vertices).toBeGreaterThan(objects.reduce((sum,e)=>sum+e.userData.segments.geometry.getAttribute('position').count,0));
    expect(objects.every(e=>!e.userData.segments.visible&&e.children.length===2)).toBe(true);
    const raycaster=new THREE.Raycaster(new THREE.Vector3(1,0,100),new THREE.Vector3(0,0,-1));
    expect(raycaster.intersectObject(objects[0],true).length).toBeGreaterThan(0);
    batch.rebuild([]);expect(batch.children).toHaveLength(0);batch.release();objects.forEach(disposeSpatialEdge);
  });
});
