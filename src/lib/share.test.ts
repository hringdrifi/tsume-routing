import {expect,it} from 'vitest'
import {day001} from './puzzle'
import {decodePuzzle,encodePuzzle} from './share'

it('round trips a puzzle through a text share link',()=>{
  expect(decodePuzzle(encodePuzzle(day001))).toEqual(day001)
})
it('rejects malformed shared content',()=>{
  expect(()=>decodePuzzle('invalid-data')).toThrow()
})
