import type { Flat, TowerId } from '../data/types';
import { towerName, unitOf } from '../data/project';
import { FACING_LONG } from './geometry';
import { priceOf, emi } from './pricing';
import { vastuOf, roomDirection, isVastuIdeal, DIR_LONG } from './vastu';
import { sunlightOf } from './sun';
import { ordinal } from './format';
import { useStore } from '../store/useStore';
import { itemId } from './items';
import { effectiveFurnishing } from './interiorFrame';
import type { Beat, Highlight, Shot } from './floor';

/** Spoken-friendly money: "1 point 6 5 crore rupees" reads badly, so round sensibly. */
export function sayMoney(n: number) {
  if (n >= 1e7) return `${(n / 1e7).toFixed(2).replace(/0$/, '')} crore rupees`;
  if (n >= 1e5) return `${Math.round(n / 1e5)} lakh rupees`;
  return `${Math.round(n).toLocaleString('en-IN')} rupees`;
}

const ft = (m: number) => Math.round(m * 3.281);
const VIEW: Record<string, string> = { pool: 'the swimming pool', garden: 'the landscaped gardens', road: 'the main road', city: 'the city skyline' };

export function flatSay(flat: Flat) {
  const u = unitOf(flat);
  const p = priceOf(flat);
  const head = `This is flat ${flat.id.replace('-', ' ')}, a ${u.label.replace('BHK', 'B H K')} of ${u.superBuiltUp.toLocaleString('en-IN')} square feet, facing ${FACING_LONG[flat.facing]}, on the ${ordinal(flat.floor)} floor, with a view of ${VIEW[flat.view[0]]}.`;
  if (flat.status === 'sold') return `${head} This home is already sold.`;
  if (flat.status === 'booked') return `${head} It is currently booked, but you can join the wait list.`;
  return `${head} It is available, at about ${sayMoney(p.total)} all inclusive.`;
}

export function roomSay(flat: Flat, name: string) {
  const src = unitOf(flat).rooms.find((r) => r.name === name && !r.level);
  if (!src) return name;
  const d = roomDirection(flat, src);
  const ok = isVastuIdeal(src, d);
  const size = `about ${ft(src.w)} by ${ft(src.h)} feet`;
  const dir = d === 'Centre' ? 'at the centre of the home' : `in the ${DIR_LONG[d].toLowerCase()}`;
  const vastu = ok ? ', which is ideal as per Vastu' : '';
  switch (src.kind) {
    case 'foyer':
      return `Welcome in. This is the entrance foyer with shoe storage and a video door phone.`;
    case 'living':
      return `This is the living room, ${size}, ${dir}${vastu}. It opens onto the balcony and has a dedicated TV wall and a split AC point.`;
    case 'dining':
      return `Here is the dining area, ${size}, right next to the kitchen. It comfortably fits a ${useStore.getState().furnishing === 'bare' ? 'six seater' : 'dining set'} with a pendant light.`;
    case 'kitchen':
      return `The modular kitchen is ${size}, ${dir}${vastu}. It has a granite counter, chimney, hob and sink, with a separate utility area for the washing machine.`;
    case 'balcony':
      return `Step out to the balcony. From the ${ordinal(flat.floor)} floor you look ${FACING_LONG[flat.facing].toLowerCase()} over ${VIEW[flat.view[0]]}.`;
    case 'bed':
      return name.startsWith('Master')
        ? `This is the master bedroom, ${size}, ${dir}${vastu}. It has an attached toilet, a large wardrobe and its own balcony.`
        : `This is ${name.toLowerCase()}, ${size}, ${dir}${vastu}, with wardrobe space and an AC point.`;
    case 'study':
      return `The study is ${size}, perfect for working from home.`;
    case 'lounge':
      return `This family lounge, ${size}, is a flexible space for a home theatre or play area.`;
    case 'pooja':
      return `The pooja room is ${dir}${vastu}.`;
    case 'toilet':
      return `${name}, with wall-hung fittings, a glass shower partition and a geyser point.`;
    default:
      return `${name}, ${size}.`;
  }
}

export function flatSummarySay(flat: Flat) {
  const p = priceOf(flat);
  const m = emi(p.total * 0.8, 8.5, 20);
  const sun = sunlightOf(flat, useStore.getState().sun.date);
  const v = vastuOf(flat);
  return `That was flat ${flat.id.replace('-', ' ')}. With twenty percent down, the monthly EMI starts at about ${sayMoney(m)}. The home gets around ${Math.round(sun.hours)} hours of direct sun today and scores ${v.stars} out of 5 on Vastu.`;
}

export function floorIntroSay(tower: TowerId, floor: number, flats: Flat[]) {
  const avail = flats.filter((f) => f.status === 'available').length;
  const types = flats.map((f) => unitOf(f).short.replace('BHK', 'B H K')).join(', ');
  return `Welcome to the ${ordinal(floor)} floor of ${towerName(tower)}. There are four homes here: ${types}. ${avail === 0 ? 'All of them are taken.' : `${avail} of them ${avail === 1 ? 'is' : 'are'} available.`} Let me walk you along the corridor.`;
}

/**
 * "Show what you say": a room's narration split into beats. Each beat names the thing the
 * camera should frame (item ids from lib/items) and how to show it.
 */
