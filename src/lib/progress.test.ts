import {expect,it,vi} from 'vitest'
import {day001} from './puzzle'
import {initialState,type Puzzle} from './model'
import {loadProgress,saveProgress} from './progress'

it('loads saved Daily progress from the earlier GPIO-named puzzle',()=>{
  const entries=new Map<string,string>()
  vi.stubGlobal('localStorage',{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value)})
  try{
    const old=structuredClone(day001) as unknown as {mcu:{pins:{id?:string;number?:number;role:string}[]}}
    const names:Record<string,string>={ROW0:'P0.02',ROW1:'P0.03',COL0:'P0.04',COL1:'P0.05',COL2:'P0.06'}
    old.mcu.pins=old.mcu.pins.map(pin=>({id:names[pin.role],role:pin.role}))
    const state=initialState(day001)
    saveProgress(old as unknown as Puzzle,state)
    expect(loadProgress(day001)).toEqual(state)
  }finally{vi.unstubAllGlobals()}
})
