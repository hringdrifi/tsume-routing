import type {Puzzle,Rotation} from './model'
import {day001,validatePuzzle} from './puzzle'

// Daily Route 001 starts on 2026-09-21 in Japan.
const FIRST_DAY=Date.UTC(2026,8,21)
export const DAILY_COUNT=100

type Key={x:number;y:number;row:number;col:number;rotation:Rotation}
type DailyDefinition={
  title:string
  board:{width:number;height:number}
  matrix:{rows:number;cols:number;diodeDirection:Puzzle['matrix']['diodeDirection']}
  keys:Key[]
  mcu:{x:number;y:number;roles:string[]}
  keepouts:Puzzle['keepouts']
}

const rotations=[0,90,180,270] as const
const keys=(items:Omit<Key,'rotation'>[],offset=0):Key[]=>items.map((key,index)=>({...key,rotation:rotations[(index+offset)%rotations.length]}))
const grid=(rows:number,cols:number,xs:number[],ys:number[],offset=0):Key[]=>keys(Array.from({length:rows*cols},(_,index)=>({x:xs[index%cols],y:ys[Math.floor(index/cols)],row:Math.floor(index/cols),col:index%cols})),offset)

const DAYS:DailyDefinition[]=[
  {title:'First Route',board:{width:128,height:84},matrix:{rows:2,cols:3,diodeDirection:'COL2ROW'},keys:grid(2,3,[19.05,38.1,57.15],[19.05,57.15],1),mcu:{x:104.775,y:38.1,roles:['ROW0','ROW1','COL0','COL1','COL2']},keepouts:[{id:'KO1',type:'rect',x:38.1,y:33.3375,width:38.1,height:9.525}]},
  {title:'Corner Cut',board:{width:112,height:78},matrix:{rows:2,cols:2,diodeDirection:'ROW2COL'},keys:keys([{x:20,y:18,row:0,col:0},{x:52,y:27,row:0,col:1},{x:20,y:56,row:1,col:0},{x:52,y:47,row:1,col:1}],2),mcu:{x:88,y:31,roles:['COL1','ROW0','COL0','ROW1']},keepouts:[{id:'KO1',type:'rect',x:32,y:35,width:27,height:4},{id:'KO2',type:'rect',x:65,y:14,width:12,height:18}]},
  {title:'Nine Point',board:{width:142,height:96},matrix:{rows:3,cols:3,diodeDirection:'COL2ROW'},keys:grid(3,3,[18,44,70],[18,45,72],3),mcu:{x:113,y:29,roles:['COL2','ROW1','COL0','ROW2','COL1','ROW0']},keepouts:[{id:'KO1',type:'rect',x:49,y:30,width:21,height:5},{id:'KO2',type:'rect',x:85,y:60,width:12,height:13}]},
  {title:'Long Row',board:{width:154,height:68},matrix:{rows:1,cols:6,diodeDirection:'ROW2COL'},keys:grid(1,6,[16,36,56,76,96,116],[27],0),mcu:{x:135,y:20,roles:['COL3','COL0','ROW0','COL5','COL2','COL4','COL1']},keepouts:[{id:'KO1',type:'rect',x:49,y:38,width:35,height:11},{id:'KO2',type:'rect',x:120,y:2,width:7,height:7}]},
  {title:'Eight Fold',board:{width:146,height:91},matrix:{rows:2,cols:4,diodeDirection:'COL2ROW'},keys:grid(2,4,[18,40,62,84],[20,65],2),mcu:{x:120,y:26,roles:['ROW1','COL2','COL0','ROW0','COL3','COL1']},keepouts:[{id:'KO1',type:'rect',x:41,y:38,width:23,height:15},{id:'KO2',type:'rect',x:74,y:34,width:24,height:10}]},
  {title:'Tall Order',board:{width:118,height:124},matrix:{rows:3,cols:2,diodeDirection:'ROW2COL'},keys:grid(3,2,[22,55],[20,54,88],1),mcu:{x:91,y:42,roles:['COL0','ROW2','ROW0','COL1','ROW1']},keepouts:[{id:'KO1',type:'rect',x:35,y:36,width:21,height:9},{id:'KO2',type:'rect',x:35,y:70,width:21,height:9}]},
  {title:'Split Level',board:{width:144,height:90},matrix:{rows:2,cols:3,diodeDirection:'COL2ROW'},keys:keys([{x:19,y:19,row:0,col:0},{x:47,y:28,row:0,col:1},{x:75,y:19,row:0,col:2},{x:19,y:67,row:1,col:0},{x:47,y:58,row:1,col:1},{x:75,y:67,row:1,col:2}],3),mcu:{x:116,y:34,roles:['COL1','ROW1','COL2','ROW0','COL0']},keepouts:[{id:'KO1',type:'rect',x:43,y:38,width:31,height:10}]},
  {title:'Twelve Steps',board:{width:158,height:118},matrix:{rows:4,cols:3,diodeDirection:'ROW2COL'},keys:grid(4,3,[18,46,74],[17,43,69,95],0),mcu:{x:126,y:30,roles:['ROW3','COL0','ROW1','COL2','ROW0','COL1','ROW2']},keepouts:[{id:'KO1',type:'rect',x:28,y:27,width:10,height:8},{id:'KO2',type:'rect',x:28,y:78,width:10,height:8},{id:'KO3',type:'rect',x:88,y:47,width:20,height:18}]},
  {title:'Missing Center',board:{width:146,height:104},matrix:{rows:3,cols:3,diodeDirection:'COL2ROW'},keys:keys([{x:18,y:18,row:0,col:0},{x:48,y:18,row:0,col:1},{x:78,y:18,row:0,col:2},{x:18,y:50,row:1,col:0},{x:78,y:50,row:1,col:2},{x:18,y:82,row:2,col:0},{x:48,y:82,row:2,col:1},{x:78,y:82,row:2,col:2}],2),mcu:{x:119,y:31,roles:['COL1','ROW2','ROW0','COL0','ROW1','COL2']},keepouts:[{id:'KO1',type:'rect',x:40,y:39,width:20,height:22},{id:'KO2',type:'rect',x:87,y:13,width:15,height:20}]},
  {title:'Four by Three',board:{width:172,height:110},matrix:{rows:3,cols:4,diodeDirection:'ROW2COL'},keys:grid(3,4,[17,40,63,86],[18,51,84],1),mcu:{x:139,y:27,roles:['COL3','ROW1','COL0','ROW2','COL2','ROW0','COL1']},keepouts:[{id:'KO1',type:'rect',x:41,y:34,width:24,height:8},{id:'KO2',type:'rect',x:66,y:67,width:24,height:8},{id:'KO3',type:'rect',x:102,y:45,width:21,height:16}]},
]

