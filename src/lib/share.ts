import {validatePuzzle} from './puzzle'
import {dailyPuzzle,isDebugMode,lastAvailableDay,todayNumber} from './daily'
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
export function puzzleFromLocation(href=location.href,now=new Date()):Puzzle{
  const url=new URL(href,typeof location==='undefined'?'https://example.test/':location.origin)
  const shared=new URLSearchParams(url.hash.slice(1)).get('p')
  if(shared)return decodePuzzle(shared)
  const id=url.searchParams.get('puzzle')
  const path=url.pathname.match(/\/day\/(\d{1,4})\/?$/)
  const requested=id?.match(/^day(\d{1,4})$/)?.[1]??path?.[1]
  if(id&&!requested)throw Error(`問題 ${id} は見つかりません`)
  const number=requested?Number(requested):todayNumber(now)
  if(number>lastAvailableDay(now,isDebugMode(url.search)))throw Error('この問題はまだ公開されていません')
  return dailyPuzzle(number)
}
