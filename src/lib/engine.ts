import type {BoardState,Issue,Point,Puzzle,Result} from './model'
import {pads} from './puzzle'
import {distance,pointInRect,segmentInRect,traceSegments} from './geometry'
import {connectedComponents} from './connectivity'

export function evaluate(p:Puzzle,state:BoardState):Result {
  const allPads=pads(p,state),components=connectedComponents(allPads,state),issues:Issue[]=[]
  let viaCount=0,length=0
  for(const trace of state.traces){for(let i=1;i<trace.nodes.length;i++){
    const a=trace.nodes[i-1],b=trace.nodes[i]
    if(a.layer!==b.layer){viaCount++}
    else length+=distance(a,b)
  }}
  const groups=new Map<number,{nets:Set<string>;points:Point[]}>()
  for(const pad of allPads){const root=components.get(pad.id)!;const group=groups.get(root)??{nets:new Set<string>(),points:[]};group.nets.add(pad.net);group.points.push(pad);groups.set(root,group)}
  let shorts=0,missing=0
  for(const g of groups.values())if(g.nets.size>1){shorts++;issues.push({kind:'short',message:`ショート: ${[...g.nets].join(' / ')}`,point:g.points[0],fatal:true})}
  const mcu=new Map(allPads.filter(x=>x.kind==='mcu').map(x=>[x.net,components.get(x.id)]))
  for(const pad of allPads.filter(x=>x.kind!=='mcu'&&!x.net.startsWith('LINK:'))){if(components.get(pad.id)!==mcu.get(pad.net)){missing++;issues.push({kind:'disconnected',message:`${pad.label} → MCU 未接続`,point:pad,fatal:true})}}
  for(const sw of p.switches){
    const a=allPads.find(x=>x.id===`${sw.id}:link`)!;const b=allPads.find(x=>x.kind==='diode'&&x.net===`LINK:${sw.id}`)
    if(!b){missing++;issues.push({kind:'diode',message:`${sw.id} のダイオードを配置`,point:{x:sw.x,y:sw.y},fatal:true})}
    else if(components.get(a.id)!==components.get(b.id)){missing++;issues.push({kind:'diode',message:`${sw.id} → 専用ダイオード 未接続`,point:a,fatal:true})}
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
