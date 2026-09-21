import {expect,it} from 'vitest'
import {compactTraces,replaceRoute} from './traces'
import type {Trace} from './model'

const trace=(id:string,points:[number,number][]):Trace=>({id,nodes:points.map(([x,y])=>({x,y,layer:'F.Cu'}))})

it('replaces an older route between the same pads, including reverse direction',()=>{
  const old=trace('old',[[1,1],[3,3]])
  const other=trace('other',[[2,1],[5,5]])
  const next=trace('new',[[3,3],[3,1],[1,1]])
  expect(replaceRoute([old,other],next)).toEqual({traces:[other,next],replaced:1})
})

it('keeps routes with different endpoints',()=>{
  const old=trace('old',[[1,1],[3,3]])
  const next=trace('new',[[1,1],[4,4]])
  expect(replaceRoute([old],next)).toEqual({traces:[old,next],replaced:0})
})

it('replaces a branch route when its source and destination traces match',()=>{
  const source=trace('source',[[0,0],[10,0]])
  const destination=trace('destination',[[20,0],[20,10]])
  const old=trace('old',[[5,0],[20,5]])
  const next=trace('new',[[7,0],[20,8]])
  expect(replaceRoute([source,destination,old],next)).toEqual({traces:[source,destination,next],replaced:1})
})

it('replaces a route when reconnecting through a joined trace network',()=>{
  const sourceA=trace('source-a',[[0,0],[5,0]])
  const sourceB=trace('source-b',[[5,0],[10,0]])
  const old=trace('old',[[2,0],[20,5]])
  const next=trace('new',[[8,0],[20,5]])
  expect(replaceRoute([sourceA,sourceB,old],next)).toEqual({traces:[sourceA,sourceB,next],replaced:1})
})

it('replaces only the section between two points on the same trace',()=>{
  const old=trace('old',[[0,0],[10,0]])
  const next=trace('new',[[3,0],[3,4],[7,4],[7,0]])
  expect(replaceRoute([old],next)).toEqual({traces:[trace('old',[[0,0],[3,0]]),trace('old:tail',[[7,0],[10,0]]),next],replaced:1})
})

it('combines touching and overlapping straight segments',()=>{
  const first=trace('first',[[0,0],[5,0]])
  const second=trace('second',[[5,0],[10,0]])
  const overlap=trace('overlap',[[8,0],[14,0]])
  expect(compactTraces([first,second,overlap])).toEqual([trace('first',[[0,0],[14,0]])])
})

it('keeps angled segments separate',()=>{
  const horizontal=trace('horizontal',[[0,0],[5,0]])
  const vertical=trace('vertical',[[5,0],[5,5]])
  expect(compactTraces([horizontal,vertical])).toEqual([horizontal,vertical])
})

it('keeps a route that has an attached branch',()=>{
  const old=trace('old',[[1,1],[2,1],[3,3]])
  const branch=trace('branch',[[2,1],[5,5]])
  const next=trace('new',[[3,3],[3,1],[1,1]])
  expect(replaceRoute([old,branch],next)).toEqual({traces:[old,branch,next],replaced:0})
})
