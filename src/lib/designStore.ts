import { useStore, DESIGN_KEY } from '../store/useStore';
import { EMPTY_DESIGN, newUid, type AddedItem, type FeatureEdit, type FlatDesign } from './design';
import { CATALOG_BY_ID } from './catalog';

const undo = new Map<string, FlatDesign[]>();
const redo = new Map<string, FlatDesign[]>();
let revSeq = Date.now();

export const designOf = (flatId: string): FlatDesign => useStore.getState().design[flatId] ?? EMPTY_DESIGN;

function save(all: Record<string, FlatDesign>) {
  try {
    localStorage.setItem(DESIGN_KEY, JSON.stringify(all));
  } catch {
    // Storage full or disabled: designs simply won't persist.
  }
}

function put(flatId: string, next: FlatDesign | null) {
  const all = { ...useStore.getState().design };
  if (next && (Object.keys(next.edits).length || next.added.length)) all[flatId] = next;
  else delete all[flatId];
  useStore.setState({ design: all });
  save(all);
}

/** Apply a change as one undoable step. */
export function commit(flatId: string, fn: (d: FlatDesign) => FlatDesign) {
  const cur = designOf(flatId);
  const next = fn({ ...cur, edits: { ...cur.edits }, added: [...cur.added] });
  (undo.get(flatId) ?? undo.set(flatId, []).get(flatId)!).push(cur);
  redo.set(flatId, []);
  put(flatId, { ...next, rev: ++revSeq });
}

export function undoDesign(flatId: string) {
  const u = undo.get(flatId);
  const prev = u?.pop();
  if (!prev) return;
  (redo.get(flatId) ?? redo.set(flatId, []).get(flatId)!).push(designOf(flatId));
  put(flatId, { ...prev, rev: ++revSeq });
}

export function redoDesign(flatId: string) {
  const r = redo.get(flatId);
  const nxt = r?.pop();
  if (!nxt) return;
  (undo.get(flatId) ?? undo.set(flatId, []).get(flatId)!).push(designOf(flatId));
  put(flatId, { ...nxt, rev: ++revSeq });
}

export const canUndo = (flatId: string) => !!undo.get(flatId)?.length;
export const canRedo = (flatId: string) => !!redo.get(flatId)?.length;

export function resetDesign(flatId: string) {
  commit(flatId, () => ({ ...EMPTY_DESIGN }));
  useStore.setState({ designSel: null });
}

export function importDesign(flatId: string, d: FlatDesign) {
  commit(flatId, () => d);
}

const isAdded = (key: string) => key.includes('#');
const uidOf = (key: string) => key.split('#')[1];

function editOf(d: FlatDesign, key: string): FeatureEdit {
  return d.edits[key] ?? { dx: 0, dz: 0, rot: 0 };
}

export function moveGroup(flatId: string, key: string, dx: number, dz: number) {
  commit(flatId, (d) => {
    if (isAdded(key)) d.added = d.added.map((a) => (a.uid === uidOf(key) ? { ...a, x: a.x + dx, z: a.z + dz } : a));
    else {
      const e = editOf(d, key);
      d.edits[key] = { ...e, dx: e.dx + dx, dz: e.dz + dz };
    }
    return d;
  });
}

export function rotateGroup(flatId: string, key: string, by: number) {
  commit(flatId, (d) => {
    if (isAdded(key)) d.added = d.added.map((a) => (a.uid === uidOf(key) ? { ...a, rot: a.rot + by } : a));
    else {
      const e = editOf(d, key);
      d.edits[key] = { ...e, rot: e.rot + by };
    }
    return d;
  });
}

export function removeGroup(flatId: string, key: string) {
  commit(flatId, (d) => {
    if (isAdded(key)) d.added = d.added.filter((a) => a.uid !== uidOf(key));
    else d.edits[key] = { ...editOf(d, key), removed: true };
    return d;
  });
  useStore.setState({ designSel: null });
}

export function replaceGroup(flatId: string, key: string, catId: string) {
  commit(flatId, (d) => {
    if (isAdded(key)) d.added = d.added.map((a) => (a.uid === uidOf(key) ? { ...a, cat: catId, color: undefined } : a));
    else d.edits[key] = { ...editOf(d, key), replace: catId, color: undefined };
    return d;
  });
}

export function recolorGroup(flatId: string, key: string, color: string) {
  commit(flatId, (d) => {
    if (isAdded(key)) d.added = d.added.map((a) => (a.uid === uidOf(key) ? { ...a, color } : a));
    else d.edits[key] = { ...editOf(d, key), color };
    return d;
  });
}

export function addItem(flatId: string, item: Omit<AddedItem, 'uid'>): string {
  const uid = newUid();
  commit(flatId, (d) => {
    d.added = [...d.added, { ...item, uid }];
    return d;
  });
  const cat = CATALOG_BY_ID.get(item.cat)?.category ?? 'item';
  const key = `${item.room}::${cat}#${uid}`;
  useStore.setState({ designSel: key });
  return key;
}

/** Remove all movable furniture from one room. */
export function emptyRoom(flatId: string, room: string, keys: string[]) {
  commit(flatId, (d) => {
    for (const k of keys) {
      if (!k.startsWith(`${room}::`)) continue;
      if (isAdded(k)) d.added = d.added.filter((a) => a.uid !== uidOf(k));
      else d.edits[k] = { ...editOf(d, k), removed: true };
    }
    return d;
  });
  useStore.setState({ designSel: null });
}
