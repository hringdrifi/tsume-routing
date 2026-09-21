import {expect,it} from 'vitest'
import {replaceRoute} from './traces'
import type {Trace} from './model'

const trace=(id:string,points:[number,number][]):Trace=>({id,nodes:points.map(([x,y])=>({x,y,layer:'F.Cu'}))})

it('replaces an older route between the same pads, including reverse direction',()=>{
  const old=trace('old',[[1,1],[2,1],[3,3]])
  const other=trace('branch',[[2,1],[5,5]])
  const next=trace('new',[[3,3],[3,1],[1,1]])
  expect(replaceRoute([old,other],next)).toEqual({traces:[other,next],replaced:1})
})

it('keeps routes with different endpoints',()=>{
  const old=trace('old',[[1,1],[3,3]])
  const next=trace('new',[[1,1],[4,4]])
  expect(replaceRoute([old],next)).toEqual({traces:[old,next],replaced:0})
})
