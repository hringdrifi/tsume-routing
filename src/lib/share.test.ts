import {expect,it} from 'vitest'
import {day001} from './puzzle'
import {decodePuzzle,encodePuzzle,puzzleFromLocation} from './share'

it('round trips a puzzle through a text share link',()=>{
  expect(decodePuzzle(encodePuzzle(day001))).toEqual(day001)
})
it('rejects malformed shared content',()=>{
  expect(()=>decodePuzzle('invalid-data')).toThrow()
})
it('keeps unreleased daily puzzles behind the debug URL option',()=>{
  const now=new Date('2026-09-21T15:00:00Z')
  expect(()=>puzzleFromLocation('https://example.test/?puzzle=day002',now)).toThrow('まだ公開')
  expect(puzzleFromLocation('https://example.test/?debug=1&puzzle=day002',now).id).toBe('day002')
})
