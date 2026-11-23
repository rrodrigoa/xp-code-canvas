import {describe,it,expect} from 'vitest';
import {DEFAULT_SEMANTIC_ZOOM_STOPS,updateSemanticZoomStop,validSemanticZoomStops,zoomTrackFraction,zoomFromTrackFraction} from '../../src/shared/semanticZoom';
import {detailForNode,detailForZoom} from '../../src/shared/semanticVisuals';

describe('V7.1 adjustable semantic zoom',()=>{
  it('preserves the existing three transition defaults',()=>{
    expect([.4,.8,1.4,2.1].map(z=>detailForZoom(z,false,DEFAULT_SEMANTIC_ZOOM_STOPS))).toEqual([0,1,2,3]);
    expect(detailForNode(2.2,false,false)).toBe(2);
  });
  it('moving transitions actually changes the detail tier and selected source threshold',()=>{
    const stops:[number,number,number]=[.9,1.6,2.4];
    expect(detailForZoom(1.4,false,stops)).toBe(1);
    expect(detailForZoom(2,false,stops)).toBe(2);
    expect(detailForNode(2.2,false,true,stops)).toBe(2);
    expect(detailForNode(2.5,false,true,stops)).toBe(3);
    expect(detailForNode(.4,true,false,stops)).toBe(3);
  });
  it('rejects overlap, clamps keyboard and drag inputs, supports log rail',()=>{
    const stops=DEFAULT_SEMANTIC_ZOOM_STOPS;
    expect(updateSemanticZoomStop(stops,1,999)[1]).toBeCloseTo(stops[2]-.08);
    expect(updateSemanticZoomStop(stops,1,-999)[1]).toBeCloseTo(stops[0]+.08);
    expect(validSemanticZoomStops([.4,.5,2])).toBe(true);
    expect(validSemanticZoomStops([.8,.79,2])).toBe(false);
    expect(validSemanticZoomStops([.8,1.1,3])).toBe(false);
    for(const z of [.28,.45,.64,1,1.88,2.8])expect(zoomFromTrackFraction(zoomTrackFraction(z))).toBeCloseTo(z,8);
  });
});
