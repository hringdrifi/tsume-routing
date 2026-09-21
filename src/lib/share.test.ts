import {expect,it} from 'vitest'
import {day001} from './puzzle'
import {decodePuzzle,encodePuzzle} from './share'

it('round trips a puzzle through a text share link',()=>{
  expect(decodePuzzle(encodePuzzle(day001))).toEqual(day001)
})
it('rejects malformed shared content',()=>{
  expect(()=>decodePuzzle('invalid-data')).toThrow()
})
it('assigns generic pin numbers when loading an older GPIO-named puzzle',()=>{
  const old=structuredClone(day001) as unknown as {mcu:{pins:{id?:string;number?:number;role:string}[]}}
  old.mcu.pins.forEach((pin,i)=>{delete pin.number;pin.id=`P0.${i+2}`})
  const encoded=btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(old)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
  expect(decodePuzzle(encoded).mcu.pins).toEqual(day001.mcu.pins)
})
