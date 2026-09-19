import {expect,it} from 'vitest'
import {MX_3PIN,mxPin} from './mx'
import {day001,pads} from './puzzle'
import {initialState} from './model'

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
