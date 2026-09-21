import type {BoardState,Pad} from './model'
import {connectedComponents} from './connectivity'
import {distance} from './geometry'

export type Airwire={from:Pad;to:Pad;net:string}

export function ratsnest(allPads:Pad[],state:BoardState):Airwire[] {
  const connected=connectedComponents(allPads,state)
  const byNet=new Map<string,Pad[]>()
  for(const pad of allPads)byNet.set(pad.net,[...(byNet.get(pad.net)??[]),pad])
  const wires:Airwire[]=[]
  for(const [net,netPads] of byNet){
    const candidates:Airwire[]=[]
    for(let i=0;i<netPads.length;i++)for(let j=i+1;j<netPads.length;j++){
      const from=netPads[i],to=netPads[j]
      if(connected.get(from.id)!==connected.get(to.id))candidates.push({from,to,net})
    }
    candidates.sort((a,b)=>distance(a.from,a.to)-distance(b.from,b.to))
    const parent=new Map<number,number>()
    const root=(id:number):number=>{const p=parent.get(id)??id;return p===id?id:root(p)}
    for(const wire of candidates){
      const a=root(connected.get(wire.from.id)!),b=root(connected.get(wire.to.id)!)
      if(a===b)continue
      parent.set(a,b)
      wires.push(wire)
    }
  }
  return wires
}
