import { AGE_BANDS, type AgeBand, type SizeClass } from './enums';

export interface Dimensions {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
}

/** Thresholds above which a toy counts as LARGE (costs 2 toy credits and needs bulk storage). */
export const LARGE_TOY_RULES = {
  maxSideCm: 60,
  volumeCm3: 60 * 40 * 40,
  weightKg: 8,
};

export function volumeCm3(d: Dimensions): number {
  return d.lengthCm * d.breadthCm * d.heightCm;
}

export function sizeClassFor(d: Dimensions, weightKg: number): SizeClass {
  const longest = Math.max(d.lengthCm, d.breadthCm, d.heightCm);
  if (longest >= LARGE_TOY_RULES.maxSideCm) return 'LARGE';
  if (volumeCm3(d) >= LARGE_TOY_RULES.volumeCm3) return 'LARGE';
  if (weightKg >= LARGE_TOY_RULES.weightKg) return 'LARGE';
  return 'STANDARD';
}

/** Standard toy = 1 credit, large toy = 2 credits. */
export function creditCost(sizeClass: SizeClass): number {
  return sizeClass === 'LARGE' ? 2 : 1;
}

/** Age band whose range contains the midpoint of the toy's recommended age. */
export function ageBandFor(ageMinMonths: number, ageMaxMonths: number): AgeBand {
  const mid = (ageMinMonths + ageMaxMonths) / 2;
  const band = AGE_BANDS.find((b) => mid >= b.minMonths && mid < b.maxMonths);
  return (band ?? AGE_BANDS[AGE_BANDS.length - 1]).code;
}

export function ageInMonths(dateOfBirth: Date, now: Date = new Date()): number {
  let months = (now.getFullYear() - dateOfBirth.getFullYear()) * 12 + (now.getMonth() - dateOfBirth.getMonth());
  if (now.getDate() < dateOfBirth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatAgeRange(minMonths: number, maxMonths: number): string {
  const fmt = (m: number) => (m < 24 ? `${m} mo` : `${Math.floor(m / 12)} yr`);
  return `${fmt(minMonths)} – ${fmt(maxMonths)}`;
}
