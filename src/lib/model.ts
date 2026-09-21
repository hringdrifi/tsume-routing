import {grid,gridStep,ROUTING_GRID} from './geometry'

export type Point = { x:number; y:number }
export type Layer = 'F.Cu' | 'B.Cu'
export type Rotation = 0 | 90 | 180 | 270
export type Puzzle = {
  id:string; title:string; board:{width:number;height:number};
  matrix:{rows:number;cols:number;diodeDirection:'COL2ROW'|'ROW2COL'};
  northRotation:Rotation;
  switches:{id:string;x:number;y:number;rotation:Rotation;row:number;col:number}[];
  mcu:{x:number;y:number;pins:{number:number;role:string}[]};
  keepouts:{id:string;type:'rect';x:number;y:number;width:number;height:number}[];
  scoring:{base:number;connectionError:number;keepoutViolation:number;northSwitch:number;via:number};
}
export type Diode = { switchId:string; position:Point|null; rotation:Rotation }
export type RouteNode = Point & {layer:Layer}
export type Trace = {id:string;nodes:RouteNode[]}
export type BoardState = {diodes:Diode[];traces:Trace[];switchRotations:Record<string,Rotation>}
export type Pad = Point & {id:string;label:string;net:string;kind:'switch'|'diode'|'mcu'}
export type Issue = {kind:'disconnected'|'short'|'keepout'|'diode';message:string;point:Point;fatal:boolean}
export type Result = {clear:boolean;score:number;viaCount:number;length:number;issues:Issue[];missing:number;shorts:number;keepout:number;north:number}
function initialDiodes(p:Puzzle):Diode[]{
  const placed:Point[]=[]
  const snapPosition=(point:Point):Point=>{
    const step=gridStep(ROUTING_GRID)
    return {
      x:Math.max(Math.ceil(4/step)*step,Math.min(Math.floor((p.board.width-4)/step)*step,grid(point.x,ROUTING_GRID))),
      y:Math.max(Math.ceil(4/step)*step,Math.min(Math.floor((p.board.height-4)/step)*step,grid(point.y,ROUTING_GRID))),
    }
  }
  return p.switches.map(s=>{
    const towardCenter=s.y<p.board.height/2?1:-1
    const offsets=[
      {x:0,y:10*towardCenter},{x:0,y:-10*towardCenter},
      {x:10,y:0},{x:-10,y:0},{x:14,y:10*towardCenter},{x:-14,y:10*towardCenter}
    ]
    const candidates=offsets.map(o=>snapPosition({x:Math.max(4,Math.min(p.board.width-4,s.x+o.x)),y:Math.max(4,Math.min(p.board.height-4,s.y+o.y))}))
    const position=candidates.find(pt=>
      !p.keepouts.some(k=>pt.x>=k.x-4&&pt.x<=k.x+k.width+4&&pt.y>=k.y-3&&pt.y<=k.y+k.height+3)&&
      !p.switches.some(sw=>sw.id!==s.id&&Math.abs(pt.x-sw.x)<10.5&&Math.abs(pt.y-sw.y)<9.5)&&
      !placed.some(other=>Math.hypot(pt.x-other.x,pt.y-other.y)<8)
    )??candidates[0]
    placed.push(position)
    return {switchId:s.id,position,rotation:0}
  })
}
export const initialState = (p:Puzzle):BoardState => ({diodes:initialDiodes(p),traces:[],switchRotations:Object.fromEntries(p.switches.map(s=>[s.id,s.rotation]))})
