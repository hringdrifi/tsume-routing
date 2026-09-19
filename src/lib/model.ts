export type Point = { x:number; y:number }
export type Layer = 'F.Cu' | 'B.Cu'
export type Rotation = 0 | 90 | 180 | 270
export type Puzzle = {
  id:string; title:string; board:{width:number;height:number};
  matrix:{rows:number;cols:number;diodeDirection:'COL2ROW'|'ROW2COL'};
  northRotation:Rotation;
  switches:{id:string;x:number;y:number;rotation:Rotation;row:number;col:number}[];
  mcu:{x:number;y:number;pins:{id:string;role:string}[]};
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
export const initialState = (p:Puzzle):BoardState => ({diodes:p.switches.map(s=>({switchId:s.id,position:null,rotation:0})),traces:[],switchRotations:Object.fromEntries(p.switches.map(s=>[s.id,s.rotation]))})