export function roomBeats(flat: Flat, name: string, short = false): Beat[] {
  const src = unitOf(flat).rooms.find((r) => r.name === name && !r.level);
  if (!src) return [];
  const room = `${flat.id}/${name}::room`;
  const f = (feature: string) => itemId(flat, name, feature);
  const out: Beat[] = [];
  const add = (say: string, focus: (string | null)[], shot: Shot, highlight?: Highlight, host?: Beat['host']) => {
    const ids = focus.filter((x): x is string => !!x);
    if (ids.length) out.push({ say, focus: ids, shot, highlight, host });
  };
  const d = roomDirection(flat, src);
  const ok = isVastuIdeal(src, d);
  const size = `about ${ft(src.w)} by ${ft(src.h)} feet`;
  const dirTxt = d === 'Centre' ? 'It sits at the centre of the home' : `It sits in the ${DIR_LONG[d].toLowerCase()}`;
  const vastu = `${dirTxt}${ok ? ', which is ideal as per Vastu.' : '.'}`;
  const staged = effectiveFurnishing(flat, useStore.getState().furnishing) === 'sample';
  const furnNote = staged ? 'In this sample home, ' : '';

  switch (src.kind) {
    case 'foyer':
      add(`Welcome in. This is the entrance foyer.`, [room], 'wide', undefined, 'namaste');
      add(`${furnNote}a shoe cabinet with a mirror sits right by the door.`, [f('shoerack')], 'closeup', 'label', 'point');
      break;
    case 'living':
      add(`This is the living room, ${size}.`, [room], 'wide', 'dimension', 'present');
      if (!short) add(vastu, [room], 'overhead', 'compass');
      add(`${furnNote}an L-shaped sofa seats five to six people comfortably.`, [f('sofa')], 'closeup', 'outline', 'point');
      add(`Opposite the sofa is the TV wall, with power, cable and data points.`, [f('tv')], 'dolly', 'outline', 'point');
      if (!short) add(`There is a split AC point on this wall, and modular switches by ABB or Legrand throughout.`, [f('ac')], 'look', 'label', 'point');
      add(`And the living room opens straight onto the balcony.`, [`${flat.id}/Balcony::room`], 'look', undefined, 'present');
      break;
    case 'dining':
      add(`Here is the dining area, ${size}, right next to the kitchen.`, [room], 'wide', 'dimension', 'present');
      add(`It fits a ${src.w * src.h > 15 ? 'six' : 'four'} seater dining table with room to move around.`, [f('table')], 'closeup', 'outline', 'point');
      if (!short) add(`A crockery unit fits neatly along this wall.`, [f('crockery')], 'look', 'label', 'point');
      break;
    case 'kitchen':
      add(`This is the kitchen, ${size}. ${vastu}`, [room], 'wide', 'dimension', 'present');
      add(
        `The standard specification gives you plumbing and electrical points, so you can fit your own platform. ${staged ? 'This sample home shows sage-grey cabinets, a quartz-look counter and a marble-look backsplash.' : ''}`,
        [f('counter') ?? f('sink')],
        'closeup',
        'outline',
        'point',
      );
      add(`The hob and chimney sit on the outer wall for good ventilation.`, [f('hob'), f('chimney')], 'closeup', 'outline', 'point');
      if (!short) add(`There is space for a double door refrigerator here.`, [f('fridge')], 'look', 'label', 'point');
      break;
    case 'utility':
      add(`The utility has a U P V C door, with a washing machine inlet and drain.`, [f('washer') ?? room], 'closeup', 'label', 'point');
      break;
    case 'balcony':
      add(`Step out to the balcony. Stainless steel railings with glass keep the view open.`, [room], 'wide', 'dimension', 'present');
      add(
        `From the ${ordinal(flat.floor)} floor you look ${FACING_LONG[flat.facing].toLowerCase()} over ${VIEW[flat.view[0]]}.`,
        [`${flat.id}/${name}::view`],
        'view',
        'landmarks',
        'present',
      );
      break;
    case 'bed':
      if (name.startsWith('Master')) {
        add(`This is the master bedroom, ${size}.`, [room], 'wide', 'dimension', 'present');
        if (!short) add(vastu, [room], 'overhead', 'compass');
        add(`${furnNote}a king-size bed fits with space on both sides.`, [f('bed')], 'closeup', 'outline', 'point');
        add(`A full-height wardrobe goes along this wall.`, [f('wardrobe')], 'dolly', 'outline', 'point');
        add(`It has an attached toilet with American Standard or Jaquar fittings.`, [`${flat.id}/Master Toilet::room`], 'look', undefined, 'point');
      } else {
        add(`This is ${name.toLowerCase()}, ${size}.`, [room], 'wide', 'dimension', 'present');
        add(`It takes a queen-size bed, a wardrobe and an AC point.`, [f('bed'), f('wardrobe')], 'look', 'outline', 'point');
      }
      break;
    case 'study':
      add(`The study is ${size}, perfect for working from home.`, [room], 'wide', 'dimension', 'present');
      add(`There are data and power points at desk height.`, [f('desk')], 'closeup', 'outline', 'point');
      break;
    case 'lounge':
      add(`This family lounge is ${size}, a flexible space for a home theatre or a play area.`, [room], 'wide', 'dimension', 'present');
      break;
    case 'pooja':
      add(`The pooja room. ${vastu}`, [f('mandir') ?? room], 'closeup', 'outline', 'point');
      break;
    case 'toilet':
      add(`${name}, with matt anti-skid flooring, ceramic dado, and American Standard or Jaquar fittings.`, [f('basin') ?? room], 'closeup', 'outline', 'point');
      break;
    default:
      add(`${name}, ${size}.`, [room], 'wide', 'dimension');
  }
  if (!out.length) out.push({ say: roomSay(flat, name), focus: [room], shot: 'look' });
  return out;
}
