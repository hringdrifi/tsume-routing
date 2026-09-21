import {expect,it} from 'vitest'
import {MX_3PIN,mxPin} from './mx'
import {day001,pads} from './puzzle'
import {initialState} from './model'
import {grid,ROUTING_GRID} from './geometry'

it('places the two electrical pins relative to the MX center hole',()=>{
  expect(MX_3PIN.centerHoleRadius).toBe(2)
  expect(mxPin({x:0,y:0},1,0)).toEqual({x:2.54,y:-5.08})
  expect(mxPin({x:0,y:0},2,0)).toEqual({x:-3.81,y:-2.54})
  expect(mxPin({x:0,y:0},1,90)).toEqual({x:5.08,y:2.54})
})
it('keeps the center hole out of the electrical graph',()=>{
  const s=day001.switches[0]
  const electrical=pads(day001,initialState(day001)).filter(p=>p.kind==='switch'&&p.id.startsWith(s.id+':'))
  expect(electrical).toHaveLength(2)
  expect(electrical.some(p=>p.x===s.x&&p.y===s.y)).toBe(false)
})
it('keeps every routable pad on the active routing grid',()=>{
  for(const pad of pads(day001,initialState(day001))){
    expect(grid(pad.x,ROUTING_GRID)).toBe(pad.x)
    expect(grid(pad.y,ROUTING_GRID)).toBe(pad.y)
  }
})
it('snaps both MX electrical pins to the fixed routing grid',()=>{
  const state=initialState(day001)
  for(const rotation of [0,90,180,270] as const){
    state.switchRotations.SW1=rotation
    for(const pad of pads(day001,state).filter(p=>p.kind==='switch'&&p.id.startsWith('SW1:'))){
      expect(grid(pad.x,ROUTING_GRID)).toBe(pad.x)
      expect(grid(pad.y,ROUTING_GRID)).toBe(pad.y)
      const index=pad.id.endsWith(':col')?1:2
      const exact=mxPin(day001.switches[0],index,rotation)
      expect(Math.abs(pad.x-exact.x)).toBeLessThanOrEqual(0.396875)
      expect(Math.abs(pad.y-exact.y)).toBeLessThanOrEqual(0.396875)
    }
  }
})
