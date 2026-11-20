/** Wheel semantics are intentionally independent of pointer location. */
export function isZoomGesture(event: Pick<WheelEvent, 'ctrlKey'|'metaKey'>):boolean {
  return Boolean(event.ctrlKey || event.metaKey);
}
export function zoomFactor(deltaY:number):number {
  // Normalize high-resolution trackpads and detented mouse wheels, avoid giant jumps.
  return Math.exp(-Math.max(-400,Math.min(400,deltaY))*.0018);
}
export function clampZoom(zoom:number,min=.28,max=2.8):number {
  return Math.min(max,Math.max(min,zoom));
}
/** Keep the world-coordinate under the pointer stationary while zooming. */
export function zoomAroundPointer(
  viewport:{x:number;y:number;zoom:number},
  pointer:{x:number;y:number}, factor:number
):{x:number;y:number;zoom:number} {
  const next=clampZoom(viewport.zoom*factor);
  const ratio=next/viewport.zoom;
  return {zoom:next,x:pointer.x-(pointer.x-viewport.x)*ratio,y:pointer.y-(pointer.y-viewport.y)*ratio};
}
