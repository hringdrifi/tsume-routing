import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import type {BoardState,Layer,Point,RouteNode,Rotation,Trace,Puzzle} from './lib/model'
import {initialState} from './lib/model'
import {day001,inside,pads} from './lib/puzzle'
import {puzzleFromLocation} from './lib/share'
import {evaluate} from './lib/engine'
import {grid,gridStep,GRID_OPTIONS,KEY_UNIT_MM,near,snapPath,traceSegments,type GridDenominator} from './lib/geometry'
import {encodePuzzle} from './lib/share'
import Editor from './Editor'
import {loadProgress,saveProgress} from './lib/progress'
import {todayNumber} from './lib/daily'

const other=(l:Layer):Layer=>l==='F.Cu'?'B.Cu':'F.Cu'
const asNodes=(from:RouteNode,to:Point):RouteNode[]=>snapPath(from,to).filter(p=>!near(p,from)).map(p=>({...p,layer:from.layer}))
type Tool='route'|'place'|'delete'
export default function App(){
  const [puzzle,setPuzzle]=useState<Puzzle>(()=>{try{return puzzleFromLocation()}catch{return day001}})
  const [board,setBoard]=useState<BoardState>(()=>loadProgress(puzzle)??initialState(puzzle))
  const [past,setPast]=useState<BoardState[]>([]),[future,setFuture]=useState<BoardState[]>([])
  const [tool,setTool]=useState<Tool>('route'),[selected,setSelected]=useState<string|null>(null)
  const [draft,setDraft]=useState<RouteNode[]|null>(null),[cursor,setCursor]=useState<Point|null>(null)
  const [result,setResult]=useState(false),[notice,setNotice]=useState('パッドをクリックして配線を開始')
  const [editorOpen,setEditorOpen]=useState(false)
  const [view,setView]=useState({x:0,y:0,w:puzzle.board.width,h:puzzle.board.height})
  const [gridDenominator,setGridDenominator]=useState<GridDenominator>(()=>{try{const n=Number(localStorage.getItem('tsume-grid-v1'));return GRID_OPTIONS.includes(n as GridDenominator)?n as GridDenominator:48}catch{return 48}})
  const svg=useRef<SVGSVGElement>(null),drag=useRef<Point|null>(null),seq=useRef(0)
  const allPads=useMemo(()=>pads(puzzle,board),[puzzle,board])
  const checked=useMemo(()=>evaluate(puzzle,board),[puzzle,board])
  useEffect(()=>{saveProgress(puzzle,board)},[puzzle,board])
  useEffect(()=>{try{localStorage.setItem('tsume-grid-v1',String(gridDenominator))}catch{/* Grid preference is optional. */}},[gridDenominator])
  useEffect(()=>{const load=()=>{try{const next=puzzleFromLocation();setPuzzle(next);setBoard(loadProgress(next)??initialState(next));setPast([]);setFuture([]);setDraft(null);setSelected(null);setView({x:0,y:0,w:next.board.width,h:next.board.height});setResult(false);setNotice(`${next.title} を読み込みました`)}catch(e){setNotice(e instanceof Error?e.message:'問題を読み込めませんでした')}};window.addEventListener('hashchange',load);return()=>window.removeEventListener('hashchange',load)},[])
  const commit=useCallback((next:BoardState)=>{setPast(p=>[...p,board]);setFuture([]);setBoard(next);setResult(false)},[board])
  const undo=useCallback(()=>{if(!past.length)return;setFuture(f=>[board,...f]);setBoard(past[past.length-1]);setPast(p=>p.slice(0,-1));setDraft(null);setResult(false)},[board,past])
  const redo=useCallback(()=>{if(!future.length)return;setPast(p=>[...p,board]);setBoard(future[0]);setFuture(f=>f.slice(1));setDraft(null);setResult(false)},[board,future])
  const pt=(e:React.MouseEvent<SVGSVGElement>):Point=>{const p=svg.current!.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.current!.getScreenCTM()!.inverse());return {x:grid(q.x,gridDenominator),y:grid(q.y,gridDenominator)}}
  const finish=(target:Point)=>{
    if(!draft)return
    const tail=draft[draft.length-1],end=asNodes(tail,target),nodes=[...draft,...end]
    if(nodes.length<2){setDraft(null);return}
    const trace:Trace={id:`T${++seq.current}`,nodes}
    commit({...board,traces:[...board.traces,trace]});setDraft(null);setNotice(`${trace.id} を追加`)
  }
  const addVia=()=>{
    if(!draft||!cursor){setNotice('配線中にVでビアを配置できます');return}
    if(!inside(puzzle,cursor))return
    const tail=draft[draft.length-1],path=asNodes(tail,cursor),at=path.at(-1)??tail
    setDraft([...draft,...path,{...at,layer:other(at.layer)}]);setNotice(`${other(at.layer)} に切り替え`)
  }
  const rotateDiode=()=>{
    if(!selected)return
    const next=board.diodes.map(d=>d.switchId===selected?{...d,rotation:((d.rotation+90)%360) as Rotation}:d)
    commit({...board,diodes:next});setNotice(`${selected} ダイオードを回転`)
  }
  useEffect(()=>{const handler=(e:KeyboardEvent)=>{
    if(editorOpen||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
    if(e.key==='Escape'){setDraft(null);setSelected(null);setNotice('操作を中断');return}
    if(e.key==='Backspace'&&draft){e.preventDefault();setDraft(draft.length>1?draft.slice(0,-1):null);return}
    if(e.key.toLowerCase()==='v'){e.preventDefault();addVia()}
    if(e.key.toLowerCase()==='r'&&selected){e.preventDefault();rotateDiode()}
  };window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)})
  const onBoardClick=(e:React.MouseEvent<SVGSVGElement>)=>{
    const pos=pt(e);if(!inside(puzzle,pos))return
    if(tool==='place'&&selected){const safe={x:Math.max(4,Math.min(puzzle.board.width-4,pos.x)),y:Math.max(4,Math.min(puzzle.board.height-4,pos.y))};commit({...board,diodes:board.diodes.map(d=>d.switchId===selected?{...d,position:safe}:d)});setNotice(`${selected} ダイオードを配置`);return}
    if(tool==='route'&&draft){const tail=draft[draft.length-1];setDraft([...draft,...asNodes(tail,pos)]);setNotice('クリックで折れ点を追加 · Vでビア')}
  }
  const onPad=(pad:typeof allPads[number],e:React.MouseEvent)=>{
    e.stopPropagation();if(tool!=='route')return
    if(!draft){setDraft([{x:pad.x,y:pad.y,layer:'F.Cu'}]);setCursor(pad);setNotice(`${pad.label} から配線中`);return}
    if(draft[draft.length-1].layer!=='F.Cu'){setNotice('パッドへはF.Cuで接続してください');return}
    finish(pad)
  }
  const preview=draft&&cursor?asNodes(draft[draft.length-1],cursor):[]
  const displayNodes=draft?[...draft,...preview]:[]
  const viaPoints=(nodes:RouteNode[])=>nodes.slice(1).filter((n,i)=>n.layer!==nodes[i].layer)
  const routeLines=(nodes:RouteNode[],id:string,interactive=false)=>traceSegments(nodes).map((s,i)=><line key={`${id}-${i}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} className={`trace ${s.layer==='F.Cu'?'front':'back'} ${interactive?'existing':'preview'}`} onClick={interactive&&tool==='delete'?(e)=>{e.stopPropagation();commit({...board,traces:board.traces.filter(t=>t.id!==id)});setNotice(`${id} を削除`)}:undefined}/> )
  const liveLayer=draft?.at(-1)?.layer??'F.Cu'
  const dayNumber=Number(puzzle.id.match(/^day(\d+)$/)?.[1]??0)
  const navigateDay=(n:number)=>{location.href=`${import.meta.env.BASE_URL}?puzzle=day${String(n).padStart(3,'0')}`}
  return <div className="app"><header><div className="brand"><span className="brand-mark">◈</span><div><strong>詰配線</strong><small>TSUME ROUTING <b>/</b> A KEYBOARD PCB PUZZLE</small></div></div><div className="header-right"><button className="open-editor" onClick={()=>setEditorOpen(true)}>問題を作る</button><span className="day">{puzzle.id.toUpperCase()}</span><span className="score">SCORE <b>{checked.score}</b></span></div></header>
    <main><section className="workspace"><div className="board-bar"><span><i className="live-dot"/> PCB EDITOR <em>{puzzle.board.width} × {puzzle.board.height} mm</em></span><label className="grid-control">GRID <select aria-label="操作グリッド" value={gridDenominator} onChange={e=>setGridDenominator(Number(e.target.value) as GridDenominator)}>{GRID_OPTIONS.map(d=><option key={d} value={d}>1/{d}u ({gridStep(d).toFixed(4)} mm)</option>)}</select><b>·</b> 2 LAYERS</label></div>
      <div className="canvas-wrap"><svg ref={svg} viewBox={`${view.x-3} ${view.y-3} ${view.w+6} ${view.h+6}`} onMouseMove={e=>{if(drag.current){const p=pt(e),dx=p.x-drag.current.x,dy=p.y-drag.current.y;setView(v=>({...v,x:v.x-dx,y:v.y-dy}));return}setCursor(pt(e))}} onMouseDown={e=>{if(e.button===1){e.preventDefault();drag.current=pt(e)}}} onMouseUp={()=>drag.current=null} onMouseLeave={()=>drag.current=null} onWheel={e=>{e.preventDefault();const factor=e.deltaY>0?1.12:0.88;setView(v=>({x:v.x+(v.w-v.w*factor)/2,y:v.y+(v.h-v.h*factor)/2,w:Math.max(45,Math.min(200,v.w*factor)),h:Math.max(30,Math.min(135,v.h*factor))}))}} onClick={onBoardClick}>
        <defs><pattern id="grid-major" width={KEY_UNIT_MM} height={KEY_UNIT_MM} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".22" fill="var(--grid-dot)"/></pattern><pattern id="grid-minor" width={gridStep(gridDenominator)} height={gridStep(gridDenominator)} patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".08" fill="var(--grid-dot)"/></pattern></defs>
        <rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" className="pcb"/>{view.w<65&&<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-minor)"/>}<rect x="0" y="0" width={puzzle.board.width} height={puzzle.board.height} rx="2" fill="url(#grid-major)"/>
        {puzzle.keepouts.map(k=><g key={k.id}><rect className="keepout" x={k.x} y={k.y} width={k.width} height={k.height}/><text className="keepout-text" x={k.x+k.width/2} y={k.y+k.height/2}>KEEP OUT</text></g>)}
        {puzzle.switches.map(s=><g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${s.rotation})`}><rect className="switch" x="-7" y="-7" width="14" height="14" rx="1.5"/><circle className="switch-core" r="3.2"/><path className="switch-arc" d="M-5 -5 L-2 -5 M5 -5 L5 -2"/><text className="part-label" y="-9" transform={`rotate(${-s.rotation})`}>{s.id}</text></g>)}
        <g transform={`translate(${puzzle.mcu.x} ${puzzle.mcu.y})`}><rect className="mcu" x="-4" y="-13" width="16" height="26" rx="1"/><text className="mcu-label" x="4" y="-15">MCU</text><text className="mcu-chip" x="4" y="2">◈</text></g>
        {board.diodes.filter(d=>d.position).map(d=><g key={d.switchId} transform={`translate(${d.position!.x} ${d.position!.y}) rotate(${d.rotation})`} onClick={e=>{if(tool==='place'){e.stopPropagation();setSelected(d.switchId);setNotice(`${d.switchId} 選択中 · 盤面クリックで移動 · Rで回転`)}}}><rect className={`diode ${selected===d.switchId?'selected':''}`} x="-3.5" y="-1.6" width="7" height="3.2" rx=".5"/><path className="diode-symbol" d="M-1 -1 L1 0 L-1 1 Z M1 -1 L1 1"/><text className="diode-label" x="0" y="-3" transform={`rotate(${-d.rotation})`}>{d.switchId} D</text></g>)}
        {board.traces.map(t=><g key={t.id}>{routeLines(t.nodes,t.id,true)}{viaPoints(t.nodes).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>)}
        {draft&&<g opacity=".72">{routeLines(displayNodes,'draft')}{viaPoints(draft).map((v,i)=><circle key={i} className="via" cx={v.x} cy={v.y} r="1.35"/>)}</g>}
        {allPads.map(pad=><g key={pad.id} className="pad-group" onClick={e=>onPad(pad,e)}><circle className={`pad ${pad.kind}`} cx={pad.x} cy={pad.y} r="1.25"/><circle className="pad-hit" cx={pad.x} cy={pad.y} r="2.8"/><title>{pad.label}</title></g>)}
        {result&&checked.issues.map((issue,i)=><g key={i}><circle className={`issue ${issue.fatal?'fatal':'warning'}`} cx={issue.point.x} cy={issue.point.y} r="3"/><text className="issue-mark" x={issue.point.x} y={issue.point.y+.8}>!</text></g>)}
      </svg><div className="canvas-hint">ホイール: ズーム <span>·</span> 中ボタン: パン <span>·</span> Esc: 中断</div></div>
      <div className="status"><span className="status-led"/>{notice}<span className="coords">{cursor?`${cursor.x}, ${cursor.y} mm`:''}</span></div>
    </section>
    <aside><div className="panel-title">WORKBENCH <span>{puzzle.id.toUpperCase()}</span></div><h2>{puzzle.title}</h2><p className="panel-intro">{puzzle.switches.length}つのキーを{puzzle.matrix.rows}×{puzzle.matrix.cols}の行列へ。各キーのダイオードを置き、{puzzle.mcu.pins.length}本のGPIOまで配線してください。</p>{dayNumber>0&&<div className="daily-nav"><button disabled={dayNumber<=1} onClick={()=>navigateDay(dayNumber-1)}>← 前の問題</button><button onClick={()=>navigateDay(todayNumber())}>今日の問題</button><button disabled={dayNumber>=todayNumber()} onClick={()=>navigateDay(dayNumber+1)}>次の問題 →</button></div>}
      <div className="section-label">TOOLS</div><div className="tool-row"><button className={tool==='route'?'active':''} onClick={()=>{setTool('route');setSelected(null)}}>⌁ <span>ROUTE</span></button><button className={tool==='place'?'active':''} onClick={()=>{setTool('place');setDraft(null)}}>◇ <span>DIODE</span></button><button className={tool==='delete'?'active':''} onClick={()=>{setTool('delete');setDraft(null)}}>⌫ <span>DELETE</span></button></div>
      <div className="section-label">DIODE INVENTORY <span>{board.diodes.filter(d=>d.position).length} / {board.diodes.length}</span></div><div className="inventory">{board.diodes.map(d=><button key={d.switchId} className={selected===d.switchId?'picked':''} onClick={()=>{setTool('place');setSelected(d.switchId);setDraft(null);setNotice(`${d.switchId} を盤面に配置 · Rで回転`)}}>{d.switchId}<span>{d.position?'●':'◇'}</span></button>)}</div><button className="secondary full" onClick={rotateDiode} disabled={!selected}>↻ ダイオードを回転 <kbd>R</kbd></button>
      <div className="section-label">ROUTING</div><div className="layer-box"><span className={`layer-swatch ${liveLayer==='F.Cu'?'front':'back'}`}/><strong>{liveLayer}</strong><span>現在のレイヤー</span></div><div className="action-row"><button className="secondary" onClick={addVia}>⊙ VIA <kbd>V</kbd></button><button className="secondary" onClick={undo} disabled={!past.length}>↶ UNDO</button><button className="secondary" onClick={redo} disabled={!future.length}>↷ REDO</button></div>
      <div className="section-label">RULES</div><div className="rules"><div><span>未接続・ショート</span><b>−10</b></div><div><span>キープアウト</span><b>−5</b></div><div><span>北向きスイッチ</span><b>−3</b></div><div><span>ビア</span><b>−1</b></div></div><p className="direction">DIODE DIRECTION <b>{puzzle.matrix.diodeDirection}</b></p>
    </aside></main>
    <footer><button className="reset" onClick={()=>{commit(initialState(puzzle));setDraft(null);setSelected(null);setNotice('盤面をリセット')}}>RESET</button><div className="footer-note">PAD → CLICK TO ROUTE <span>·</span> V TO CHANGE LAYER</div><button className="check" onClick={()=>{setResult(true);setNotice(checked.clear?'CLEAR!':'問題箇所を盤面に表示しています')}}>CHECK / SUBMIT <span>→</span></button></footer>
    {result&&<div className="result-backdrop" onClick={()=>setResult(false)}><div className="result-card" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setResult(false)}>×</button><div className="eyebrow">{puzzle.id.toUpperCase()} / RESULT</div><h2 className={checked.clear?'clear':'incomplete'}>{checked.clear?'CLEAR':'NOT YET'}</h2><div className="total"><span>TOTAL SCORE</span><strong>{checked.score}</strong></div><div className="result-grid"><div>接続エラー <b>{checked.missing+checked.shorts}</b></div><div>キープアウト <b>{checked.keepout}</b></div><div>ビア <b>{checked.viaCount}</b></div><div>配線長 <b>{checked.length.toFixed(1)} mm</b></div></div>{checked.issues.length>0&&<div className="issue-list">{checked.issues.map((issue,i)=><p key={i} className={issue.fatal?'bad':'warn'}>{issue.message}</p>)}</div>}<button className="continue" onClick={()=>setResult(false)}>盤面に戻る</button></div></div>}
    {editorOpen&&<Editor source={puzzle} onClose={()=>setEditorOpen(false)} onPlay={next=>{setEditorOpen(false);setPuzzle(next);setBoard(initialState(next));setPast([]);setFuture([]);setDraft(null);setSelected(null);setView({x:0,y:0,w:next.board.width,h:next.board.height});location.hash=`p=${encodePuzzle(next)}`}}/>}
  </div>
}
