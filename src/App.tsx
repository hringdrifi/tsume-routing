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
type Tool='route'|'place'|'switch'|'delete'
export default function App(){
  const [puzzle,setPuzzle]=useState<Puzzle>(()=>{try{return puzzleFromLocation()}catch{return day001}})
  const [board,setBoard]=useState<BoardState>(()=>loadProgress(puzzle)??initialState(puzzle))
  const [past,setPast]=useState<BoardState[]>([]),[future,setFuture]=useState<BoardState[]>([])
  const [tool,setTool]=useState<Tool>('route'),[selected,setSelected]=useState<string|null>(null)
  const [selectedSwitch,setSelectedSwitch]=useState<string|null>(null)
  const [routeLayer,setRouteLayer]=useState<Layer>('F.Cu')
  const [draft,setDraft]=useState<RouteNode[]|null>(null),[cursor,setCursor]=useState<Point|null>(null)
  const [draggedDiode,setDraggedDiode]=useState<{switchId:string;position:Point}|null>(null)
  const [result,setResult]=useState(false),[notice,setNotice]=useState('パッドをクリックして配線を開始')
  const [editorOpen,setEditorOpen]=useState(false)
  const [view,setView]=useState({x:0,y:0,w:puzzle.board.width,h:puzzle.board.height})
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Point|null>(null),seq=useRef(0)
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
  const safeDiodePosition=(pos:Point):Point=>({x:Math.max(4,Math.min(puzzle.board.width-4,pos.x)),y:Math.max(4,Math.min(puzzle.board.height-4,pos.y))})
  const diodePosition=(moving:NonNullable<typeof diodeDrag.current>,e:{clientX:number;clientY:number}):Point=>{const at=pt(e);return safeDiodePosition({x:grid(moving.start.x+at.x-moving.cursor.x,48),y:grid(moving.start.y+at.y-moving.cursor.y,48)})}
  const startDiodeDrag=(d:BoardState['diodes'][number],e:React.PointerEvent<SVGGElement>)=>{
    if(e.button!==0||!d.position)return
    e.preventDefault();e.stopPropagation()
    diodeDrag.current={switchId:d.switchId,start:d.position,cursor:pt(e),position:d.position,pointerId:e.pointerId,moved:false}
    svg.current?.setPointerCapture(e.pointerId)
    setSelected(d.switchId);setDraft(null);setNotice(`${d.switchId} ダイオードをドラッグ中`)
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
  const rotateDiode=()=>{
    if(!selected)return
    const next=board.diodes.map(d=>d.switchId===selected?{...d,rotation:((d.rotation+90)%360) as Rotation}:d)
    commit({...board,diodes:next});setNotice(`${selected} ダイオードを回転`)
  }
  const chooseTool=(next:Tool)=>{
    setTool(next);setDraft(null)
    if(next==='route'){setSelected(null);setNotice(`${routeLayer} を選び、パッドから配線を開始`) }
    if(next==='place'){setSelected(current=>current??board.diodes.find(d=>!d.position)?.switchId??board.diodes[0]?.switchId??null);setNotice('ダイオードを選び、盤面をクリックして配置 · Rで回転')}
    if(next==='switch'){setSelected(null);setNotice('スイッチを選択して左に90°回転')}
    if(next==='delete'){setSelected(null);setNotice('削除する配線をクリック')}
  }
  const rotateSwitch=()=>{
    if(!selectedSwitch)return
    const current=board.switchRotations[selectedSwitch]??puzzle.switches.find(s=>s.id===selectedSwitch)!.rotation
    const rotation=((current+270)%360) as Rotation
    commit({...board,switchRotations:{...board.switchRotations,[selectedSwitch]:rotation}})
    setDraft(null);setNotice(`${selectedSwitch} を左に90°回転 · 既存配線は動きません`)
  }
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{
    if(editorOpen||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
    if(e.key==='Escape'){cancelDiodeDrag();setDraft(null);setSelected(null);setSelectedSwitch(null);setNotice('操作を中断');return}
    if(e.key==='Backspace'&&draft){e.preventDefault();setDraft(draft.length>1?draft.slice(0,-1):null);return}
    if(e.key.toLowerCase()==='v'){e.preventDefault();changeLayer()}
    if(e.key.toLowerCase()==='d'){e.preventDefault();chooseTool('place')}
    if(e.key.toLowerCase()==='r'&&selected){e.preventDefault();rotateDiode()}
    if(e.key.toLowerCase()==='q'&&tool==='switch'&&selectedSwitch){e.preventDefault();rotateSwitch()}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)})
  const onBoardClick=(e:React.MouseEvent<SVGSVGElement>)=>{
    if(suppressDragClick.current){suppressDragClick.current=false;return}
    const pos=pt(e);if(!inside(puzzle,pos))return
    if(tool==='place'&&selected){const safe=safeDiodePosition(pos);const nextBoard={...board,diodes:board.diodes.map(d=>d.switchId===selected?{...d,position:safe}:d)};const next=nextBoard.diodes.find(d=>!d.position)?.switchId??selected;commit(nextBoard);setSelected(next);setNotice(next===selected?`${selected} ダイオードを配置 · ドラッグで微調整`:`${selected} を配置 · 次は ${next}`);return}
    if(tool==='route'&&draft){const tail=draft[draft.length-1];setDraft([...draft,...asNodes(tail,pos)]);setNotice('クリックで折れ点を追加 · Vでビア')}
  }
  const onPad=(pad:typeof allPads[number],e:React.MouseEvent)=>{
    e.stopPropagation();if(tool==='switch'&&pad.kind==='switch'){const id=pad.id.split(':')[0];setSelectedSwitch(id);setNotice(`${id} 選択中 · Qで左に90°回転`);return}if(tool!=='route')return
    if(!draft){if(routeLayer==='B.Cu'&&pad.kind!=='switch'){setNotice('このパッドはF.Cuから配線してください');return}setDraft([{x:pad.x,y:pad.y,layer:routeLayer}]);setCursor(pad);setNotice(`${pad.label} から ${routeLayer} で配線中`);return}
    if(draft[draft.length-1].layer!=='F.Cu'&&pad.kind!=='switch'){setNotice('このパッドへはF.Cuで接続してください');return}
    finish(pad)
  }
  const preview=draft&&cursor?asNodes(draft[draft.length-1],cursor):[]
  const displayNodes=draft?[...draft,...preview]:[]
  const viaPoints=(nodes:RouteNode[])=>nodes.slice(1).filter((n,i)=>n.layer!==nodes[i].layer)
  const routeLines=(nodes:RouteNode[],id:string,interactive=false)=>traceSegments(nodes).map((s,i)=><line key={`${id}-${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} className={`trace ${s.layer==='F.Cu'?'front':'back'} ${interactive?'existing':'preview'}`} onClick={interactive&&tool==='delete'?(e)=>{e.stopPropagation();commit({...board,traces:board.traces.filter(t=>t.id!==id)});setNotice(`${id} を削除`)}:undefined}/> )
  const liveLayer=draft?.at(-1)?.layer??routeLayer
  const dayNumber=Number(puzzle.id.match(/^day(\d+)$/)?.[1]??0)
  const navigateDay=(n:number)=>{location.href=`${import.meta.env.BASE_URL}?puzzle=day${String(n).padStart(3,'0')}`}
  return <div className="app"><header><div className="brand"><span className="brand-mark">◈</span><div><strong>詰配線</strong><small>TSUME ROUTING <b>/</b> A KEYBOARD PCB PUZZLE</small></div></div><div className="header-right"><button className="open-editor" onClick={()=>setEditorOpen(true)}>問題を作る</button><span className="day">{puzzle.id.toUpperCase()}</span><span className="score">SCORE <b>{checked.score}</b></span></div></header>
    <main><section className="workspace"><div className="board-bar"><span><i className="live-dot"/> PCB EDITOR <em>{puzzle.board.width} × {puzzle.board.height} mm</em></span><div className="grid-control">GRID 1/48u ({gridStep(48).toFixed(4)} mm)<b>·</b> 2 LAYERS</div></div>
      <div className="canvas-toolbar" role="toolbar" aria-label="盤面の操作ツール"><span className="toolbar-label">操作</span><button className={tool==='route'?'active':''} onClick={()=>chooseTool('route')}><b>⌁</b> 配線</button><button className={tool==='place'?'active':''} onClick={()=>chooseTool('place')}><b>◇</b> ダイオード <kbd>D</kbd></button><button className={tool==='switch'?'active':''} onClick={()=>chooseTool('switch')}><b>↶</b> スイッチ</button><button className={tool==='delete'?'active':''} onClick={()=>chooseTool('delete')}><b>⌫</b> 削除</button>{tool==='place'&&<span className="toolbar-help">{selected??'ダイオード'} を配置中 <kbd>R</kbd> 回転</span>}</div>
      <div className="canvas-wrap"><svg ref={svg} viewBox={`${view.x-3} ${view.y-3} ${view.w+6} ${view.h+6}`} onMouseMove={e=>{if(drag.current){const p=pt(e),dx=p.x-drag.current.x,dy=p.y-drag.current.y;setView(v=>({...v,x:v.x-dx,y:v.y-dy}));return}setCursor(pt(e))}} onMouseDown={e=>{if(e.button===1){e.preventDefault();drag.current=pt(e)}}} onMouseUp={()=>drag.current=null} onMouseLeave={()=>drag.current=null} onPointerMove={moveDiodeDrag} onPointerUp={endDiodeDrag} onPointerCancel={cancelDiodeDrag} onClick={onBoardClick}>
        <defs><pattern id="grid-major" width={KEY_UNIT_MM} height={KEY_UNIT_MM} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".22" fill="var(--grid-dot)"/></pattern><pattern id="grid-minor" width={gridStep(48)} height={gridStep(48)} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".08" fill="var(--grid-dot)"/></pattern></defs>
        <rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" className="pcb"/>{view.w<65&&<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-minor)"/>}<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-major)"/>
        {puzzle.keepouts.map(k=><g key={k.id}><rect className="keepout" x={k.x} y={k.y} width={k.width} height={k.height}/><text className="keepout-text" x={k.x+k.width/2} y={k.y+k.height/2}>KEEP OUT</text></g>)}
        {airwires.map(w=><line key={`${w.net}:${w.from.id}:${w.to.id}`} className="airwire" x1={w.from.x} y1={w.from.y} x2={w.to.x} y2={w.to.y}/>)}
        {puzzle.switches.map(s=>{const rotation=board.switchRotations[s.id]??s.rotation;return <g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${rotation})`} onClick={e=>{if(tool==='switch'){e.stopPropagation();setSelectedSwitch(s.id);setNotice(`${s.id} 選択中 · Qで左に90°回転`)}}}><rect className={`switch ${selectedSwitch===s.id&&tool==='switch'?'selected':''}`} x={-MX_3PIN.housingHalf} y={-MX_3PIN.housingHalf} width={MX_3PIN.housingHalf*2} height={MX_3PIN.housingHalf*2} rx="1.5"/><circle className="switch-hole-ring" r={MX_3PIN.centerHoleRadius+.45}/><circle className="switch-hole" r={MX_3PIN.centerHoleRadius} onClick={e=>{if(tool!=='switch'){e.stopPropagation();setNotice(`${s.id} 中心穴は配線できません`)}}}/><text className="part-label" y="-9" transform={`rotate(${-rotation})`}>{s.id}</text></g>})}
        <g transform={`translate(${puzzle.mcu.x} ${puzzle.mcu.y})`}><rect className="mcu" x="-4" y="-13" width="16" height="26" rx="1"/><text className="mcu-label" x="4" y="-15">MCU</text><text className="mcu-chip" x="4" y="2">◈</text></g>
        {tool==='place'&&selected&&cursor&&inside(puzzle,cursor)&&<g className="diode-ghost" transform={`translate(${safeDiodePosition(cursor).x} ${safeDiodePosition(cursor).y}) rotate(${previewBoard.diodes.find(d=>d.switchId===selected)?.rotation??0})`}><rect x="-3.5" y="-1.6" width="7" height="3.2" rx=".5"/><path d="M-1 -1 L1 0 L-1 1 Z M1 -1 L1 1"/></g>}
        {previewBoard.diodes.filter(d=>d.position).map(d=><g key={d.switchId} transform={`translate(${d.position!.x} ${d.position!.y}) rotate(${d.rotation})`} onPointerDown={e=>startDiodeDrag(d,e)} onClick={e=>{e.stopPropagation();if(suppressDragClick.current){suppressDragClick.current=false;return}if(tool==='place'){setSelected(d.switchId);setNotice(`${d.switchId} 選択中 · ドラッグまたは盤面クリックで移動 · Rで回転`)}}}><rect className={`diode ${selected===d.switchId?'selected':''} ${draggedDiode?.switchId===d.switchId?'dragging':''}`} x="-3.5" y="-1.6" width="7" height="3.2" rx=".5"/><path className="diode-symbol" d="M-1 -1 L1 0 L-1 1 Z M1 -1 L1 1"/><text className="diode-label" x="0" y="-3" transform={`rotate(${-d.rotation})`}>{d.switchId} D</text></g>)}
        {board.traces.map(t=><g key={t.id}>{routeLines(t.nodes,t.id,true)}{viaPoints(t.nodes).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>)}
        {draft&&<g opacity=".72">{routeLines(displayNodes,'draft')}{viaPoints(draft).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>}
        {allPads.map(pad=><g key={pad.id} className={`pad-group ${pad.kind==='diode'&&tool==='place'?'draggable-diode':''}`} onPointerDown={e=>{if(pad.kind==='diode'&&tool==='place'){const diode=previewBoard.diodes.find(d=>pad.id===`${d.switchId}:A`||pad.id===`${d.switchId}:K`);if(diode)startDiodeDrag(diode,e)}}} onClick={e=>onPad(pad,e)}><circle className={`pad ${pad.kind}`} cx={pad.x} cy={pad.y} r={pad.kind==='switch'?MX_3PIN.copperRadius:1.25}/>{pad.kind==='switch'&&<circle className="pad-drill" cx={pad.x} cy={pad.y} r={MX_3PIN.pinDrillRadius}/>}<circle className="pad-hit" cx={pad.x} cy={pad.y} r={pad.kind==='switch'?2.4:2.8}/><title>{pad.label}</title></g>)}
        {puzzle.mcu.pins.map((pin,i)=>{const right=puzzle.mcu.x+31<=puzzle.board.width;return <text key={pin.number} className="mcu-pin-label" x={right?puzzle.mcu.x+13:puzzle.mcu.x-10} y={puzzle.mcu.y-8+i*4} textAnchor={right?'start':'end'}>{pin.number} · {pin.role}</text>})}
        {result&&checked.issues.map((issue,i)=><g key={i}><circle className={`issue ${issue.fatal?'fatal':'warning'}`} cx={issue.point.x} cy={issue.point.y} r="3"/><text className="issue-mark" x={issue.point.x} y={issue.point.y+.8}>!</text></g>)}
      </svg><div className="canvas-hint">ホイール: ズーム <span>·</span> 中ボタン: パン <span>·</span> Esc: 中断</div></div>
      <div className="status"><span className="status-led"/>{notice}<span className="coords">{cursor?`${cursor.x}, ${cursor.y} mm`:''}</span></div>
    </section>
    <aside><div className="panel-title">WORKBENCH <span>{puzzle.id.toUpperCase()}</span></div><h2>{puzzle.title}</h2><p className="panel-intro">{puzzle.switches.length}つのキーを{puzzle.matrix.rows}×{puzzle.matrix.cols}の行列へ。各キーのダイオードを置き、MCUの{puzzle.mcu.pins.length}本のピンまで配線してください。点線は未接続のラッツネストです。</p>{dayNumber>0&&<div className="daily-nav"><button disabled={dayNumber<=1} onClick={()=>navigateDay(dayNumber-1)}>← 前の問題</button><button onClick={()=>navigateDay(todayNumber())}>今日の問題</button><button disabled={dayNumber>=todayNumber()} onClick={()=>navigateDay(dayNumber+1)}>次の問題 →</button></div>}
      <div className="section-label">スイッチ</div><p className="tool-guidance">盤面上のスイッチを選んでから回転します。操作ツールは盤面の上に常時表示されます。</p><button className="secondary full" onClick={rotateSwitch} disabled={!selectedSwitch}>↶ スイッチを左に90° <kbd>Q</kbd></button>
      <div className="section-label">DIODE INVENTORY <span>{board.diodes.filter(d=>d.position).length} / {board.diodes.length}</span></div><p className="tool-guidance">1つ選択 → 盤面をクリック。続けて次の未配置部品を置けます。配置後もドラッグで調整できます。</p><div className="inventory">{board.diodes.map(d=><button key={d.switchId} className={selected===d.switchId?'picked':''} onClick={()=>{setTool('place');setSelected(d.switchId);setDraft(null);setNotice(`${d.switchId} を選択 · 盤面をクリックして配置 · Rで回転`)}}>{d.switchId}<span>{d.position?'配置済':'未配置'}</span></button>)}</div><button className="secondary full" onClick={rotateDiode} disabled={!selected}>↻ ダイオードを回転 <kbd>R</kbd></button>
      <div className="section-label">ROUTING</div><div className="layer-box"><span className={`layer-swatch ${liveLayer==='F.Cu'?'front':'back'}`}/><strong>{liveLayer}</strong><span>現在のレイヤー</span></div><div className="layer-picker" role="group" aria-label="配線レイヤー">{(['F.Cu','B.Cu'] as const).map(layer=><button key={layer} type="button" className={liveLayer===layer?'active':''} aria-pressed={liveLayer===layer} onClick={()=>changeLayer(layer)}><span className={`layer-swatch ${layer==='F.Cu'?'front':'back'}`}/>{layer}</button>)}</div><div className="action-row"><button className="secondary" onClick={()=>changeLayer()}>⊙ VIA <kbd>V</kbd></button><button className="secondary" onClick={undo} disabled={!past.length}>↶ UNDO</button><button className="secondary" onClick={redo} disabled={!future.length}>↷ REDO</button></div>
      <div className="section-label">RULES</div><div className="rules"><div><span>未接続・ショート</span><b>−10</b></div><div><span>キープアウト</span><b>−5</b></div><div><span>北向きスイッチ</span><b>−3</b></div><div><span>ビア</span><b>−1</b></div></div><p className="direction">DIODE DIRECTION <b>{puzzle.matrix.diodeDirection}</b></p>
    </aside></main>
    <footer><button className="reset" onClick={()=>{commit(initialState(puzzle));setDraft(null);setSelected(null);setSelectedSwitch(null);setNotice('盤面をリセット')}}>RESET</button><div className="footer-note">SELECT F.Cu / B.Cu → CLICK PAD <span>·</span> V TO PLACE VIA</div><button className="check" onClick={()=>{setResult(true);setNotice(checked.clear?'CLEAR!':'問題箇所を盤面に表示しています')}}>CHECK / SUBMIT <span>→</span></button></footer>
    {result&&<div className="result-backdrop" onClick={()=>setResult(false)}><div className="result-card" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setResult(false)}>×</button><div className="eyebrow">{puzzle.id.toUpperCase()} / RESULT</div><h2 className={checked.clear?'clear':'incomplete'}>{checked.clear?'CLEAR':'NOT YET'}</h2><div className="total"><span>TOTAL SCORE</span><strong>{checked.score}</strong></div><div className="result-grid"><div>接続エラー <b>{checked.missing+checked.shorts}</b></div><div>キープアウト <b>{checked.keepout}</b></div><div>ビア <b>{checked.viaCount}</b></div><div>配線長 <b>{checked.length.toFixed(1)} mm</b></div></div>{checked.issues.length>0&&<div className="issue-list">{checked.issues.map((issue,i)=><p key={i} className={issue.fatal?'bad':'warn'}>{issue.message}</p>)}</div>}<button className="continue" onClick={()=>setResult(false)}>盤面に戻る</button></div></div>}
    {editorOpen&&<Editor source={puzzle} onClose={()=>setEditorOpen(false)} onPlay={next=>{setEditorOpen(false);setPuzzle(next);setBoard(initialState(next));setPast([]);setFuture([]);setDraft(null);setSelected(null);setSelectedSwitch(null);setView({x:0,y:0,w:next.board.width,h:next.board.height});location.hash=`p=${encodePuzzle(next)}`}}/>}
  </div>
}
