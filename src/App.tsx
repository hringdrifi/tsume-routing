import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {BoardState,Layer,Point,RouteNode,Rotation,Trace,Puzzle} from './lib/model'
import {initialState} from './lib/model'
import {day001,inside,pads} from './lib/puzzle'
import {puzzleFromLocation} from './lib/share'
import {evaluate} from './lib/engine'
import {grid,gridStep,KEY_UNIT_MM,near,snapPath,traceSegments} from './lib/geometry'
import {encodePuzzle} from './lib/share'
import Editor from './Editor'
import {loadProgress,saveProgress} from './lib/progress'
import {todayNumber} from './lib/daily'
import {MX_3PIN} from './lib/mx'
import {ratsnest} from './lib/ratsnest'
import {replaceRoute} from './lib/traces'

const other=(l:Layer):Layer=>l==='F.Cu'?'B.Cu':'F.Cu'
const asNodes=(from:RouteNode,to:Point):RouteNode[]=>snapPath(from,to).filter(p=>!near(p,from)).map(p=>({...p,layer:from.layer}))
const closestPointOnSegment=(point:Point,a:Point,b:Point):Point=>{
  const dx=b.x-a.x,dy=b.y-a.y,span=dx*dx+dy*dy
  const t=span===0?0:Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/span))
  return {x:Number((a.x+dx*t).toFixed(6)),y:Number((a.y+dy*t).toFixed(6))}
}
type Tool='route'|'delete'
export default function App(){
  const [puzzle,setPuzzle]=useState<Puzzle>(()=>{try{return puzzleFromLocation()}catch{return day001}})
  const [board,setBoard]=useState<BoardState>(()=>loadProgress(puzzle)??initialState(puzzle))
  const [past,setPast]=useState<BoardState[]>([]),[future,setFuture]=useState<BoardState[]>([])
  const [tool,setTool]=useState<Tool>('route'),[selected,setSelected]=useState<string|null>(null)
  const [selectedSwitch,setSelectedSwitch]=useState<string|null>(null)
  const [routeLayer,setRouteLayer]=useState<Layer>('F.Cu')
  const [draft,setDraft]=useState<RouteNode[]|null>(null),[cursor,setCursor]=useState<Point|null>(null)
  const [draggedDiode,setDraggedDiode]=useState<{switchId:string;position:Point}|null>(null)
  const [result,setResult]=useState(false),[notice,setNotice]=useState('パッドまたは既存配線をクリックして配線を開始')
  const [editorOpen,setEditorOpen]=useState(false)
  const [view,setView]=useState({x:0,y:0,w:puzzle.board.width,h:puzzle.board.height})
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Point|null>(null),seq=useRef(0)
  const touchPan=useRef<{pointerId:number;point:Point;moved:boolean}|null>(null)
  const touchPoints=useRef(new Map<number,Point>())
  const pinchDistance=useRef<number|null>(null)
  const diodeDrag=useRef<{switchId:string;start:Point;cursor:Point;position:Point;pointerId:number;moved:boolean}|null>(null)
  const suppressDragClick=useRef(false)
  const previewBoard=useMemo(()=>draggedDiode?{...board,diodes:board.diodes.map(d=>d.switchId===draggedDiode.switchId?{...d,position:draggedDiode.position}:d)}:board,[board,draggedDiode])
  const allPads=useMemo(()=>pads(puzzle,previewBoard),[puzzle,previewBoard])
  const airwires=useMemo(()=>ratsnest(allPads,previewBoard),[allPads,previewBoard])
  const checked=useMemo(()=>evaluate(puzzle,board),[puzzle,board])
  useEffect(()=>{saveProgress(puzzle,board)},[puzzle,board])
  useEffect(()=>{
    const canvas=svg.current
    if(!canvas)return
    const zoom=(event:WheelEvent)=>{
      event.preventDefault()
      event.stopPropagation()
      const point=canvas.createSVGPoint();point.x=event.clientX;point.y=event.clientY
      const focus=point.matrixTransform(canvas.getScreenCTM()!.inverse())
      const factor=event.deltaY>0?1.12:0.88
      setView(current=>{
        const width=Math.max(45,Math.min(200,current.w*factor))
        const height=Math.max(30,Math.min(135,current.h*factor))
        const fx=(focus.x-current.x+3)/(current.w+6)
        const fy=(focus.y-current.y+3)/(current.h+6)
        return {x:focus.x-fx*(width+6)+3,y:focus.y-fy*(height+6)+3,w:width,h:height}
      })
    }
    canvas.addEventListener('wheel',zoom,{passive:false})
    return()=>canvas.removeEventListener('wheel',zoom)
  },[])
  useEffect(()=>{const load=()=>{try{const next=puzzleFromLocation();setPuzzle(next);setBoard(loadProgress(next)??initialState(next));setPast([]);setFuture([]);setDraft(null);setSelected(null);setSelectedSwitch(null);setView({x:0,y:0,w:next.board.width,h:next.board.height});setResult(false);setNotice(`${next.title} を読み込みました`)}catch(e){setNotice(e instanceof Error?e.message:'問題を読み込めませんでした')}};window.addEventListener('hashchange',load);return()=>window.removeEventListener('hashchange',load)},[])
  const commit=useCallback((next:BoardState)=>{setPast(p=>[...p,board]);setFuture([]);setBoard(next);setResult(false)},[board])
  const undo=useCallback(()=>{if(!past.length)return;setFuture(f=>[board,...f]);setBoard(past[past.length-1]);setPast(p=>p.slice(0,-1));setDraft(null);setResult(false)},[board,past])
  const redo=useCallback(()=>{if(!future.length)return;setPast(p=>[...p,board]);setBoard(future[0]);setFuture(f=>f.slice(1));setDraft(null);setResult(false)},[board,future])
  const pt=(e:{clientX:number;clientY:number}):Point=>{const p=svg.current!.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.current!.getScreenCTM()!.inverse());return {x:grid(q.x,48),y:grid(q.y,48)}}
  const rawPt=(e:{clientX:number;clientY:number}):Point=>{const p=svg.current!.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.current!.getScreenCTM()!.inverse());return {x:q.x,y:q.y}}
  const safeDiodePosition=(pos:Point):Point=>({x:Math.max(4,Math.min(puzzle.board.width-4,pos.x)),y:Math.max(4,Math.min(puzzle.board.height-4,pos.y))})
  const diodePosition=(moving:NonNullable<typeof diodeDrag.current>,e:{clientX:number;clientY:number}):Point=>{const at=pt(e);return safeDiodePosition({x:grid(moving.start.x+at.x-moving.cursor.x,48),y:grid(moving.start.y+at.y-moving.cursor.y,48)})}
  const startDiodeDrag=(d:BoardState['diodes'][number],e:React.PointerEvent<SVGGElement>)=>{
    if(e.button!==0||!d.position)return
    e.preventDefault();e.stopPropagation()
    diodeDrag.current={switchId:d.switchId,start:d.position,cursor:pt(e),position:d.position,pointerId:e.pointerId,moved:false}
    svg.current?.setPointerCapture(e.pointerId)
    setSelectedSwitch(null);setSelected(d.switchId);setDraft(null);setNotice(`${d.switchId} ダイオードをドラッグ中`)
  }
  const moveDiodeDrag=(e:React.PointerEvent<SVGSVGElement>)=>{
    const moving=diodeDrag.current
    if(!moving||moving.pointerId!==e.pointerId)return
    const position=diodePosition(moving,e)
    if(near(position,moving.position))return
    moving.position=position;moving.moved=true
    setDraggedDiode({switchId:moving.switchId,position})
  }
  const endDiodeDrag=(e:React.PointerEvent<SVGSVGElement>)=>{
    const moving=diodeDrag.current
    if(!moving||moving.pointerId!==e.pointerId)return
    const position=diodePosition(moving,e)
    diodeDrag.current=null;setDraggedDiode(null)
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    if(moving.moved||!near(position,moving.start)){
      suppressDragClick.current=true
      window.setTimeout(()=>{suppressDragClick.current=false},0)
    }
    if(near(position,moving.start))return
    commit({...board,diodes:board.diodes.map(d=>d.switchId===moving.switchId?{...d,position}:d)})
    setNotice(`${moving.switchId} ダイオードを移動`)
  }
  const cancelDiodeDrag=()=>{const moving=diodeDrag.current;if(moving&&svg.current?.hasPointerCapture(moving.pointerId))svg.current.releasePointerCapture(moving.pointerId);diodeDrag.current=null;setDraggedDiode(null)}
  const startTouchPan=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(e.pointerType!=='touch'||diodeDrag.current)return
    const target=e.target as Element
    if(target.closest('.pad-group,.diode,.switch,.trace.existing'))return
    touchPoints.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(touchPoints.current.size===1)touchPan.current={pointerId:e.pointerId,point:{x:e.clientX,y:e.clientY},moved:false}
    if(touchPoints.current.size===2){
      const [a,b]=[...touchPoints.current.values()]
      pinchDistance.current=Math.hypot(a.x-b.x,a.y-b.y)
      touchPan.current=null
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const moveTouchPan=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(!touchPoints.current.has(e.pointerId))return
    touchPoints.current.set(e.pointerId,{x:e.clientX,y:e.clientY})
    if(touchPoints.current.size>=2){
      const [a,b]=[...touchPoints.current.values()]
      const distance=Math.hypot(a.x-b.x,a.y-b.y),previous=pinchDistance.current
      if(!previous||distance===0)return
      const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},bounds=e.currentTarget.getBoundingClientRect()
      const factor=previous/distance
      pinchDistance.current=distance
      touchPan.current=null
      suppressDragClick.current=true
      setView(current=>{
        const width=Math.max(45,Math.min(200,current.w*factor)),height=Math.max(30,Math.min(135,current.h*factor))
        const focus={x:current.x-3+(center.x-bounds.left)*(current.w+6)/bounds.width,y:current.y-3+(center.y-bounds.top)*(current.h+6)/bounds.height}
        const fx=(focus.x-current.x+3)/(current.w+6),fy=(focus.y-current.y+3)/(current.h+6)
        return {x:focus.x-fx*(width+6)+3,y:focus.y-fy*(height+6)+3,w:width,h:height}
      })
      return
    }
    const pan=touchPan.current
    if(!pan||pan.pointerId!==e.pointerId)return
    const point={x:e.clientX,y:e.clientY},dx=point.x-pan.point.x,dy=point.y-pan.point.y,bounds=e.currentTarget.getBoundingClientRect()
    if(Math.abs(dx)>.15||Math.abs(dy)>.15)pan.moved=true
    pan.point=point
    setView(v=>({...v,x:v.x-dx*(v.w+6)/bounds.width,y:v.y-dy*(v.h+6)/bounds.height}))
  }
  const endTouchPan=(e:React.PointerEvent<SVGSVGElement>)=>{
    if(!touchPoints.current.has(e.pointerId))return
    touchPoints.current.delete(e.pointerId)
    pinchDistance.current=null
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    if(touchPoints.current.size===1){
      const [pointerId,point]=[...touchPoints.current.entries()][0]
      touchPan.current={pointerId,point,moved:true}
      return
    }
    const pan=touchPan.current
    if(!pan||pan.pointerId!==e.pointerId)return
    touchPan.current=null
    if(pan.moved){suppressDragClick.current=true;window.setTimeout(()=>{suppressDragClick.current=false},0)}
  }
  const finish=(target:Point)=>{
    if(!draft)return
    const tail=draft[draft.length-1],end=asNodes(tail,target),nodes=[...draft,...end]
    if(nodes.length<2){setDraft(null);return}
    let id:string
    do{id=`T${++seq.current}`}while(board.traces.some(t=>t.id===id))
    const trace:Trace={id,nodes}
    const updated=replaceRoute(board.traces,trace)
    commit({...board,traces:updated.traces});setDraft(null);setNotice(updated.replaced?`${trace.id} を追加 · 以前の経路を置換`:`${trace.id} を追加`)
  }
  const changeLayer=(target?:Layer)=>{
    if(!draft){if(target){setRouteLayer(target);setNotice(`${target} で配線を開始します`)}else setNotice('配線中にVでビアを配置できます');return}
    const tail=draft[draft.length-1],next=target??other(tail.layer)
    if(next===tail.layer)return
    // A plated MX pin already reaches both copper layers; switching at its
    // starting point needs no via and should not cost a point.
    if(draft.length===1&&allPads.some(p=>p.kind==='switch'&&near(p,tail))){
      setDraft([{...tail,layer:next}]);setRouteLayer(next);setNotice(`${next} から配線中`);return
    }
    if(!cursor||!inside(puzzle,cursor)){setNotice('盤面上でビアを配置してください');return}
    const path=asNodes(tail,cursor),at=path.at(-1)??tail
    setDraft([...draft,...path,{...at,layer:next}]);setRouteLayer(next);setNotice(`ビアを配置 · ${next} に切り替え`)
  }
  const chooseTool=(next:Tool)=>{
    setTool(next);setDraft(null)
    if(next==='route')setNotice(`${routeLayer} を選び、パッドまたは既存配線から配線を開始`)
    if(next==='delete')setNotice('削除する配線をクリック')
  }
  const rotateSelected=()=>{
    if(selectedSwitch){
      const current=board.switchRotations[selectedSwitch]??puzzle.switches.find(s=>s.id===selectedSwitch)!.rotation
      const rotation=((current+90)%360) as Rotation
      commit({...board,switchRotations:{...board.switchRotations,[selectedSwitch]:rotation}})
      setDraft(null);setNotice(`${selectedSwitch} を90°回転 · 既存配線は動きません`);return
    }
    if(selected){
      const next=board.diodes.map(d=>d.switchId===selected?{...d,rotation:((d.rotation+90)%360) as Rotation}:d)
      commit({...board,diodes:next});setDraft(null);setNotice(`${selected} ダイオードを90°回転`)
    }
  }
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{
    if(editorOpen||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
    if(e.key==='Escape'){cancelDiodeDrag();setDraft(null);setSelected(null);setSelectedSwitch(null);setNotice('操作を中断');return}
    if(e.key==='Backspace'&&draft){e.preventDefault();setDraft(draft.length>1?draft.slice(0,-1):null);return}
    if(e.key.toLowerCase()==='v'){e.preventDefault();changeLayer()}
    if(e.key.toLowerCase()==='r'&&(selected||selectedSwitch)){e.preventDefault();rotateSelected()}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)})
  const onBoardClick=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(suppressDragClick.current){suppressDragClick.current=false;return}
    const pos=pt(e);if(!inside(puzzle,pos))return
    if(tool==='route'&&draft){const tail=draft[draft.length-1];setDraft([...draft,...asNodes(tail,pos)]);setNotice('クリックで折れ点を追加 · Vでビア')}
  }
  const onPad=(pad:typeof allPads[number],e:React.MouseEvent)=>{
    e.stopPropagation()
    if(pad.kind==='switch'){setSelected(null);setSelectedSwitch(pad.id.split(':')[0])}
    if(pad.kind==='diode'){setSelectedSwitch(null);setSelected(pad.id.split(':')[0])}
    if(tool!=='route')return
    if(!draft){if(routeLayer==='B.Cu'&&pad.kind!=='switch'){setNotice('このパッドはF.Cuから配線してください');return}setDraft([{x:pad.x,y:pad.y,layer:routeLayer}]);setCursor(pad);setNotice(`${pad.label} から ${routeLayer} で配線中`);return}
    if(draft[draft.length-1].layer!=='F.Cu'&&pad.kind!=='switch'){setNotice('このパッドへはF.Cuで接続してください');return}
    finish(pad)
  }
  const preview=draft&&cursor?asNodes(draft[draft.length-1],cursor):[]
  const displayNodes=draft?[...draft,...preview]:[]
  const viaPoints=(nodes:RouteNode[])=>nodes.slice(1).filter((n,i)=>n.layer!==nodes[i].layer)
  const routeLines=(nodes:RouteNode[],id:string,interactive=false)=>traceSegments(nodes).map((s,i)=><line key={`${id}-${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} className={`trace ${s.layer==='F.Cu'?'front':'back'} ${interactive?'existing':'preview'}`} onClick={interactive?(e=>{
    e.stopPropagation()
    if(tool==='delete'){commit({...board,traces:board.traces.filter(t=>t.id!==id)});setNotice(`${id} を削除`);return}
    if(tool!=='route')return
    const point=closestPointOnSegment(rawPt(e),s.a,s.b)
    if(!draft){setDraft([{...point,layer:s.layer}]);setRouteLayer(s.layer);setCursor(point);setNotice(`${id} の途中から ${s.layer} で配線中`);return}
    if(draft[draft.length-1].layer!==s.layer){setNotice(`${s.layer} の配線へ接続するにはレイヤーを切り替えてください`);return}
    finish(point)
  }):undefined}/>)
  const liveLayer=draft?.at(-1)?.layer??routeLayer
  const dayNumber=Number(puzzle.id.match(/^day(\d+)$/)?.[1]??0)
  const navigateDay=(n:number)=>{location.href=`${import.meta.env.BASE_URL}?puzzle=day${String(n).padStart(3,'0')}`}
  return <div className="app"><header><div className="brand"><span className="brand-mark">◈</span><div><strong>詰配線</strong><small>TSUME ROUTING <b>/</b> A KEYBOARD PCB PUZZLE</small></div></div><div className="header-right"><button className="open-editor" onClick={()=>setEditorOpen(true)}>問題を作る</button><span className="day">{puzzle.id.toUpperCase()}</span><span className="score">SCORE <b>{checked.score}</b></span></div></header>
    <main><section className="workspace"><div className="board-bar"><span><i className="live-dot"/> PCB EDITOR <em>{puzzle.board.width} × {puzzle.board.height} mm</em></span><div className="grid-control">GRID 1/48u ({gridStep(48).toFixed(4)} mm)<b>·</b> 2 LAYERS</div></div>
      <div className="canvas-toolbar" role="toolbar" aria-label="盤面の操作ツール"><span className="toolbar-label">操作</span><button className={tool==='route'?'active':''} onClick={()=>chooseTool('route')}><b>⌁</b> 配線</button><button onClick={rotateSelected} disabled={!selected&&!selectedSwitch}><b>↻</b> 回転 <kbd>R</kbd></button><button onClick={()=>changeLayer()}><b>⊙</b> VIA <kbd>V</kbd></button><button className={tool==='delete'?'active':''} onClick={()=>chooseTool('delete')}><b>⌫</b> 削除</button><span className="toolbar-help">{draft?'既存配線をクリックして接続できます':selectedSwitch?`${selectedSwitch} スイッチを選択中`:selected?`${selected} ダイオードを選択中`:'パッドまたは既存配線から開始'}</span></div>
      <div className="canvas-wrap"><svg ref={svg} viewBox={`${view.x-3} ${view.y-3} ${view.w+6} ${view.h+6}`} onMouseMove={e=>{if(drag.current){const p=pt(e),dx=p.x-drag.current.x,dy=p.y-drag.current.y;setView(v=>({...v,x:v.x-dx,y:v.y-dy}));return}setCursor(pt(e))}} onMouseDown={e=>{if(e.button===1){e.preventDefault();drag.current=pt(e)}}} onMouseUp={()=>drag.current=null} onMouseLeave={()=>drag.current=null} onPointerDown={startTouchPan} onPointerMove={e=>{moveDiodeDrag(e);moveTouchPan(e)}} onPointerUp={e=>{endDiodeDrag(e);endTouchPan(e)}} onPointerCancel={e=>{cancelDiodeDrag();endTouchPan(e)}} onClick={onBoardClick}>
        <defs><pattern id="grid-major" width={KEY_UNIT_MM} height={KEY_UNIT_MM} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".22" fill="var(--grid-dot)"/></pattern><pattern id="grid-minor" width={gridStep(48)} height={gridStep(48)} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".08" fill="var(--grid-dot)"/></pattern></defs>
        <rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" className="pcb"/>{view.w<65&&<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-minor)"/>}<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-major)"/>
        {puzzle.keepouts.map(k=><g key={k.id}><rect className="keepout" x={k.x} y={k.y} width={k.width} height={k.height}/><text className="keepout-text" x={k.x+k.width/2} y={k.y+k.height/2}>KEEP OUT</text></g>)}
        {puzzle.switches.map(s=>{const rotation=board.switchRotations[s.id]??s.rotation;return <g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${rotation})`} onClick={e=>{if(tool==='route')return;e.stopPropagation();setSelected(null);setSelectedSwitch(s.id);setDraft(null);setNotice(`${s.id} スイッチを選択 · Rで回転`)}}><rect className={`switch ${selectedSwitch===s.id?'selected':''}`} x={-MX_3PIN.housingHalf} y={-MX_3PIN.housingHalf} width={MX_3PIN.housingHalf*2} height={MX_3PIN.housingHalf*2} rx="1.5"/><circle className="switch-hole-ring" r={MX_3PIN.centerHoleRadius+.45}/><circle className="switch-hole" r={MX_3PIN.centerHoleRadius}/><text className="part-label" y="-9" transform={`rotate(${-rotation})`}>{s.id}</text></g>})}
        {previewBoard.diodes.map(d=><g key={d.switchId} transform={`translate(${d.position!.x} ${d.position!.y}) rotate(${d.rotation})`} onPointerDown={e=>startDiodeDrag(d,e)} onClick={e=>{e.stopPropagation();if(suppressDragClick.current){suppressDragClick.current=false;return}setSelectedSwitch(null);setSelected(d.switchId);setDraft(null);setNotice(`${d.switchId} ダイオードを選択 · ドラッグで移動 · Rで回転`)}}><rect className={`diode ${selected===d.switchId?'selected':''} ${draggedDiode?.switchId===d.switchId?'dragging':''}`} x="-3.5" y="-1.6" width="7" height="3.2" rx=".5"/><path className="diode-symbol" d="M-1 -1 L1 0 L-1 1 Z M1 -1 L1 1"/><text className="diode-label" x="0" y="-3" transform={`rotate(${-d.rotation})`}>{d.switchId} D</text></g>)}
        {airwires.map(w=><line key={`${w.net}:${w.from.id}:${w.to.id}`} className="airwire" x1={w.from.x} y1={w.from.y} x2={w.to.x} y2={w.to.y}/>)}
        <g transform={`translate(${puzzle.mcu.x} ${puzzle.mcu.y})`}><rect className="mcu" x="-4" y="-13" width="16" height="26" rx="1"/><text className="mcu-label" x="4" y="-15">MCU</text></g>
        {board.traces.map(t=><g key={t.id}>{routeLines(t.nodes,t.id,true)}{viaPoints(t.nodes).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>)}
        {draft&&<g opacity=".72" pointerEvents="none">{routeLines(displayNodes,'draft')}{viaPoints(draft).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>}
        {allPads.map(pad=><g key={pad.id} className="pad-group" onClick={e=>onPad(pad,e)}><circle className={`pad ${pad.kind}`} cx={pad.x} cy={pad.y} r={pad.kind==='switch'?MX_3PIN.copperRadius:1.25}/>{pad.kind==='switch'&&<circle className="pad-drill" cx={pad.x} cy={pad.y} r={MX_3PIN.pinDrillRadius}/>}<circle className="pad-hit" cx={pad.x} cy={pad.y} r={pad.kind==='switch'?2.4:2.8}/><title>{pad.label}</title></g>)}
        {puzzle.mcu.pins.map((pin,i)=><text key={pin.number} className="mcu-pin-label" x={puzzle.mcu.x+4} y={puzzle.mcu.y-8+i*4}>{pin.role}</text>)}
        {result&&checked.issues.map((issue,i)=><g key={i}><circle className={`issue ${issue.fatal?'fatal':'warning'}`} cx={issue.point.x} cy={issue.point.y} r="3"/><text className="issue-mark" x={issue.point.x} y={issue.point.y+.8}>!</text></g>)}
      </svg><div className="canvas-hint"><span className="desktop-hint">ホイール: ズーム <span>·</span> 中ボタン: パン</span><span className="touch-hint">1本指: パン <span>·</span> 2本指: 拡大・縮小 <span>·</span> タップ: 操作</span> <span>·</span> Esc: 中断</div></div>
      <div className="status"><span className="status-led"/>{notice}<span className="coords">{cursor?`${cursor.x}, ${cursor.y} mm`:''}</span></div>
    </section>
    <aside><div className="panel-title">WORKBENCH <span>{puzzle.id.toUpperCase()}</span></div><h2>{puzzle.title}</h2><p className="panel-intro">{puzzle.switches.length}つのキーを{puzzle.matrix.rows}×{puzzle.matrix.cols}の行列へ。配置済みのダイオードを調整し、MCUの{puzzle.mcu.pins.length}本のピンまで配線してください。点線は未接続のラッツネストです。</p>{dayNumber>0&&<div className="daily-nav"><button disabled={dayNumber<=1} onClick={()=>navigateDay(dayNumber-1)}>← 前の問題</button><button onClick={()=>navigateDay(todayNumber())}>今日の問題</button><button disabled={dayNumber>=todayNumber()} onClick={()=>navigateDay(dayNumber+1)}>次の問題 →</button></div>}
      <div className="section-label">ROUTING</div><div className="layer-box"><span className={`layer-swatch ${liveLayer==='F.Cu'?'front':'back'}`}/><strong>{liveLayer}</strong><span>現在のレイヤー</span></div><div className="layer-picker" role="group" aria-label="配線レイヤー">{(['F.Cu','B.Cu'] as const).map(layer=><button key={layer} type="button" className={liveLayer===layer?'active':''} aria-pressed={liveLayer===layer} onClick={()=>changeLayer(layer)}><span className={`layer-swatch ${layer==='F.Cu'?'front':'back'}`}/>{layer}</button>)}</div><div className="action-row"><button className="secondary" onClick={undo} disabled={!past.length}>↶ UNDO</button><button className="secondary" onClick={redo} disabled={!future.length}>↷ REDO</button></div>
      <div className="section-label">RULES</div><div className="rules"><div><span>未接続・ショート</span><b>−10</b></div><div><span>キープアウト</span><b>−5</b></div><div><span>北向きスイッチ</span><b>−3</b></div><div><span>ビア</span><b>−1</b></div></div><p className="direction">DIODE DIRECTION <b>{puzzle.matrix.diodeDirection}</b></p>
    </aside></main>
    <footer><button className="reset" onClick={()=>{commit(initialState(puzzle));setDraft(null);setSelected(null);setSelectedSwitch(null);setNotice('盤面をリセット')}}>RESET</button><div className="footer-note">SELECT F.Cu / B.Cu → CLICK PAD OR TRACE <span>·</span> V TO PLACE VIA</div><button className="check" onClick={()=>{setResult(true);setNotice(checked.clear?'CLEAR!':'問題箇所を盤面に表示しています')}}>CHECK / SUBMIT <span>→</span></button></footer>
    {result&&<div className="result-backdrop" onClick={()=>setResult(false)}><div className="result-card" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setResult(false)}>×</button><div className="eyebrow">{puzzle.id.toUpperCase()} / RESULT</div><h2 className={checked.clear?'clear':'incomplete'}>{checked.clear?'CLEAR':'NOT YET'}</h2><div className="total"><span>TOTAL SCORE</span><strong>{checked.score}</strong></div><div className="result-grid"><div>接続エラー <b>{checked.missing+checked.shorts}</b></div><div>キープアウト <b>{checked.keepout}</b></div><div>ビア <b>{checked.viaCount}</b></div><div>配線長 <b>{checked.length.toFixed(1)} mm</b></div></div>{checked.issues.length>0&&<div className="issue-list">{checked.issues.map((issue,i)=><p key={i} className={issue.fatal?'bad':'warn'}>{issue.message}</p>)}</div>}<button className="continue" onClick={()=>setResult(false)}>盤面に戻る</button></div></div>}
    {editorOpen&&<Editor source={puzzle} onClose={()=>setEditorOpen(false)} onPlay={next=>{setEditorOpen(false);setPuzzle(next);setBoard(initialState(next));setPast([]);setFuture([]);setDraft(null);setSelected(null);setSelectedSwitch(null);setView({x:0,y:0,w:next.board.width,h:next.board.height});location.hash=`p=${encodePuzzle(next)}`}}/>}
  </div>
}
