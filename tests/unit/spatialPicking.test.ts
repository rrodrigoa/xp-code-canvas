import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {pickSpatialGraph} from '../../src/webview/components/spatial/spatialPicking';
describe('large graph pointer projection',()=>{
  it('picks frontmost node identities, relationships and empty space without testing dashes',()=>{
    const camera=new THREE.PerspectiveCamera(60,1,1,2000);camera.position.set(0,0,500);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    const nodes=[{id:'back',x:0,y:0,z:0},{id:'front',x:0,y:0,z:40},{id:'a',x:-100,y:100,z:0},{id:'b',x:100,y:100,z:0}];
    const links=[{id:'edge',source:'a',target:'b'}];
    const scale=()=>new THREE.Vector3(12,12,1);
    expect(pickSpatialGraph(250,250,500,500,camera,nodes,links,scale).nodeId).toBe('front');
    const p=new THREE.Vector3(0,100,0).project(camera);
    expect(pickSpatialGraph(250,(1-p.y)*250,500,500,camera,nodes,links,scale).edgeId).toBe('edge');
    expect(pickSpatialGraph(1,1,500,500,camera,nodes,links,scale)).toEqual({edgeId:undefined});
  });
});
