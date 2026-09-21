import {expect,it} from 'vitest'
import {DAILY_COUNT,dailyPuzzle,lastAvailableDay,todayNumber} from './daily'
import {day001} from './puzzle'

it('maps the current launch day in Japan to Day 001',()=>{
  expect(todayNumber(new Date('2026-09-20T15:00:00Z'))).toBe(1)
  expect(todayNumber(new Date('2026-09-21T15:00:00Z'))).toBe(2)
})
it('creates ten fixed, varied daily puzzles',()=>{
  expect(dailyPuzzle(1)).toEqual(day001)
  expect([...Array(DAILY_COUNT)].map((_,index)=>dailyPuzzle(index+1))).toHaveLength(DAILY_COUNT)
  expect(dailyPuzzle(2).switches).toHaveLength(4)
  expect(dailyPuzzle(8).matrix).toMatchObject({rows:4,cols:3})
  expect(dailyPuzzle(10).mcu.pins.map(pin=>pin.role)).not.toEqual(dailyPuzzle(1).mcu.pins.map(pin=>pin.role))
  expect(dailyPuzzle(2).matrix.diodeDirection).toBe('ROW2COL')
})
it('limits normal navigation to today and opens the prepared set in debug mode',()=>{
  const now=new Date('2026-09-20T15:00:00Z')
  expect(lastAvailableDay(now)).toBe(1)
  expect(lastAvailableDay(now,true)).toBe(DAILY_COUNT)
})
