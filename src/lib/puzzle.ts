import raw from '../data/day001.json'
import type {Puzzle,Point,Pad,BoardState,Rotation} from './model'
import {mxPin} from './mx'
import {grid} from './geometry'

const rotations = [0,90,180,270]
export function validatePuzzle(input:unknown):Puzzle {
  const p=input as Puzzle
  const positive=(n:number)=>Number.isFinite(n)&&n>0
  const finite=(...ns:number[])=>ns.every(Number.isFinite)
  if (!p || typeof p.id!=='string' || !p.id.trim() || p.id.length>80 || typeof p.title!=='string' || p.title.length>120 || !p.board || !positive(p.board.width) || !positive(p.board.height) || p.board.width>500 || p.board.height>500 || !p.matrix || !['COL2ROW','ROW2COL'].includes(p.matrix.diodeDirection) || !Array.isArray(p.switches) || p.switches.length<1 || p.switches.length>100 || !Array.isArray(p.mcu?.pins) || p.mcu.pins.length>40 || !Array.isArray(p.keepouts) || p.keepouts.length>100 || !p.scoring) throw Error('Invalid puzzle structure')
  if (!Number.isInteger(p.matrix.rows) || !Number.isInteger(p.matrix.cols) || p.matrix.rows<1 || p.matrix.cols<1 || !rotations.includes(p.northRotation)) throw Error('Invalid matrix')
  const ids=new Set<string>()
  for (const s of p.switches) {
    if (!s.id || ids.has(s.id) || !rotations.includes(s.rotation) || !Number.isInteger(s.row) || !Number.isInteger(s.col) || s.row<0 || s.row>=p.matrix.rows || s.col<0 || s.col>=p.matrix.cols || !inside(p,{x:s.x-7,y:s.y-7}) || !inside(p,{x:s.x+7,y:s.y+7})) throw Error('Invalid switch')
    ids.add(s.id)
  }
  const roles=new Set<string>()
  if(!inside(p,{x:p.mcu.x-7,y:p.mcu.y-13})||!inside(p,{x:p.mcu.x+12,y:p.mcu.y+13})||!inside(p,{x:p.mcu.x-7,y:p.mcu.y-8+(p.mcu.pins.length-1)*4}))throw Error('Invalid MCU position')
  const pinIds=new Set<string>()
  for (const pin of p.mcu.pins) {if (!pin.id || pinIds.has(pin.id) || !/^((ROW|COL)\d+)$/.test(pin.role) || roles.has(pin.role)) throw Error('Invalid MCU pin');roles.add(pin.role);pinIds.add(pin.id)}
  for(let i=0;i<p.matrix.rows;i++) if(!roles.has(`ROW${i}`)) throw Error('Missing row GPIO')
  for(let i=0;i<p.matrix.cols;i++) if(!roles.has(`COL${i}`)) throw Error('Missing col GPIO')
  for(const k of p.keepouts) if(!k.id || k.type!=='rect' || !positive(k.width) || !positive(k.height) || !finite(k.x,k.y) || !inside(p,{x:k.x,y:k.y}) || !inside(p,{x:k.x+k.width,y:k.y+k.height})) throw Error('Invalid keepout')
  if(!finite(p.scoring.base,p.scoring.connectionError,p.scoring.keepoutViolation,p.scoring.northSwitch,p.scoring.via))throw Error('Invalid scoring')
  return p
}
export function inside(p:Puzzle,pt:Point){return pt.x>=0&&pt.y>=0&&pt.x<=p.board.width&&pt.y<=p.board.height}
export const day001=validatePuzzle(raw)
const rotate=(pt:Point,r:Rotation):Point=>r===0?pt:r===90?{x:-pt.y,y:pt.x}:r===180?{x:-pt.x,y:-pt.y}:{x:pt.y,y:-pt.x}
const offset=(at:Point,delta:Point,r:Rotation):Point=>{const d=rotate(delta,r);return {x:at.x+d.x,y:at.y+d.y}}
export function pads(p:Puzzle,state:BoardState):Pad[] {
  const out:Pad[]=[]
  for(const s of p.switches){
    const at={x:s.x,y:s.y}
    const rotation=state.switchRotations?.[s.id]??s.rotation
    const pin=(index:1|2)=>{const exact=mxPin(at,index,rotation);return {x:grid(exact.x,48),y:grid(exact.y,48)}}
    out.push({...pin(1),id:`${s.id}:col`,label:`${s.id} pin 1 · COL${s.col}`,net:`COL${s.col}`,kind:'switch'})
    out.push({...pin(2),id:`${s.id}:link`,label:`${s.id} pin 2 · diode`,net:`LINK:${s.id}`,kind:'switch'})
    const d=state.diodes.find(d=>d.switchId===s.id)
    if(d?.position){
      const left=offset(d.position,{x:-3,y:0},d.rotation),right=offset(d.position,{x:3,y:0},d.rotation)
      const switchSide=p.matrix.diodeDirection==='COL2ROW'?'anode':'cathode'
      out.push({...left,id:`${s.id}:A`,label:`${s.id} A`,net:switchSide==='anode'?`LINK:${s.id}`:`ROW${s.row}`,kind:'diode'})
      out.push({...right,id:`${s.id}:K`,label:`${s.id} K`,net:switchSide==='cathode'?`LINK:${s.id}`:`ROW${s.row}`,kind:'diode'})
    }
  }
  p.mcu.pins.forEach((pin,i)=>out.push({x:p.mcu.x-7,y:p.mcu.y-8+i*4,id:`MCU:${pin.id}`,label:`${pin.id} ${pin.role}`,net:pin.role,kind:'mcu'}))
  return out
}
