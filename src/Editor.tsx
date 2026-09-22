import {useRef,useState} from 'react'
import type {Puzzle,Rotation,Point} from './lib/model'
import {encodePuzzle} from './lib/share'
import {validatePuzzle} from './lib/puzzle'
import {initialState} from './lib/model'
import {grid} from './lib/geometry'

type Props={source:Puzzle;onClose:()=>void;onPlay:(p:Puzzle)=>void}
type Selection={kind:'switch'|'keepout'|'mcu'|'diode';id:string}
const num=(v:string)=>Number(v)
const clone=(p:Puzzle)=>structuredClone(p)
const editable=(p:Puzzle):Puzzle=>({...clone(p),diodes:initialState(p).diodes})
export default function Editor({source,onClose,onPlay}:Props){
  const [draft,setDraft]=useState<Puzzle>(()=>editable(source)),[selection,setSelection]=useState<Selection|null>(null),[error,setError]=useState(''),[copied,setCopied]=useState(false)
  const svg=useRef<SVGSVGElement>(null),file=useRef<HTMLInputElement>(null)
  const drag=useRef<{selection:Selection;pointerId:number;start:Point;cursor:Point;moved:boolean}|null>(null),suppressClick=useRef(false)
  const update=(fn:(p:Puzzle)=>void)=>{setDraft(prev=>{const p=clone(prev);fn(p);p.diodes=p.diodes?.filter(d=>p.switches.some(s=>s.id===d.switchId));return p});setError('');setCopied(false)}
  const dimensions=(kind:'rows'|'cols',count:number)=>update(p=>{
    p.matrix[kind]=Math.max(1,Math.min(12,Math.floor(count)||1))
    p.switches=p.switches.filter(s=>s.row<p.matrix.rows&&s.col<p.matrix.cols)
    p.mcu.pins=Array.from({length:p.matrix.rows},(_,i)=>({number:i+1,role:`ROW${i}`})).concat(Array.from({length:p.matrix.cols},(_,i)=>({number:p.matrix.rows+i+1,role:`COL${i}`})))
  })
  const valid=()=>{try{return validatePuzzle(draft)}catch(e){setError(e instanceof Error?e.message:'問題データを確認してください');return null}}
  const play=()=>{const p=valid();if(p)onPlay(p)}
  const share=async()=>{const p=valid();if(!p)return;const url=`${location.origin}${import.meta.env.BASE_URL}#p=${encodePuzzle(p)}`;try{await navigator.clipboard.writeText(url);setCopied(true)}catch{setError('クリップボードにコピーできませんでした')}}
  const download=()=>{const p=valid();if(!p)return;const href=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=href;a.download=`${p.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000)}
  const importFile=async(f?:File)=>{if(!f)return;try{if(f.size>100000)throw Error('JSONが大きすぎます');const p=validatePuzzle(JSON.parse(await f.text()));setDraft(editable(p));setSelection(null);setError('')}catch(e){setError(e instanceof Error?e.message:'JSONを読み込めませんでした')}}
  const addSwitch=()=>update(p=>{const id=`SW${Math.max(0,...p.switches.map(s=>Number(s.id.replace(/\D/g,''))||0))+1}`;p.switches.push({id,x:grid(p.board.width/2,48),y:grid(p.board.height/2,48),rotation:90,row:0,col:0});p.diodes=initialState(p).diodes;setSelection({kind:'switch',id})})
  const addKeepout=()=>update(p=>{const id=`KO${Math.max(0,...p.keepouts.map(k=>Number(k.id.replace(/\D/g,''))||0))+1}`;p.keepouts.push({id,type:'rect',x:Math.max(0,Math.round(p.board.width/2)-6),y:Math.max(0,Math.round(p.board.height/2)-4),width:12,height:8});setSelection({kind:'keepout',id})})
  const rotate=()=>{if(!selection)return;update(p=>{const part=selection.kind==='switch'?p.switches.find(s=>s.id===selection.id):selection.kind==='diode'?p.diodes?.find(d=>d.switchId===selection.id):undefined;if(part)part.rotation=((part.rotation+270)%360) as Rotation})}
  const remove=()=>{if(!selection||selection.kind==='mcu'||selection.kind==='diode')return;update(p=>{if(selection.kind==='switch')p.switches=p.switches.filter(s=>s.id!==selection.id);else p.keepouts=p.keepouts.filter(k=>k.id!==selection.id)});setSelection(null)}
  const point=(e:{clientX:number;clientY:number}):Point=>{const sp=svg.current!.createSVGPoint();sp.x=e.clientX;sp.y=e.clientY;const pt=sp.matrixTransform(svg.current!.getScreenCTM()!.inverse());return {x:pt.x,y:pt.y}}
  const position=(sel:Selection):Point=>sel.kind==='switch'?draft.switches.find(s=>s.id===sel.id)!:sel.kind==='keepout'?draft.keepouts.find(k=>k.id===sel.id)!:sel.kind==='diode'?draft.diodes!.find(d=>d.switchId===sel.id)!.position!:draft.mcu
  const move=(sel:Selection,at:Point)=>update(p=>{
    const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,grid(n,48)))
    if(sel.kind==='switch'){const s=p.switches.find(s=>s.id===sel.id);if(s){s.x=clamp(at.x,7,p.board.width-7);s.y=clamp(at.y,7,p.board.height-7)}}
    else if(sel.kind==='keepout'){const k=p.keepouts.find(k=>k.id===sel.id);if(k){k.x=clamp(at.x,0,p.board.width-k.width);k.y=clamp(at.y,0,p.board.height-k.height)}}
    else if(sel.kind==='diode'){const d=p.diodes?.find(d=>d.switchId===sel.id);if(d)d.position={x:clamp(at.x,4,p.board.width-4),y:clamp(at.y,4,p.board.height-4)}}
    else{p.mcu.x=clamp(at.x,7,p.board.width-12);p.mcu.y=clamp(at.y,13,p.board.height-Math.max(13,-8+(p.mcu.pins.length-1)*4))}
  })
  const startDrag=(sel:Selection,e:React.PointerEvent<SVGElement>)=>{
    if(e.button!==0||drag.current)return
    e.preventDefault();e.stopPropagation();suppressClick.current=false;setSelection(sel)
    const at=position(sel);drag.current={selection:sel,pointerId:e.pointerId,start:{x:at.x,y:at.y},cursor:point(e),moved:false}
    svg.current!.setPointerCapture(e.pointerId)
  }
  const moveDrag=(e:React.PointerEvent<SVGSVGElement>)=>{
    const d=drag.current;if(!d||d.pointerId!==e.pointerId)return
    const at=point(e),dx=at.x-d.cursor.x,dy=at.y-d.cursor.y
    if(!d.moved&&Math.hypot(dx,dy)<.4)return
    d.moved=true;move(d.selection,{x:d.start.x+dx,y:d.start.y+dy})
  }
  const endDrag=(e:React.PointerEvent<SVGSVGElement>,cancel=false)=>{
    const d=drag.current;if(!d||d.pointerId!==e.pointerId)return
    if(cancel&&d.moved)move(d.selection,d.start)
    else if(!cancel)moveDrag(e)
    drag.current=null;suppressClick.current=true
    if(svg.current!.hasPointerCapture(e.pointerId))svg.current!.releasePointerCapture(e.pointerId)
    window.setTimeout(()=>{suppressClick.current=false},0)
  }
  const place=(e:React.MouseEvent<SVGSVGElement>)=>{if(suppressClick.current){suppressClick.current=false;return}if(selection)move(selection,point(e))}
  const diode=selection?.kind==='diode'?draft.diodes?.find(d=>d.switchId===selection.id):undefined
  const sw=selection?.kind==='switch'?draft.switches.find(s=>s.id===selection.id):undefined
  const ko=selection?.kind==='keepout'?draft.keepouts.find(k=>k.id===selection.id):undefined
  return <div className="editor-backdrop"><div className="editor" role="dialog" aria-modal="true" aria-label="問題エディタ"><div className="editor-head"><div><small>PUZZLE WORKSHOP</small><h2>問題を作る</h2></div><button onClick={onClose} aria-label="閉じる">×</button></div><div className="editor-body"><div className="editor-controls"><label>問題ID<input value={draft.id} onChange={e=>update(p=>{p.id=e.target.value})}/></label><label>タイトル<input value={draft.title} onChange={e=>update(p=>{p.title=e.target.value})}/></label><div className="editor-pair"><label>幅 mm<input type="number" min="30" max="500" value={draft.board.width} onChange={e=>update(p=>{p.board.width=num(e.target.value)})}/></label><label>高さ mm<input type="number" min="30" max="500" value={draft.board.height} onChange={e=>update(p=>{p.board.height=num(e.target.value)})}/></label></div><div className="editor-pair"><label>ROW数<input type="number" min="1" max="12" value={draft.matrix.rows} onChange={e=>dimensions('rows',num(e.target.value))}/></label><label>COL数<input type="number" min="1" max="12" value={draft.matrix.cols} onChange={e=>dimensions('cols',num(e.target.value))}/></label></div><label>ダイオード方向<select value={draft.matrix.diodeDirection} onChange={e=>update(p=>{p.matrix.diodeDirection=e.target.value as Puzzle['matrix']['diodeDirection']})}><option>COL2ROW</option><option>ROW2COL</option></select></label><label>北向きとして減点する角度<select value={draft.northRotation} onChange={e=>update(p=>{p.northRotation=num(e.target.value) as Rotation})}>{[0,90,180,270].map(r=><option key={r} value={r}>{r}°</option>)}</select></label><div className="editor-buttons"><button onClick={addSwitch}>＋ スイッチ</button><button onClick={addKeepout}>＋ キープアウト</button></div><p className="editor-help">部品をドラッグして移動。リストで選び、盤面をクリックして配置もできます。ダイオードは各スイッチに1個ずつ用意されます。</p><div className="editor-items">{draft.switches.map(s=><button key={s.id} className={selection?.kind==='switch'&&selection.id===s.id?'picked':''} onClick={()=>setSelection({kind:'switch',id:s.id})}>{s.id} <span>R{s.row} / C{s.col}</span></button>)}{draft.diodes?.map(d=><button key={'diode-'+d.switchId} className={selection?.kind==='diode'&&selection.id===d.switchId?'picked':''} onClick={()=>setSelection({kind:'diode',id:d.switchId})}>{d.switchId} D <span>ダイオード</span></button>)}{draft.keepouts.map(k=><button key={k.id} className={selection?.kind==='keepout'&&selection.id===k.id?'picked':''} onClick={()=>setSelection({kind:'keepout',id:k.id})}>{k.id} <span>KEEP OUT</span></button>)}<button className={selection?.kind==='mcu'?'picked':''} onClick={()=>setSelection({kind:'mcu',id:'MCU'})}>MCU <span>{draft.mcu.pins.length} ピン</span></button></div>{sw&&<div className="editor-selected"><strong>{sw.id}</strong><div className="editor-pair"><label>ROW<input type="number" min="0" max={draft.matrix.rows-1} value={sw.row} onChange={e=>update(p=>{p.switches.find(s=>s.id===sw.id)!.row=num(e.target.value)})}/></label><label>COL<input type="number" min="0" max={draft.matrix.cols-1} value={sw.col} onChange={e=>update(p=>{p.switches.find(s=>s.id===sw.id)!.col=num(e.target.value)})}/></label></div><button onClick={rotate}>↶ 左に90° · 現在 {sw.rotation}°</button><button onClick={remove}>削除</button></div>}{ko&&<div className="editor-selected"><strong>{ko.id}</strong><div className="editor-pair"><label>幅<input type="number" min="1" value={ko.width} onChange={e=>update(p=>{p.keepouts.find(k=>k.id===ko.id)!.width=num(e.target.value)})}/></label><label>高さ<input type="number" min="1" value={ko.height} onChange={e=>update(p=>{p.keepouts.find(k=>k.id===ko.id)!.height=num(e.target.value)})}/></label></div><button onClick={remove}>削除</button></div>}{diode&&<div className="editor-selected"><strong>{diode.switchId} ダイオード</strong><button onClick={rotate}>↶ 左に90° · 現在 {diode.rotation}°</button></div>}{selection?.kind==='mcu'&&<div className="editor-selected"><strong>MCUピンの割り当て</strong>{draft.mcu.pins.map(pin=><p key={pin.number}>ピン {pin.number} → {pin.role}</p>)}</div>}</div><div className="editor-preview"><svg ref={svg} viewBox={`0 0 ${draft.board.width||100} ${draft.board.height||60}`} onClick={place} onPointerMove={moveDrag} onPointerUp={e=>endDrag(e)} onPointerCancel={e=>endDrag(e,true)} onLostPointerCapture={e=>endDrag(e,true)}><rect className="pcb" width={draft.board.width} height={draft.board.height}/>{draft.keepouts.map(k=><rect key={k.id} className={`keepout ${selection?.kind==='keepout'&&selection.id===k.id?'chosen':''}`} x={k.x} y={k.y} width={k.width} height={k.height} onPointerDown={e=>startDrag({kind:'keepout',id:k.id},e)} onClick={e=>e.stopPropagation()}/>)}{draft.switches.map(s=><g key={s.id} onPointerDown={e=>startDrag({kind:'switch',id:s.id},e)} onClick={e=>e.stopPropagation()}><rect className={`editor-switch ${selection?.kind==='switch'&&selection.id===s.id?'chosen':''}`} x={s.x-7} y={s.y-7} width="14" height="14" rx="1"/><path className="editor-orientation" d={`M${s.x-4} ${s.y-4} L${s.x+4} ${s.y-4}`} transform={`rotate(${s.rotation} ${s.x} ${s.y})`}/><text x={s.x} y={s.y+1} className="editor-label">{s.id}</text></g>)}{draft.diodes?.map(d=><g key={'diode-'+d.switchId} transform={`translate(${d.position!.x} ${d.position!.y}) rotate(${d.rotation})`} onPointerDown={e=>startDrag({kind:'diode',id:d.switchId},e)} onClick={e=>e.stopPropagation()}><rect className={`editor-diode ${selection?.kind==='diode'&&selection.id===d.switchId?'chosen':''}`} x={-3.5} y={-1.6} width={7} height={3.2} rx={.5}/><path className="diode-symbol" d="M-1 -1 L1 0 L-1 1 Z M1 -1 L1 1"/><text className="editor-label" y={-3}>{d.switchId} D</text></g>)}<g onPointerDown={e=>startDrag({kind:'mcu',id:'MCU'},e)} onClick={e=>e.stopPropagation()}><rect className={`editor-mcu ${selection?.kind==='mcu'?'chosen':''}`} x={draft.mcu.x-6} y={draft.mcu.y-10} width="12" height="20"/><text x={draft.mcu.x} y={draft.mcu.y+1} className="editor-label">MCU</text></g></svg><p>基板 {draft.board.width} × {draft.board.height} mm · {draft.switches.length}キー · {draft.mcu.pins.length} ピン</p></div></div><div className="editor-foot"><div>{error&&<span className="editor-error">{error}</span>}</div><input ref={file} type="file" accept="application/json,.json" hidden onChange={e=>void importFile(e.target.files?.[0])}/><button onClick={()=>file.current?.click()}>JSON読込</button><button onClick={download}>JSON保存</button><button onClick={()=>void share()}>{copied?'コピー済み':'共有リンクをコピー'}</button><button className="editor-play" onClick={play}>この問題をプレイ →</button></div></div></div>
}
