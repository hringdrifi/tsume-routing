import type {BoardState,Puzzle} from './model'
import {inside} from './puzzle'

const key=(p:Puzzle)=>{const raw=JSON.stringify(p);let hash=2166136261;for(let i=0;i<raw.length;i++){hash^=raw.charCodeAt(i);hash=Math.imul(hash,16777619)}return `tsume-progress-v2:${p.id}:${hash>>>0}`}
export function loadProgress(p:Puzzle):BoardState|null{
  try{
    const raw=localStorage.getItem(key(p));if(!raw)return null
    const s=JSON.parse(raw) as BoardState
    if(!Array.isArray(s.diodes)||s.diodes.length!==p.switches.length||!Array.isArray(s.traces)||s.traces.length>1000||!s.switchRotations||typeof s.switchRotations!=='object')return null
    const ids=new Set(p.switches.map(x=>x.id))
    if(Object.keys(s.switchRotations).length!==ids.size||Object.entries(s.switchRotations).some(([id,r])=>!ids.has(id)||![0,90,180,270].includes(r)))return null
    if(s.diodes.some(d=>!ids.has(d.switchId)||![0,90,180,270].includes(d.rotation)||d.position&&(!inside(p,{x:d.position.x-4,y:d.position.y-4})||!inside(p,{x:d.position.x+4,y:d.position.y+4}))))return null
    if(s.traces.some(t=>typeof t.id!=='string'||!Array.isArray(t.nodes)||t.nodes.length<2||t.nodes.length>1000||t.nodes.some(n=>!inside(p,n)||!['F.Cu','B.Cu'].includes(n.layer))))return null
    return s
  }catch{return null}
}
export function saveProgress(p:Puzzle,s:BoardState){try{localStorage.setItem(key(p),JSON.stringify(s))}catch{/* Storage may be disabled. The active session remains playable. */}}
