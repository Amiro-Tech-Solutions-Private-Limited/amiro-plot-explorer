export type Status = 'available' | 'booked' | 'sold';
export type Facing = 'N' | 'E' | 'S' | 'W' | 'NE' | 'NW' | 'SE' | 'SW';
/** One lift core (wing) of a tower. North Park's towers A and B each have two wings. */
export type TowerId = 'A1' | 'A2' | 'B1' | 'B2';
export type TowerGroup = 'A' | 'B';
export type View = 'pool' | 'garden' | 'road' | 'city';

export type RoomKind =
  | 'bed'
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'toilet'
  | 'pooja'
  | 'utility'
  | 'foyer'
  | 'passage'
  | 'study'
  | 'balcony'
  | 'store'
  | 'stair'
  | 'lounge';

/** Plan coordinates in metres. x: 0..W along the façade, y: 0 (corridor/entry side) .. D (view side). */
export interface Room {
  name: string;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Name of the room this room's door opens into. */
  doorTo?: string;
  /** 1 = upper level of a duplex. */
  level?: 1;
  vastuIdeal?: boolean;
  /** Open-plan variant: no walls to neighbouring open rooms. */
  open?: boolean;
}

export interface UnitType {
  id: string;
  label: string;
  short: string;
  bhk: number;
  carpet: number;
  builtUp: number;
  superBuiltUp: number;
  balconies: number;
  carParks: number;
  rooms: Room[];
  duplex?: boolean;
}

export interface Flat {
  id: string;
  tower: TowerId;
  /** Home number on the floor across both wings (1–8). */
  no: number;
  floor: number;
  index: 1 | 2 | 3 | 4;
  typeId: string;
  facing: Facing;
  facingBearing: number;
  status: Status;
  corner: boolean;
  view: View[];
  baseRate: number;
}

export interface Tower {
  id: TowerId;
  group: TowerGroup;
  wing: 1 | 2;
  /** "Tower A · Wing 1" */
  name: string;
  position: [number, number, number];
  rotationY: number;
  /** Compass bearing (deg) the front façade looks towards. */
  frontBearing: number;
  floors: number;
}

export interface Pricing {
  floorRisePerFloor: number;
  cornerPLC: number;
  poolViewPLC: number;
  parking: number;
  club: number;
  gstPct: number;
  stampPct: number;
}

export interface Project {
  name: string;
  short: string;
  /** App / platform brand shown in the header. */
  brand: string;
  developer: string;
  locality: string;
  address: string;
  rera: string;
  status: string;
  acres: number;
  priceFrom: string;
  configs: string;
  amenities: string[];
  specs: { title: string; items: [string, string][] }[];
  contact: { phone: string; email: string; office: string; web: string };
  disclaimer: string;
  lat: number;
  lng: number;
  towers: Tower[];
  unitTypes: UnitType[];
  flats: Flat[];
  pricing: Pricing;
}
