import type {Point,Rotation} from './model'

// Cherry MX 1u plate-mount footprint, measured from the non-plated center hole.
// KiCad SW_Cherry_MX_1.00u_Plate: pad 1 (0, 0), pad 2 (-6.35, 2.54),
// center hole (-2.54, 5.08) in its pad-1-relative coordinate system.
export const MX_3PIN={
  housingHalf:6.985,
  centerHoleRadius:2,
  copperRadius:1.1,
  pinDrillRadius:.75,
  pin1:{x:2.54,y:-5.08},
  pin2:{x:-3.81,y:-2.54},
} as const

export function rotatePoint(pt:Point,r:Rotation):Point{
  return r===0?pt:r===90?{x:-pt.y,y:pt.x}:r===180?{x:-pt.x,y:-pt.y}:{x:pt.y,y:-pt.x}
}

export function mxPin(center:Point,pin:1|2,rotation:Rotation):Point{
  const rotated=rotatePoint(pin===1?MX_3PIN.pin1:MX_3PIN.pin2,rotation)
  return {x:Number((center.x+rotated.x).toFixed(6)),y:Number((center.y+rotated.y).toFixed(6))}
}
