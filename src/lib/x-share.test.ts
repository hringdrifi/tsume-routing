import {describe,expect,it} from 'vitest'
import {xIntentUrl,xShareText} from './x-share'
import type {Puzzle,Result} from './model'

const puzzle={id:'day001'} as Puzzle
const result={clear:true,score:87.5,length:42.25,viaCount:2} as Result

describe('X share',()=>{
  it('includes the essential result metrics in the post text',()=>{
    expect(xShareText(puzzle,result)).toContain('DAY001 CLEAR!')
    expect(xShareText(puzzle,result)).toContain('SCORE 87.5 · 配線長 42.3 mm · VIA 2')
  })
  it('encodes the text for the X intent endpoint',()=>{
    expect(xIntentUrl('a b')).toBe('https://x.com/intent/post?text=a%20b')
  })
})
