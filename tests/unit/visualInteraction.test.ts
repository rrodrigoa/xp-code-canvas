import { describe,it,expect } from 'vitest';
import { zoomAroundPointer,clampZoom,isZoomGesture,zoomFactor } from '../../src/webview/interaction';
import { placeEdgeLabel } from '../../src/webview/edgeLabels';

describe('V3 scroll and zoom contract',()=>{
  it('reserves zoom for Ctrl/Cmd + wheel regardless of mouse location',()=>{
    expect(isZoomGesture({ctrlKey:false,metaKey:false})).toBe(false);
    expect(isZoomGesture({ctrlKey:true,metaKey:false})).toBe(true);
    expect(isZoomGesture({ctrlKey:false,metaKey:true})).toBe(true);
    expect(zoomFactor(-100)).toBeGreaterThan(1);
    expect(zoomFactor(100)).toBeLessThan(1);
  });
  it('keeps the point beneath the cursor stationary when zooming',()=>{
    const previous={x:105,y:-90,zoom:1.2};const pointer={x:400,y:250};
    const next=zoomAroundPointer(previous,pointer,1.3);
    const worldPrevious={x:(pointer.x-previous.x)/previous.zoom,y:(pointer.y-previous.y)/previous.zoom};
    const worldNext={x:(pointer.x-next.x)/next.zoom,y:(pointer.y-next.y)/next.zoom};
    expect(worldNext.x).toBeCloseTo(worldPrevious.x,8);
    expect(worldNext.y).toBeCloseTo(worldPrevious.y,8);
  });
  it('limits zoom to safe canvas boundaries',()=>{
    expect(clampZoom(.00001)).toBe(.28);expect(clampZoom(100)).toBe(2.8);
  });
});
describe('edge label overlap avoidance',()=>{
  it('avoids node rectangles when labels are exposed on hover',()=>{
    const blocked=[{x:90,y:80,width:190,height:85}];
    const point=placeEdgeLabel({x:0,y:125},{x:500,y:125},blocked,90);
    expect(point).not.toBeNull();
    expect(point!.x+45<90||point!.x-45>280||point!.y+12<80||point!.y-12>165).toBe(true);
  });
  it('hides a label when there is no collision-free placement',()=>{
    expect(placeEdgeLabel({x:10,y:10},{x:20,y:20},[{x:-100,y:-100,width:300,height:300}])).toBeNull();
  });
});
