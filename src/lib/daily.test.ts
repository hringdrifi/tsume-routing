import {expect,it} from 'vitest'
import {DAILY_COUNT,dailyPuzzle,lastAvailableDay,todayNumber} from './daily'
import {day001} from './puzzle'

it('maps the current launch day in Japan to Day 001',()=>{
  expect(todayNumber(new Date('2026-09-21T15:00:00Z'))).toBe(1)
  expect(todayNumber(new Date('2026-09-22T15:00:00Z'))).toBe(2)
})
it('creates ten fixed, varied daily puzzles',()=>{
  expect(dailyPuzzle(1)).toEqual(day001)
  expect([...Array(DAILY_COUNT)].map((_,index)=>dailyPuzzle(index+1))).toHaveLength(DAILY_COUNT)
  expect(dailyPuzzle(2).switches).toHaveLength(4)
  expect(dailyPuzzle(8).matrix).toMatchObject({rows:4,cols:3})
  expect(dailyPuzzle(10).mcu.pins.map(pin=>pin.role)).not.toEqual(dailyPuzzle(1).mcu.pins.map(pin=>pin.role))
  expect(dailyPuzzle(2).matrix.diodeDirection).toBe('ROW2COL')
})
it('keeps keepouts clear of every switch housing',()=>{
  for(let day=1;day<=DAILY_COUNT;day++){
    const puzzle=dailyPuzzle(day)
    for(const key of puzzle.switches)for(const keepout of puzzle.keepouts){
      const overlaps=key.x+7>keepout.x&&key.x-7<keepout.x+keepout.width&&key.y+7>keepout.y&&key.y-7<keepout.y+keepout.height
      expect(overlaps,`day ${day}: ${key.id} overlaps ${keepout.id}`).toBe(false)
    }
  }
})
it('limits normal navigation to today and opens the prepared set in debug mode',()=>{
  const now=new Date('2026-09-21T15:00:00Z')
  expect(lastAvailableDay(now)).toBe(1)
  expect(lastAvailableDay(now,true)).toBe(DAILY_COUNT)
})
