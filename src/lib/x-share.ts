import type {Puzzle,Result} from './model'

export function xShareText(puzzle:Puzzle,result:Result):string{
  const status=result.clear?'CLEAR!':'CHECK RESULT'
  return `詰配線 ${puzzle.id.toUpperCase()} ${status}\nSCORE ${result.score} · 配線長 ${result.length.toFixed(1)} mm · VIA ${result.viaCount}\n#詰配線 #TsumeRouting`
}

export function xIntentUrl(text:string):string{
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`
}
