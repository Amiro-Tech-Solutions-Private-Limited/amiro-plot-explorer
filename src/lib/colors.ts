import type { Status } from '../data/types';

export const STATUS_COLOR: Record<Status, string> = {
  available: '#2fbf68',
  booked: '#f2a93b',
  sold: '#e5534b',
};

export const STATUS_UI: Record<Status, { label: string; dot: string; chip: string }> = {
  available: { label: 'Available', dot: 'bg-avail', chip: 'bg-emerald-100 text-emerald-800' },
  booked: { label: 'Booked', dot: 'bg-booked', chip: 'bg-amber-100 text-amber-800' },
  sold: { label: 'Sold', dot: 'bg-sold', chip: 'bg-red-100 text-red-700' },
};

export const NEUTRAL = '#eef1f4';
export const FILTERED_OUT = '#a3abb5';