const GENERATED_MATRICES=[
  {rows:1,cols:4},{rows:1,cols:5},{rows:2,cols:2},{rows:2,cols:3},{rows:2,cols:4},
  {rows:3,cols:2},{rows:3,cols:3},{rows:4,cols:2},{rows:3,cols:4},{rows:4,cols:3},
] as const

const shuffleRoles=(rows:number,cols:number,seed:number):string[]=>{
  const roles=[...Array.from({length:rows},(_,index)=>`ROW${index}`),...Array.from({length:cols},(_,index)=>`COL${index}`)]
  let state=seed
  for(let index=roles.length-1;index>0;index--){
    state=(state*1103515245+12345)>>>0
    const target=state%(index+1)
    ;[roles[index],roles[target]]=[roles[target],roles[index]]
  }
  return roles
}

const generatedDefinition=(number:number):DailyDefinition=>{
  const seed=number-11,shape=GENERATED_MATRICES[seed%GENERATED_MATRICES.length]
  const spacingX=21+(seed%3)*2,spacingY=22+(seed%4)*2,layout=Math.floor(seed/GENERATED_MATRICES.length)%5
  const keys=grid(shape.rows,shape.cols,
    Array.from({length:shape.cols},(_,col)=>19+col*spacingX),
    Array.from({length:shape.rows},(_,row)=>18+row*spacingY),seed%4
  ).map(key=>({
    ...key,
    x:key.x+(layout===1&&key.row%2?5:0)+(layout===2?key.row*2:0),
    y:key.y+(layout===3&&key.col%2?4:0)+(layout===4?(key.col%3)*2:0),
  }))
  const diodeDirection=seed%2?'ROW2COL':'COL2ROW'
  const firstY=12+(seed*11)%46,secondY=70+(seed*7)%30
  return {
    title:`Pattern ${String(number).padStart(3,'0')}`,
    board:{width:172,height:132},
    matrix:{...shape,diodeDirection},
    keys,
    mcu:{x:150,y:24+(seed%4)*8,roles:shuffleRoles(shape.rows,shape.cols,seed+1)},
    keepouts:[
      {id:'KO1',type:'rect',x:128,y:firstY,width:12,height:9},
      {id:'KO2',type:'rect',x:134,y:secondY,width:7,height:12},
    ],
  }
}

export function todayNumber(now=new Date()):number{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now)
  const get=(type:string)=>Number(parts.find(x=>x.type===type)?.value)
  return Math.max(1,Math.floor((Date.UTC(get('year'),get('month')-1,get('day'))-FIRST_DAY)/86400000)+1)
}

export function isDebugMode(search=location.search):boolean{return new URLSearchParams(search).has('debug')}
export function lastAvailableDay(now=new Date(),debug=false):number{return debug?DAILY_COUNT:Math.min(DAILY_COUNT,todayNumber(now))}

export function dailyPuzzle(number:number):Puzzle{
  if(!Number.isInteger(number)||number<1||number>DAILY_COUNT)throw Error('問題番号が不正です')
  if(number===1)return day001
  const definition=DAYS[number-1]??generatedDefinition(number)
  return validatePuzzle({
    id:`day${String(number).padStart(3,'0')}`,
    title:`Daily Route ${String(number).padStart(3,'0')} — ${definition.title}`,
    board:definition.board,
    matrix:definition.matrix,
    switches:definition.keys.map((key,index)=>({id:`SW${index+1}`,...key})),
    mcu:{x:definition.mcu.x,y:definition.mcu.y,pins:definition.mcu.roles.map((role,index)=>({number:index+1,role}))},
    keepouts:definition.keepouts,
    scoring:day001.scoring,
  })
}
