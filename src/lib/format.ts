const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export const formatINR = (n: number) => `₹ ${inr.format(Math.round(n))}`;

export function formatPrice(n: number, ascii = false) {
  const sym = ascii ? 'Rs.' : '₹';
  if (n >= 1e7) return `${sym} ${(n / 1e7).toFixed(2)} Cr`;
  return `${sym} ${(n / 1e5).toFixed(2)} L`;
}

export const SQFT_TO_M2 = 0.09290304;

export function formatArea(sqft: number, units: 'sqft' | 'm2') {
  return units === 'sqft' ? `${inr.format(sqft)} sq ft` : `${(sqft * SQFT_TO_M2).toFixed(1)} m²`;
}

export function feetInches(m: number) {
  let totalIn = Math.round(m * 39.3701);
  const ft = Math.floor(totalIn / 12);
  totalIn -= ft * 12;
  return `${ft}′${totalIn}″`;
}

export function roomSize(w: number, h: number, units: 'sqft' | 'm2') {
  return units === 'sqft' ? `${feetInches(w)} × ${feetInches(h)}` : `${w.toFixed(1)} × ${h.toFixed(1)} m`;
}

export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
