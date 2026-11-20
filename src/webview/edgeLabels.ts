export interface Rect {x:number;y:number;width:number;height:number}
export interface Point {x:number;y:number}
function intersects(pos:Point,rect:Rect,width=96,height=24):boolean {
  const gap=12;
  return pos.x+width/2+gap>rect.x&&pos.x-width/2-gap<rect.x+rect.width&&
    pos.y+height/2+gap>rect.y&&pos.y-height/2-gap<rect.y+rect.height;
}
/** Find a floating label point away from node bounds, or hide the label if no safe space exists. */
export function placeEdgeLabel(start:Point,end:Point,nodes:Rect[],width=96,preferred?:Point):Point|null {
  const fractions=[.50,.36,.64,.24,.76,.12,.88,.04,.96];
  const dx=end.x-start.x,dy=end.y-start.y;
  const norm=Math.hypot(dx,dy)||1;
  const nx=-dy/norm,ny=dx/norm;
  for(const t of (preferred?[NaN,...fractions]:fractions)){
    const base=Number.isNaN(t)&&preferred?preferred:{x:start.x+dx*t,y:start.y+dy*t};
    for(const offset of [0,26,-26,50,-50]){
      const point={x:base.x+offset*nx,y:base.y+offset*ny};
      if(nodes.every(rect=>!intersects(point,rect,width)))return point;
    }
  }
  return null;
}
