import type {Point,RouteNode,Puzzle} from './model'
export const EPS=1e-6
export const near=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)<EPS
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y)
export const onSegment=(p:Point,a:Point,b:Point)=>Math.abs((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS
export function intersections(a:Point,b:Point,c:Point,d:Point):Point[]{
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx
  if(Math.abs(den)<EPS){if(Math.abs((c.x-a.x)*ry-(c.y-a.y)*rx)>EPS)return [];return [a,b,c,d].filter(p=>onSegment(p,a,b)&&onSegment(p,c,d))}
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den
  return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?[{x:a.x+t*rx,y:a.y+t*ry}]:[]
}
export function snapPath(from:Point,to:Point):Point[]{
  const dx=to.x-from.x,dy=to.y-from.y,adX=Math.abs(dx),adY=Math.abs(dy)
  if(adX<EPS||adY<EPS||Math.abs(adX-adY)<EPS)return [to]
  const diagonal=Math.min(adX,adY)
  const corner={x:from.x+Math.sign(dx)*diagonal,y:from.y+Math.sign(dy)*diagonal}
  return [corner,to]
}
export const KEY_UNIT_MM=19.05
export type GridDenominator=12|24|48
export const GRID_OPTIONS:GridDenominator[]=[48,24,12]
export const gridStep=(denominator:GridDenominator)=>KEY_UNIT_MM/denominator
export const grid=(v:number,denominator:GridDenominator)=>Number((Math.round(v/gridStep(denominator))*gridStep(denominator)).toFixed(6))
export const pointKey=(p:Point,layer:string)=>`${layer}:${p.x.toFixed(5)},${p.y.toFixed(5)}`
export const segmentInRect=(a:Point,b:Point,r:{x:number;y:number;width:number;height:number})=>{
  const minX=r.x,maxX=r.x+r.width,minY=r.y,maxY=r.y+r.height
  const inside=(p:Point)=>p.x>=minX-EPS&&p.x<=maxX+EPS&&p.y>=minY-EPS&&p.y<=maxY+EPS
  if(inside(a)||inside(b))return true
  const corners=[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}]
  return corners.some((c,i)=>intersections(a,b,c,corners[(i+1)%4]).length>0)
}
export const pointInRect=(p:Point,r:{x:number;y:number;width:number;height:number})=>p.x>=r.x-EPS&&p.x<=r.x+r.width+EPS&&p.y>=r.y-EPS&&p.y<=r.y+r.height+EPS
export function traceSegments(nodes:RouteNode[]){return nodes.slice(1).flatMap((n,i)=>n.layer===nodes[i].layer&&!near(n,nodes[i])?[{a:nodes[i],b:n,layer:n.layer}]:[])}
export function inBoard(p:Puzzle,pt:Point){return pt.x>=0&&pt.y>=0&&pt.x<=p.board.width&&pt.y<=p.board.height}
