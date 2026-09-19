import type {BoardState,Issue,Point,Puzzle,Result} from './model'
import {pads} from './puzzle'
import {distance,intersections,onSegment,pointInRect,pointKey,segmentInRect,traceSegments} from './geometry'

class DSU {parent:number[]=[]; add(){const i=this.parent.length;this.parent.push(i);return i} find(n:number):number{return this.parent[n]===n?n:(this.parent[n]=this.find(this.parent[n]))} join(a:number,b:number){this.parent[this.find(a)]=this.find(b)}}
export function evaluate(p:Puzzle,state:BoardState):Result {
  const allPads=pads(p,state),dsu=new DSU(),keys=new Map<string,number>(),issues:Issue[]=[]
  const node=(pt:Point,layer:string)=>{const key=pointKey(pt,layer);if(!keys.has(key))keys.set(key,dsu.add());return keys.get(key)!}
  const segments=state.traces.flatMap(t=>traceSegments(t.nodes))
  for(const s of segments){
    const points:Point[]=[s.a,s.b]
    for(const pad of allPads)if(onSegment(pad,s.a,s.b))points.push(pad)
    for(const t of segments)if(s.layer===t.layer)points.push(...intersections(s.a,s.b,t.a,t.b))
    points.sort((a,b)=>distance(a,s.a)-distance(b,s.a))
    for(let i=1;i<points.length;i++)dsu.join(node(points[i-1],s.layer),node(points[i],s.layer))
  }
  let viaCount=0,length=0
  for(const trace of state.traces){for(let i=1;i<trace.nodes.length;i++){
    const a=trace.nodes[i-1],b=trace.nodes[i]
    if(a.layer!==b.layer){viaCount++;dsu.join(node(a,a.layer),node(b,b.layer))}
    else length+=distance(a,b)
  }}
  // MX electrical pins are plated through holes. The center positioning hole
  // is non-plated and is deliberately absent from the pad graph.
  for(const pad of allPads.filter(pad=>pad.kind==='switch'))dsu.join(node(pad,'F.Cu'),node(pad,'B.Cu'))
  const groups=new Map<number,{nets:Set<string>;points:Point[]}>()
  for(const pad of allPads){const root=dsu.find(node(pad,'F.Cu'));const group=groups.get(root)??{nets:new Set<string>(),points:[]};group.nets.add(pad.net);group.points.push(pad);groups.set(root,group)}
  let shorts=0,missing=0
  for(const g of groups.values())if(g.nets.size>1){shorts++;issues.push({kind:'short',message:`ショート: ${[...g.nets].join(' / ')}`,point:g.points[0],fatal:true})}
  const mcu=new Map(allPads.filter(x=>x.kind==='mcu').map(x=>[x.net,dsu.find(node(x,'F.Cu'))]))
  for(const pad of allPads.filter(x=>x.kind!=='mcu'&&!x.net.startsWith('LINK:'))){if(dsu.find(node(pad,'F.Cu'))!==mcu.get(pad.net)){missing++;issues.push({kind:'disconnected',message:`${pad.label} → MCU 未接続`,point:pad,fatal:true})}}
  for(const sw of p.switches){
    const a=allPads.find(x=>x.id===`${sw.id}:link`)!;const b=allPads.find(x=>x.kind==='diode'&&x.net===`LINK:${sw.id}`)
    if(!b){missing++;issues.push({kind:'diode',message:`${sw.id} のダイオードを配置`,point:{x:sw.x,y:sw.y},fatal:true})}
    else if(dsu.find(node(a,'F.Cu'))!==dsu.find(node(b,'F.Cu'))){missing++;issues.push({kind:'diode',message:`${sw.id} → 専用ダイオード 未接続`,point:a,fatal:true})}
  }
  let keepout=0
  for(const k of p.keepouts){
    for(const t of state.traces){if(traceSegments(t.nodes).some(s=>segmentInRect(s.a,s.b,k))){keepout++;issues.push({kind:'keepout',message:`${t.id} が ${k.id} に侵入`,point:{x:k.x+k.width/2,y:k.y+k.height/2},fatal:false})}}
    for(const t of state.traces)for(let i=1;i<t.nodes.length;i++)if(t.nodes[i].layer!==t.nodes[i-1].layer&&pointInRect(t.nodes[i],k)){keepout++;issues.push({kind:'keepout',message:`ビアが ${k.id} に侵入`,point:t.nodes[i],fatal:false})}
    for(const d of state.diodes)if(d.position&&pointInRect(d.position,k)){keepout++;issues.push({kind:'keepout',message:`${d.switchId} のダイオードが ${k.id} に侵入`,point:d.position,fatal:false})}
  }
  const north=p.switches.filter(s=>(state.switchRotations?.[s.id]??s.rotation)===p.northRotation).length
  const score=p.scoring.base+(missing+shorts)*p.scoring.connectionError+keepout*p.scoring.keepoutViolation+north*p.scoring.northSwitch+viaCount*p.scoring.via
  return {clear:missing===0&&shorts===0,score,viaCount,length,issues,missing,shorts,keepout,north}
}
