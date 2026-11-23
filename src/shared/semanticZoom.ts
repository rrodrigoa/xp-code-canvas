/** User-adjustable semantic detail transitions, independent of physical canvas zoom.
 * Bounds match the React Flow range (0.28–2.8); breakpoints must be ordered. */
export type SemanticZoomStops = [number,number,number];
export const DEFAULT_SEMANTIC_ZOOM_STOPS:SemanticZoomStops=[0.64,1.13,1.88];
export const ZOOM_MIN=0.28, ZOOM_MAX=2.8, ZOOM_GAP=0.08;
export function validSemanticZoomStops(value:unknown):value is SemanticZoomStops{
  return Array.isArray(value)&&value.length===3&&value.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n))&&
    value[0]>=ZOOM_MIN+ZOOM_GAP&&value[2]<=ZOOM_MAX-ZOOM_GAP&&
    value[1]-value[0]>=ZOOM_GAP-1e-8&&value[2]-value[1]>=ZOOM_GAP-1e-8;
}
export function updateSemanticZoomStop(stops:SemanticZoomStops,index:number,requested:number):SemanticZoomStops {
  if(!Number.isInteger(index)||index<0||index>2||!Number.isFinite(requested))return stops;
  const low=index===0?ZOOM_MIN+ZOOM_GAP:stops[index-1]+ZOOM_GAP;
  const high=index===2?ZOOM_MAX-ZOOM_GAP:stops[index+1]-ZOOM_GAP;
  const next=[...stops] as SemanticZoomStops;
  next[index]=Math.max(low,Math.min(high,requested));
  return next;
}
/** Track space is logarithmic to give the same proportional travel to each zoom decade. */
export function zoomTrackFraction(zoom:number):number {
  return Math.max(0,Math.min(1,Math.log(Math.max(ZOOM_MIN,Math.min(ZOOM_MAX,zoom))/ZOOM_MIN)/Math.log(ZOOM_MAX/ZOOM_MIN)));
}
export function zoomFromTrackFraction(fraction:number):number {
  return ZOOM_MIN*Math.pow(ZOOM_MAX/ZOOM_MIN,Math.max(0,Math.min(1,fraction)));
}
