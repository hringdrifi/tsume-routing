import {expect,it,vi} from 'vitest'
import {day001} from './puzzle'
import {initialState} from './model'
import {loadProgress} from './progress'

it('ignores progress saved under the older format version',()=>{
  const entries=new Map<string,string>([['tsume-progress-v2:day001:old',JSON.stringify(initialState(day001))]])
  vi.stubGlobal('localStorage',{getItem:(key:string)=>entries.get(key)??null})
  try{expect(loadProgress(day001)).toBeNull()}finally{vi.unstubAllGlobals()}
})
