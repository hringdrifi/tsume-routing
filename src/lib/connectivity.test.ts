import {expect,it} from 'vitest'
import {connectedComponents} from './connectivity'

it('connects a branch added on the far side of a via',()=>{
  const pads=[
    {id:'A',label:'A',net:'NET',kind:'switch' as const,x:0,y:0},
    {id:'B',label:'B',net:'NET',kind:'switch' as const,x:20,y:0},
    {id:'C',label:'C',net:'NET',kind:'switch' as const,x:15,y:10},
  ]
  const state={diodes:[],switchRotations:{},traces:[
    {id:'trunk',nodes:[{x:0,y:0,layer:'F.Cu' as const},{x:10,y:0,layer:'F.Cu' as const},{x:10,y:0,layer:'B.Cu' as const},{x:20,y:0,layer:'B.Cu' as const}]},
    {id:'branch',nodes:[{x:15,y:0,layer:'B.Cu' as const},{x:15,y:10,layer:'B.Cu' as const}]},
  ]}
  const connected=connectedComponents(pads,state)
  expect(connected.get('A')).toBe(connected.get('B'))
  expect(connected.get('B')).toBe(connected.get('C'))
})
