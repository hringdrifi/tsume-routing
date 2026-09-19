import {validatePuzzle} from './puzzle'
import {dailyPuzzle,todayNumber} from './daily'
import type {Puzzle} from './model'

export function encodePuzzle(p:Puzzle):string{
  const bytes=new TextEncoder().encode(JSON.stringify(validatePuzzle(p)))
  let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}
export function decodePuzzle(encoded:string):Puzzle{
  if(encoded.length>100000)throw Error('共有データが大きすぎます')
  const base64=encoded.replace(/-/g,'+').replace(/_/g,'/')
  const binary=atob(base64)
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0))
  return validatePuzzle(JSON.parse(new TextDecoder().decode(bytes)))
}
export function puzzleFromLocation():Puzzle{
  const hash=new URLSearchParams(location.hash.slice(1))
  const shared=hash.get('p')
  if(shared)return decodePuzzle(shared)
  const id=new URLSearchParams(location.search).get('puzzle')
  const path=location.pathname.match(/\/day\/(\d{1,4})\/?$/)
  if(id){const match=id.match(/^day(\d{1,4})$/);if(!match)throw Error(`問題 ${id} は見つかりません`);return dailyPuzzle(Number(match[1]))}
  if(path)return dailyPuzzle(Number(path[1]))
  return dailyPuzzle(todayNumber())
}
