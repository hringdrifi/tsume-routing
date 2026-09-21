import {describe,expect,it} from 'vitest'
import {evaluate} from './engine'
import {validatePuzzle,pads} from './puzzle'
import type {BoardState,RouteNode} from './model'

const puzzle=validatePuzzle({id:'test',title:'Test',board:{width:50,height:45},matrix:{rows:1,cols:1,diodeDirection:'COL2ROW'},northRotation:0,switches:[{id:'SW1',x:12,y:12,rotation:90,row:0,col:0}],mcu:{x:37,y:25,pins:[{number:1,role:'ROW0'},{number:2,role:'COL0'}]},keepouts:[{id:'KO',type:'rect',x:19,y:30,width:5,height:5}],scoring:{base:100,connectionError:-10,keepoutViolation:-5,northSwitch:-3,via:-1}})
const route=(id:string,points:{x:number;y:number}[],layer:'F.Cu'|'B.Cu'='F.Cu')=>({id,nodes:points.map(p=>({...p,layer}))})
function solved():BoardState{
  const state:BoardState={diodes:[{switchId:'SW1',position:{x:24,y:12},rotation:0}],traces:[],switchRotations:{SW1:90}}
  const byId=Object.fromEntries(pads(puzzle,state).map(p=>[p.id,p]))
  state.traces=[
    route('col',[byId['SW1:col'],{x:5,y:8},{x:5,y:41},{x:36,y:41},byId['MCU:2']]),
    route('link',[byId['SW1:link'],{x:18,y:16},byId['SW1:A']]),
    route('row',[byId['SW1:K'],{x:28,y:5},{x:45,y:5},{x:45,y:17},byId['MCU:1']])
  ]
  return state
}
describe('electrical and scoring',()=>{
  it('clears a complete matrix',()=>{const r=evaluate(puzzle,solved());expect(r.clear).toBe(true);expect(r.missing).toBe(0);expect(r.shorts).toBe(0)})
  it('finds a disconnected ROW',()=>{const s=solved();s.traces.pop();const r=evaluate(puzzle,s);expect(r.clear).toBe(false);expect(r.missing).toBeGreaterThan(0)})
  it('finds a COL to ROW short',()=>{const s=solved();const p=pads(puzzle,s);const col=p.find(x=>x.id==='SW1:col')!,row=p.find(x=>x.id==='SW1:K')!;s.traces.push(route('short',[col,row]));expect(evaluate(puzzle,s).shorts).toBeGreaterThan(0)})
  it('connects both layers through plated MX pins without a via',()=>{const s=solved();const p=pads(puzzle,s);const col=p.find(x=>x.id==='SW1:col')!,link=p.find(x=>x.id==='SW1:link')!;s.traces.push(route('short-back',[col,link],'B.Cu'));const r=evaluate(puzzle,s);expect(r.viaCount).toBe(0);expect(r.shorts).toBeGreaterThan(0)})
  it('uses the rotated switch pins and orientation penalty',()=>{const s=solved();const before=pads(puzzle,s).find(p=>p.id==='SW1:col')!;s.switchRotations.SW1=0;const after=pads(puzzle,s).find(p=>p.id==='SW1:col')!;expect(after).not.toEqual(before);expect(evaluate(puzzle,s).north).toBe(1)})
  it('counts a via and keepout intrusion',()=>{const s=solved();const nodes:RouteNode[]=[{x:20,y:32,layer:'F.Cu'},{x:20,y:32,layer:'B.Cu'},{x:24,y:32,layer:'B.Cu'}];s.traces.push({id:'via',nodes});const r=evaluate(puzzle,s);expect(r.viaCount).toBe(1);expect(r.keepout).toBeGreaterThan(0);expect(r.score).toBe(100-r.keepout*5-1)})
  it('uses geometric contact, including after moving a diode',()=>{const s=solved();expect(evaluate(puzzle,s).clear).toBe(true);s.diodes[0].position={x:25,y:13};expect(evaluate(puzzle,s).clear).toBe(false)})
  it('does not connect tracks on different layers without a via',()=>{const s=solved();s.traces.pop();s.traces.push(route('back-row',[{x:27,y:12},{x:33,y:17}],'B.Cu'));expect(evaluate(puzzle,s).missing).toBeGreaterThan(0)})
  it('rejects incomplete puzzle JSON',()=>{expect(()=>validatePuzzle({id:'broken'})).toThrow()})
})
