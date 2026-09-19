import {expect,it} from 'vitest'
import {dailyPuzzle,todayNumber} from './daily'
import {day001} from './puzzle'

it('maps the launch day in Japan to Day 001',()=>{
  expect(todayNumber(new Date('2026-09-18T15:00:00Z'))).toBe(1)
  expect(todayNumber(new Date('2026-09-19T15:00:00Z'))).toBe(2)
})
it('creates a valid, repeatable puzzle for each day',()=>{
  expect(dailyPuzzle(1)).toEqual(day001)
  expect(dailyPuzzle(2)).toEqual(dailyPuzzle(2))
  expect(dailyPuzzle(2).id).toBe('day002')
  expect(dailyPuzzle(2).matrix.diodeDirection).toBe('ROW2COL')
})
