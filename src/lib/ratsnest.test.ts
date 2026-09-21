import {expect,it} from 'vitest'
import {ratsnest} from './ratsnest'
import {day001,pads} from './puzzle'
import {initialState} from './model'

it('shows only missing connections and removes an airwire after a copper connection',()=>{
  const state=initialState(day001)
  const allPads=pads(day001,state)
  const before=ratsnest(allPads,state)
  expect(before.some(w=>w.net==='COL0')).toBe(true)
  expect(before.some(w=>w.net.startsWith('LINK:'))).toBe(false)

  const sw=allPads.find(p=>p.id==='SW1:col')!
  const mcu=allPads.find(p=>p.kind==='mcu'&&p.net==='COL0')!
  state.traces.push({id:'col0',nodes:[
    {...sw,layer:'B.Cu'},
    {x:80,y:70,layer:'B.Cu'},
    {x:80,y:70,layer:'F.Cu'},
    {...mcu,layer:'F.Cu'}
  ]})
  expect(ratsnest(allPads,state).filter(w=>w.net==='COL0')).toHaveLength(before.filter(w=>w.net==='COL0').length-1)

  state.diodes[0].position={x:75,y:15}
  const withDiode=pads(day001,state)
  expect(ratsnest(withDiode,state).some(w=>w.net==='LINK:SW1')).toBe(true)
})
