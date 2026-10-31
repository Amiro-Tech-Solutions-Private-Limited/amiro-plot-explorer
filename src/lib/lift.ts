import type { TowerId } from '../data/types';
import { FLAT_BY_ID, TOWER_BY_ID } from '../data/project';
import { useStore } from '../store/useStore';
import { runtime } from '../store/runtime';
import { floorBaseY, localToWorld, TOWER_HZ } from './geometry';
import { floorFlats, liftFront } from './floor';
import { startTour, stopTour } from './tourEngine';
import { floorTour } from './tours';

const RIDE_MS = 1700;

function liftPose(tower: TowerId, floor: number) {
  const lf = liftFront(TOWER_BY_ID.get(tower)!, floor);
  const fx = -Math.sin(lf.yaw);
  const fz = -Math.cos(lf.yaw);
  const y = floorBaseY(floor) + 1.6;
  return { pos: [lf.x, y, lf.z] as [number, number, number], target: [lf.x + fx * 6, y, lf.z + fz * 6] as [number, number, number], fov: 70 };
}

/** Enter a floor at its lift lobby (from the site or the 3D view), optionally starting the floor tour. */
export function enterFloor(tower: TowerId, floor: number, tour = false) {
  const flats = floorFlats(tower, floor);
  const flat = flats.find((f) => f.status === 'available') ?? flats[0];
  const s = useStore.getState();
  stopTour();
  useStore.setState({ selectedId: flat.id, mode: 'interior', panel: null, thirdPerson: s.mode === 'walk' ? s.thirdPerson : false, currentRoom: null });
  runtime.pendingTour = tour ? 'floor' : null;
  s.flyTo(liftPose(tower, floor));
}

/** Ride the lift to another floor of the current tower (0 = ground lobby → back to the site). */
export function rideLift(to: number) {
  const s = useStore.getState();
  const flat = s.selectedId ? FLAT_BY_ID.get(s.selectedId) : undefined;
  if (!flat || s.mode !== 'interior' || s.lift || to === flat.floor) return;
  const touring = s.touring;
  stopTour();
  useStore.setState({ lift: { from: flat.floor, to } });
  window.setTimeout(() => {
    if (to === 0) {
      useStore.setState({ lift: null });
      const t = TOWER_BY_ID.get(flat.tower)!;
      const [x, z] = localToWorld(t, 0, TOWER_HZ + 9);
      const [tx, tz] = localToWorld(t, 0, TOWER_HZ + 30);
      useStore.setState({ mode: 'walk', currentRoom: null });
      s.flyTo({ pos: [x, 1.7, z], target: [tx, 1.7, tz], fov: 60 });
      return;
    }
    const target = floorFlats(flat.tower, to).find((f) => f.index === flat.index) ?? floorFlats(flat.tower, to)[0];
    const lf = liftFront(TOWER_BY_ID.get(flat.tower)!, to);
    runtime.player.x = lf.x;
    runtime.player.z = lf.z;
    runtime.player.yaw = lf.yaw;
    useStore.setState({ selectedId: target.id, currentRoom: 'Lift lobby' });
    window.setTimeout(() => {
      useStore.setState({ lift: null });
      if (touring) startTour(floorTour(flat.tower, to), `Floor ${to} tour`);
    }, 450);
  }, RIDE_MS);
}
