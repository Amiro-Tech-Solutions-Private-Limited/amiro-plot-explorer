import type { Piece } from './furniture';
import type { FlatLayout } from './walls';

export interface ReferencePart {
  model: 'Sofa' | 'ClubChair' | 'Bed' | 'Curtain' | 'Basin' | 'WC' | 'Plant' | 'Mirror' | 'WallRing' | 'FeatherPendant';
  x: number; y: number; z: number;
  width: number; height: number; depth: number;
  rotation: number;
  color?: string;
  room?: string;
}

/** Replace visual surfaces only; the original footprints remain the navigation contract. */
export function referenceFurniture(pieces: Piece[], layout: FlatLayout, replaced: Set<string> = new Set()) {
  const removed = new Set<Piece>();
  const parts: ReferencePart[] = [];
  const tagged = new Map<string, Piece[]>();
  for (const p of pieces) if (p.tag) tagged.set(p.tag, [...(tagged.get(p.tag) ?? []), p]);
  const bounds = (list: Piece[]) => {
    const x0=Math.min(...list.map(p=>p.x-p.sx/2)), x1=Math.max(...list.map(p=>p.x+p.sx/2));
    const z0=Math.min(...list.map(p=>p.z-p.sz/2)), z1=Math.max(...list.map(p=>p.z+p.sz/2));
    const y0=Math.min(...list.map(p=>p.y-p.sy/2)), y1=Math.max(...list.map(p=>p.y+p.sy/2));
    return { x:(x0+x1)/2, z:(z0+z1)/2, y:y0, width:x1-x0, height:y1-y0, depth:z1-z0 };
  };
  for (const [tag, list] of tagged) {
    if (replaced.has(tag) || tag.includes('#')) continue;
    const [name, feature] = tag.split('::');
    const room = layout.rooms.find(r=>r.name===name);
    if (!room) continue;
    const box=bounds(list);
    const dx=room.x+room.w/2-box.x, dz=room.y+room.h/2-box.z;
    const front=Math.abs(dx)>Math.abs(dz) ? (dx>0?Math.PI/2:-Math.PI/2) : dz>0?0:Math.PI;
    const fit = (model: ReferencePart['model'], source: Piece[], rotation=front, override: Partial<ReferencePart>={}) => {
      const b=bounds(source);
      const sideways=Math.abs(Math.sin(rotation))>.5;
      parts.push({model,...b,room:name,width:sideways?b.depth:b.width,depth:sideways?b.width:b.depth,rotation,...override});
      source.forEach(p=>removed.add(p));
    };
    if(feature==='sofa'&&room.kind==='living') fit('Sofa',list,front,{color:list.find(p=>p.mat==='fabric')?.color});
    else if(feature==='seating'&&room.kind==='living') fit('ClubChair',list,front);
    else if(feature==='plant') fit('Plant',list,0);
    else if(feature==='bed') {
      const base=list.find(p=>p.solid&&p.sy>.2&&p.sy<.4&&Math.max(p.sx,p.sz)>1.4);
      if(!base) continue;
      const body=list.filter(p=>p.y<.98&&p.sy>.025&&Math.abs(p.x-base.x)<base.sx/2&&Math.abs(p.z-base.z)<base.sz/2&&p.sx<base.sx+.1&&p.sz<base.sz+.1);
      const sideways=Math.abs(Math.sin(front))>.5;
      body.forEach(p=>removed.add(p));
      parts.push({model:'Bed',x:base.x,z:base.z,y:0,width:sideways?base.sz:base.sx,depth:sideways?base.sx:base.sz,height:.86,rotation:front});
      const ring=list.filter(p=>p.mat==='glow'&&p.color==='#ffd9a0'&&p.y>1.2&&p.sy<.05);
      if(ring.length>20){const b=bounds(ring);ring.forEach(p=>removed.add(p));parts.push({model:'WallRing',room:name,x:b.x,y:b.y+b.height/2,z:b.z,width:Math.max(b.width,b.depth),height:b.height,depth:.02,rotation:front});}
      const pendant=list.find(p=>p.shape==='sphere'&&p.mat==='fabric'&&p.y>2&&p.sx>.4);
      if(pendant)fit('FeatherPendant',[pendant],0);
    } else if(feature==='window') {
      for(const p of list.filter(p=>p.mat==='fabric'&&p.sy>1.5)) fit('Curtain',[p],p.sx>p.sz?0:Math.PI/2,{depth:.10});
    } else if(feature==='wc') {
      for(const p of list.filter(p=>p.shape==='cushion'&&p.color==='#fafafa')) fit('WC',[p],front);
    } else if(feature==='basin') {
      for(const p of list.filter(p=>p.color==='#ffffff'&&p.sy>.04&&p.sy<.1)) fit('Basin',[p],front,{height:.10});
      for(const p of list.filter(p=>p.color==='#cfdde5'&&p.shape==='cyl')) {
        const diameter=Math.max(p.sx,p.sz);
        removed.add(p);
        parts.push({model:'Mirror',room:name,x:p.x,y:p.y,z:p.z,width:diameter,height:diameter,depth:.01,rotation:front});
      }
    }
  }
  return { pieces: pieces.filter(p=>!removed.has(p)), parts };
}
