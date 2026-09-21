import type {BoardState,Pad,Point} from './model'
import {distance,intersections,onSegment,pointKey,traceSegments} from './geometry'

class DSU {
  parent:number[]=[]
  add(){const i=this.parent.length;this.parent.push(i);return i}
  find(n:number):number{return this.parent[n]===n?n:(this.parent[n]=this.find(this.parent[n]))}
  join(a:number,b:number){this.parent[this.find(a)]=this.find(b)}
}

export function connectedComponents(allPads:Pad[],state:BoardState):Map<string,number> {
  const dsu=new DSU(),keys=new Map<string,number>()
  const node=(pt:Point,layer:string)=>{const key=pointKey(pt,layer);if(!keys.has(key))keys.set(key,dsu.add());return keys.get(key)!}
  const segments=state.traces.flatMap(t=>traceSegments(t.nodes))
  const traceNodes=state.traces.flatMap(t=>t.nodes)
  for(const s of segments){
    const points:Point[]=[s.a,s.b]
    for(const pad of allPads)if(onSegment(pad,s.a,s.b))points.push(pad)
    // A via placed directly on an existing trace has no same-layer branch segment
    // of its own. Its node still needs to split the underlying segment electrically.
    for(const point of traceNodes)if(point.layer===s.layer&&onSegment(point,s.a,s.b))points.push(point)
    for(const t of segments)if(s.layer===t.layer)points.push(...intersections(s.a,s.b,t.a,t.b))
    points.sort((a,b)=>distance(a,s.a)-distance(b,s.a))
    for(let i=1;i<points.length;i++)dsu.join(node(points[i-1],s.layer),node(points[i],s.layer))
  }
  for(const trace of state.traces)for(let i=1;i<trace.nodes.length;i++){
    const a=trace.nodes[i-1],b=trace.nodes[i]
    if(a.layer!==b.layer)dsu.join(node(a,a.layer),node(b,b.layer))
  }
  for(const pad of allPads.filter(pad=>pad.kind!=='diode'))dsu.join(node(pad,'F.Cu'),node(pad,'B.Cu'))
  return new Map(allPads.map(pad=>[pad.id,dsu.find(node(pad,'F.Cu'))]))
}
