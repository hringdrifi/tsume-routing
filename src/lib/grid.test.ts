import {expect,it} from 'vitest'
import {grid,gridStep,KEY_UNIT_MM} from './geometry'
import {day001} from './puzzle'
import {initialState} from './model'

it('uses keyboard units for each selectable grid',()=>{
  expect(KEY_UNIT_MM).toBe(19.05)
  expect(gridStep(48)).toBeCloseTo(0.396875)
  expect(gridStep(24)).toBeCloseTo(0.79375)
  expect(gridStep(12)).toBeCloseTo(1.5875)
  for(const d of [12,24,48] as const)expect(grid(19.05,d)).toBe(19.05)
})
it('places sample key centers on a 1u pitch',()=>{
  expect(day001.switches[1].x-day001.switches[0].x).toBeCloseTo(KEY_UNIT_MM)
  expect(day001.switches[3].y-day001.switches[0].y).toBeCloseTo(KEY_UNIT_MM*2)
})
it('starts with every diode placed outside the keepout',()=>{
  const state=initialState(day001)
  expect(state.diodes.every(d=>d.position)).toBe(true)
  expect(state.diodes.every(d=>!day001.keepouts.some(k=>d.position!.x>=k.x&&d.position!.x<=k.x+k.width&&d.position!.y>=k.y&&d.position!.y<=k.y+k.height))).toBe(true)
})
