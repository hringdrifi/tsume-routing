import type {Trace} from './model'
import {near,onSegment,traceSegments} from './geometry'

const ends=(trace:Trace)=>[trace.nodes[0],trace.nodes.at(-1)!] as const
const sharesBothEndpoints=(a:Trace,b:Trace)=>{
  const [aStart,aEnd]=ends(a),[bStart,bEnd]=ends(b)
  return (near(aStart,bStart)&&near(aEnd,bEnd))||(near(aStart,bEnd)&&near(aEnd,bStart))
}
const anchorsAt=(point:Trace['nodes'][number],traces:Trace[],excludedId:string)=>new Set(traces.filter(trace=>trace.id!==excludedId&&traceSegments(trace.nodes).some(segment=>segment.layer===point.layer&&onSegment(point,segment.a,segment.b))).map(trace=>trace.id))
const overlaps=(a:Set<string>,b:Set<string>)=>[...a].some(id=>b.has(id))
const connectsSameTraces=(old:Trace,next:Trace,traces:Trace[])=>{
  const [oldStart,oldEnd]=ends(old),[nextStart,nextEnd]=ends(next)
  const oldStartAnchors=anchorsAt(oldStart,traces,old.id),oldEndAnchors=anchorsAt(oldEnd,traces,old.id)
  const nextStartAnchors=anchorsAt(nextStart,traces,old.id),nextEndAnchors=anchorsAt(nextEnd,traces,old.id)
  return (overlaps(oldStartAnchors,nextStartAnchors)&&overlaps(oldEndAnchors,nextEndAnchors))||
    (overlaps(oldStartAnchors,nextEndAnchors)&&overlaps(oldEndAnchors,nextStartAnchors))
}
const connectsSameTraceAndEndpoint=(old:Trace,next:Trace,traces:Trace[])=>{
  const [oldStart,oldEnd]=ends(old),[nextStart,nextEnd]=ends(next)
  const matches=(oldOther:Trace['nodes'][number],nextOther:Trace['nodes'][number])=>
    anchorsAt(oldOther,traces,old.id).size>0&&overlaps(anchorsAt(oldOther,traces,old.id),anchorsAt(nextOther,traces,old.id))
  return (near(oldStart,nextStart)&&matches(oldEnd,nextEnd))||
    (near(oldStart,nextEnd)&&matches(oldEnd,nextStart))||
    (near(oldEnd,nextStart)&&matches(oldStart,nextEnd))||
    (near(oldEnd,nextEnd)&&matches(oldStart,nextStart))
}
const hasAttachedBranch=(trace:Trace,traces:Trace[])=>{
  const [start,end]=ends(trace)
  return traces.some(other=>other.id!==trace.id&&ends(other).some(point=>
    !near(point,start)&&!near(point,end)&&traceSegments(trace.nodes).some(segment=>segment.layer===point.layer&&onSegment(point,segment.a,segment.b))
  ))
}

export function replaceRoute(traces:Trace[],next:Trace):{traces:Trace[];replaced:number} {
  const kept=traces.filter(trace=>{
    const replaces=sharesBothEndpoints(trace,next)||connectsSameTraces(trace,next,traces)||connectsSameTraceAndEndpoint(trace,next,traces)
    return !replaces||hasAttachedBranch(trace,traces)
  })
  return {traces:[...kept,next],replaced:traces.length-kept.length}
}
