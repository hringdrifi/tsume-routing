import {expect,it} from 'vitest'
import {initialState} from './model'
import {day001,validatePuzzle} from './puzzle'
import {decodePuzzle,encodePuzzle} from './share'

it('preserves edited diode positions and rotations through sharing and play',()=>{
  const puzzle=structuredClone(day001)
  puzzle.diodes=[{switchId:puzzle.switches[0].id,position:{x:20,y:30},rotation:90}]
  const shared=decodePuzzle(encodePuzzle(puzzle))
  const state=initialState(shared)
  expect(state.diodes[0]).toEqual(puzzle.diodes[0])
  expect(state.diodes).toHaveLength(puzzle.switches.length)
  expect(state.diodes.every(d=>d.position)).toBe(true)
  state.diodes[0].position!.x=40
  expect(shared.diodes![0].position!.x).toBe(20)
})

it('rejects invalid, duplicate and orphaned initial diodes',()=>{
  const diode={switchId:day001.switches[0].id,position:{x:20,y:30},rotation:0 as const}
  for(const diodes of [[{...diode,switchId:'missing'}],[diode,diode],[{...diode,position:{x:1,y:1}}],[{...diode,position:null}],[{...diode,rotation:45}]]){
    expect(()=>validatePuzzle({...structuredClone(day001),diodes})).toThrow('Invalid diode')
  }
})
