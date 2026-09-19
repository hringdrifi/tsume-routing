import type {Puzzle,Rotation} from './model'
import {day001,validatePuzzle} from './puzzle'
import {grid} from './geometry'

const FIRST_DAY=Date.UTC(2026,8,19)
export function todayNumber(now=new Date()):number{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now)
  const get=(type:string)=>Number(parts.find(x=>x.type===type)?.value)
  return Math.max(1,Math.floor((Date.UTC(get('year'),get('month')-1,get('day'))-FIRST_DAY)/86400000)+1)
}
export function dailyPuzzle(number:number):Puzzle{
  if(!Number.isInteger(number)||number<1||number>9999)throw Error('問題番号が不正です')
  if(number===1)return day001
  const p=structuredClone(day001)
  p.id=`day${String(number).padStart(3,'0')}`
  p.title=`Daily Route ${String(number).padStart(3,'0')}`
  const variant=number-1
  p.matrix.diodeDirection=variant%2?'ROW2COL':'COL2ROW'
  p.switches=p.switches.map((s,i)=>({...s,rotation:([0,90,180,270][(variant+i*3)%4]) as Rotation}))
  p.keepouts=[{...p.keepouts[0],x:grid(30+(variant*7)%31,48),y:grid(32+(variant*3)%12,48),width:grid(24+(variant%3)*5,48),height:grid(8,48)}]
  const offset=variant%p.mcu.pins.length
  p.mcu.pins=[...p.mcu.pins.slice(offset),...p.mcu.pins.slice(0,offset)]
  return validatePuzzle(p)
}
