import type {Trace} from './model'
import {EPS,intersections,near,onSegment,traceSegments} from './geometry'

const ends=(trace:Trace)=>[trace.nodes[0],trace.nodes.at(-1)!] as const
const sharesBothEndpoints=(a:Trace,b:Trace)=>{
  const [aStart,aEnd]=ends(a),[bStart,bEnd]=ends(b)
  return (near(aStart,bStart)&&near(aEnd,bEnd))||(near(aStart,bEnd)&&near(aEnd,bStart))
}
const anchorsAt=(point:Trace['nodes'][number],traces:Trace[],excludedId:string)=>new Set(traces.filter(trace=>trace.id!==excludedId&&traceSegments(trace.nodes).some(segment=>segment.layer===point.layer&&onSegment(point,segment.a,segment.b))).map(trace=>trace.id))
const overlaps=(a:Set<string>,b:Set<string>)=>[...a].some(id=>b.has(id))
const tracesTouch=(a:Trace,b:Trace)=>traceSegments(a.nodes).some(left=>traceSegments(b.nodes).some(right=>left.layer===right.layer&&intersections(left.a,left.b,right.a,right.b).length>0))
const anchorsShareNetwork=(a:Set<string>,b:Set<string>,traces:Trace[],excludedId:string)=>{
  if(overlaps(a,b))return true
  const available=traces.filter(trace=>trace.id!==excludedId),reachable=new Set(a),queue=[...a]
  while(queue.length){
    const id=queue.shift()!,current=available.find(trace=>trace.id===id)
    if(!current)continue
    for(const candidate of available)if(!reachable.has(candidate.id)&&tracesTouch(current,candidate)){reachable.add(candidate.id);queue.push(candidate.id)}
  }
  return overlaps(reachable,b)
}
const connectsSameTraces=(old:Trace,next:Trace,traces:Trace[])=>{
  const [oldStart,oldEnd]=ends(old),[nextStart,nextEnd]=ends(next)
  const oldStartAnchors=anchorsAt(oldStart,traces,old.id),oldEndAnchors=anchorsAt(oldEnd,traces,old.id)
  const nextStartAnchors=anchorsAt(nextStart,traces,old.id),nextEndAnchors=anchorsAt(nextEnd,traces,old.id)
  return (anchorsShareNetwork(oldStartAnchors,nextStartAnchors,traces,old.id)&&anchorsShareNetwork(oldEndAnchors,nextEndAnchors,traces,old.id))||
    (anchorsShareNetwork(oldStartAnchors,nextEndAnchors,traces,old.id)&&anchorsShareNetwork(oldEndAnchors,nextStartAnchors,traces,old.id))
}
const connectsSameTraceAndEndpoint=(old:Trace,next:Trace,traces:Trace[])=>{
  const [oldStart,oldEnd]=ends(old),[nextStart,nextEnd]=ends(next)
  const matches=(oldOther:Trace['nodes'][number],nextOther:Trace['nodes'][number])=>
    anchorsAt(oldOther,traces,old.id).size>0&&anchorsShareNetwork(anchorsAt(oldOther,traces,old.id),anchorsAt(nextOther,traces,old.id),traces,old.id)
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
const straightLine=(trace:Trace)=>{
  const segments=traceSegments(trace.nodes)
  if(!segments.length||segments.some(segment=>segment.layer!==segments[0].layer))return null
  const first=segments[0],dx=first.b.x-first.a.x,dy=first.b.y-first.a.y
  if(Math.abs(dx)<EPS&&Math.abs(dy)<EPS)return null
  if(segments.some(segment=>Math.abs(dx*(segment.a.y-first.a.y)-dy*(segment.a.x-first.a.x))>=EPS||Math.abs(dx*(segment.b.y-first.a.y)-dy*(segment.b.x-first.a.x))>=EPS))return null
  return {layer:first.layer,origin:first.a,dx,dy}
}
const mergedLine=(a:Trace,b:Trace):Trace|null=>{
  const line=straightLine(a),other=straightLine(b)
  if(!line||!other||line.layer!==other.layer||Math.abs(line.dx*other.dy-line.dy*other.dx)>=EPS)return null
  if(Math.abs(line.dx*(other.origin.y-line.origin.y)-line.dy*(other.origin.x-line.origin.x))>=EPS)return null
  const scale=line.dx*line.dx+line.dy*line.dy
  const project=(point:Trace['nodes'][number])=>((point.x-line.origin.x)*line.dx+(point.y-line.origin.y)*line.dy)/scale
  const aRange=[project(a.nodes[0]),project(a.nodes.at(-1)!)] as const,bRange=[project(b.nodes[0]),project(b.nodes.at(-1)!)] as const
  const lower=Math.max(Math.min(...aRange),Math.min(...bRange)),upper=Math.min(Math.max(...aRange),Math.max(...bRange))
  if(lower>upper+EPS)return null
  const points=[...aRange,...bRange],from=Math.min(...points),to=Math.max(...points)
  return {id:a.id,nodes:[{x:line.origin.x+line.dx*from,y:line.origin.y+line.dy*from,layer:line.layer},{x:line.origin.x+line.dx*to,y:line.origin.y+line.dy*to,layer:line.layer}]}
}

export function compactTraces(traces:Trace[]):Trace[]{
  const compact=[...traces]
  for(let i=0;i<compact.length;i++)for(let j=i+1;j<compact.length;j++){
    const merged=mergedLine(compact[i],compact[j])
    if(!merged)continue
    compact[i]=merged;compact.splice(j,1);i=-1;break
  }
  return compact
}
const insertPoint=(nodes:Trace['nodes'],point:Trace['nodes'][number])=>{
  const existing=nodes.findIndex(node=>node.layer===point.layer&&near(node,point))
  if(existing>=0)return {nodes,index:existing}
  for(let i=1;i<nodes.length;i++){
    const a=nodes[i-1],b=nodes[i]
    if(a.layer===point.layer&&b.layer===point.layer&&onSegment(point,a,b)){
      const next=[...nodes.slice(0,i),point,...nodes.slice(i)]
      return {nodes:next,index:i}
    }
  }
  return null
}
const rerouteSection=(trace:Trace,next:Trace):Trace[]|null=>{
  const [first,second]=ends(next)
  if(near(first,second))return null
  const insertedFirst=insertPoint(trace.nodes,first)
  if(!insertedFirst)return null
  const insertedSecond=insertPoint(insertedFirst.nodes,second)
  if(!insertedSecond)return null
  const firstIndex=insertedSecond.nodes.findIndex(node=>node.layer===first.layer&&near(node,first))
  const secondIndex=insertedSecond.nodes.findIndex(node=>node.layer===second.layer&&near(node,second))
  if(firstIndex<0||secondIndex<0||firstIndex===secondIndex)return null
  const [from,to]=firstIndex<secondIndex?[firstIndex,secondIndex]:[secondIndex,firstIndex]
  const before=insertedSecond.nodes.slice(0,from+1),after=insertedSecond.nodes.slice(to)
  return [before.length>1?{id:trace.id,nodes:before}:null,after.length>1?{id:`${trace.id}:tail`,nodes:after}:null].filter((part):part is Trace=>part!==null)
}

export function replaceRoute(traces:Trace[],next:Trace):{traces:Trace[];replaced:number} {
  const splice=traces.find(trace=>!hasAttachedBranch(trace,traces)&&rerouteSection(trace,next))
  if(splice){
    const remnants=rerouteSection(splice,next)!
    return {traces:[...traces.filter(trace=>trace.id!==splice.id),...remnants,next],replaced:1}
  }
  const kept=traces.filter(trace=>{
    const replaces=sharesBothEndpoints(trace,next)||connectsSameTraces(trace,next,traces)||connectsSameTraceAndEndpoint(trace,next,traces)
    return !replaces||hasAttachedBranch(trace,traces)
  })
  return {traces:[...kept,next],replaced:traces.length-kept.length}
}
