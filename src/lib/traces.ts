import type {Trace} from './model'
import {near} from './geometry'

export function replaceRoute(traces:Trace[],next:Trace):{traces:Trace[];replaced:number} {
  const start=next.nodes[0],end=next.nodes.at(-1)!
  const kept=traces.filter(trace=>{
    const first=trace.nodes[0],last=trace.nodes.at(-1)!
    return !(near(first,start)&&near(last,end) || near(first,end)&&near(last,start))
  })
  return {traces:[...kept,next],replaced:traces.length-kept.length}
}
