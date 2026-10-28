// Storage slotting: where should this toy go in the warehouse?
//
// Same family of heuristics quick-commerce dark stores and fulfilment centres use:
//   1. ABC velocity classes (Pareto on recent rentals) decide how close to dispatch an item lives.
//   2. A dimensional bin-fit (any of the 6 axis rotations) plus volume/weight capacity filters bins.
//   3. A weighted score ranks the remaining bins: best-fit space use, velocity/zone match,
//      ergonomics (heavy on low shelves), and affinity (same SKU / age band together).

import type { ZoneType } from '../enums';
import { volumeCm3, type Dimensions } from '../toy';

export type VelocityClass = 'A' | 'B' | 'C';

export interface SlotItem extends Dimensions {
  toyId: string;
  weightKg: number;
  velocity: VelocityClass;
  ageBand?: string;
}

export interface SlotBin extends Dimensions {
  id: string;
  code: string;
  maxWeightKg: number;
  usedVolumeCm3: number;
  usedWeightKg: number;
  shelfLevel: number;
  maxShelfLevel: number;
  zoneType: ZoneType;
  /** Relative effort to reach the bin from dispatch (walk distance, reach height). Lower is better. */
  pickCost: number;
  toyIds: string[];
  ageBands: string[];
}

export interface SlotWeights {
  space: number;
  velocity: number;
  ergonomics: number;
  affinity: number;
}

export interface SlotOptions {
  /** Real items never pack perfectly; only this share of a bin's volume is usable. */
  packingFactor?: number;
  weights?: Partial<SlotWeights>;
  limit?: number;
  heavyKg?: number;
}

export interface SlotSuggestion {
  binId: string;
  binCode: string;
  score: number;
  breakdown: SlotWeights;
  reasons: string[];
}

export const DEFAULT_SLOT_WEIGHTS: SlotWeights = { space: 0.35, velocity: 0.3, ergonomics: 0.2, affinity: 0.15 };

const sortedDims = (d: Dimensions) => [d.lengthCm, d.breadthCm, d.heightCm].sort((a, b) => b - a);

/** True if the item fits inside the bin in some axis-aligned rotation. */
export function fitsDimensions(item: Dimensions, bin: Dimensions): boolean {
  const i = sortedDims(item);
  const b = sortedDims(bin);
  return i.every((v, k) => v <= b[k]);
}

export function binCapacityCm3(bin: Dimensions, packingFactor = 0.85): number {
  return volumeCm3(bin) * packingFactor;
}

export function canPlace(item: SlotItem, bin: SlotBin, packingFactor = 0.85): boolean {
  if (!fitsDimensions(item, bin)) return false;
  if (bin.usedWeightKg + item.weightKg > bin.maxWeightKg) return false;
  return bin.usedVolumeCm3 + volumeCm3(item) <= binCapacityCm3(bin, packingFactor);
}

const ZONE_RANK: Record<ZoneType, number> = { FAST: 0, MEDIUM: 1, SLOW: 2 };
const VELOCITY_RANK: Record<VelocityClass, number> = { A: 0, B: 1, C: 2 };

export function suggestBins(item: SlotItem, bins: SlotBin[], opts: SlotOptions = {}): SlotSuggestion[] {
  const packingFactor = opts.packingFactor ?? 0.85;
  const w = { ...DEFAULT_SLOT_WEIGHTS, ...opts.weights };
  const heavyKg = opts.heavyKg ?? 5;
  const itemVol = volumeCm3(item);
  const candidates = bins.filter((b) => canPlace(item, b, packingFactor));
  if (candidates.length === 0) return [];

  const leftovers = candidates.map((b) => binCapacityCm3(b, packingFactor) - b.usedVolumeCm3 - itemVol);
  const minLeft = Math.min(...leftovers);
  const leftRange = Math.max(...leftovers) - minLeft || 1;
  const itemDims = sortedDims(item);

  const pickCosts = candidates.map((b) => b.pickCost);
  const minPick = Math.min(...pickCosts);
  const pickRange = Math.max(...pickCosts) - minPick || 1;
  const heavy = item.weightKg >= heavyKg;

  const scored = candidates.map((bin, idx): SlotSuggestion => {
    const reasons: string[] = [];

    // Best fit: least leftover volume among the candidates, and a bin sized like the toy
    // (so small toys don't use up the bays that only large toys fit in).
    const leftoverScore = 1 - (leftovers[idx] - minLeft) / leftRange;
    const binDims = sortedDims(bin);
    const dimFit = itemDims.reduce((s, v, k) => s + v / binDims[k], 0) / 3;
    const space = 0.5 * leftoverScore + 0.5 * dimFit;
    const utilisation = (bin.usedVolumeCm3 + itemVol) / binCapacityCm3(bin, packingFactor);
    reasons.push(`${Math.round(utilisation * 100)}% full after placing`);

    // Velocity: A items belong in FAST zones near dispatch, C items in SLOW zones.
    const zoneGap = Math.abs(ZONE_RANK[bin.zoneType] - VELOCITY_RANK[item.velocity]);
    const zoneScore = 1 - zoneGap / 2;
    const pickNorm = (bin.pickCost - minPick) / pickRange;
    // Fast movers care most about pick effort; slow movers should leave the easy bins free.
    const pickScore = item.velocity === 'A' ? 1 - pickNorm : item.velocity === 'C' ? pickNorm : 1 - Math.abs(pickNorm - 0.5) * 2;
    const velocity = 0.7 * zoneScore + 0.3 * pickScore;
    if (zoneGap === 0) reasons.push(`${bin.zoneType} zone matches ${item.velocity}-class demand`);

    // Ergonomics: heavy items on low shelves; light items at waist/eye level, not the floor.
    const levelNorm = bin.maxShelfLevel > 1 ? (bin.shelfLevel - 1) / (bin.maxShelfLevel - 1) : 0;
    const ergonomics = heavy ? 1 - levelNorm : bin.shelfLevel === 1 ? 0.5 : 1 - Math.abs(levelNorm - 0.5);
    if (heavy && bin.shelfLevel === 1) reasons.push('Heavy toy on floor shelf');

    // Affinity: co-locating the same SKU or age band speeds up picking and cycle counts.
    const affinity = bin.toyIds.includes(item.toyId) ? 1 : item.ageBand && bin.ageBands.includes(item.ageBand) ? 0.5 : 0;
    if (affinity === 1) reasons.push('Same toy already stored here');
    else if (affinity === 0.5) reasons.push(`Same age band (${item.ageBand})`);

    const breakdown = { space, velocity, ergonomics, affinity };
    const score = w.space * space + w.velocity * velocity + w.ergonomics * ergonomics + w.affinity * affinity;
    return { binId: bin.id, binCode: bin.code, score: Math.round(score * 1000) / 1000, breakdown, reasons };
  });

  return scored.sort((a, b) => b.score - a.score || a.binCode.localeCompare(b.binCode)).slice(0, opts.limit ?? 3);
}

/**
 * Pareto ABC classification on rentals: items making up the first 80% of rentals are A,
 * the next 15% B, the tail C. Toys with no rental history yet start as B so new arrivals
 * are neither buried nor hogging the best bins.
 */
export function classifyVelocity(rentalsByToy: Record<string, number>): Record<string, VelocityClass> {
  const entries = Object.entries(rentalsByToy);
  const total = entries.reduce((s, [, n]) => s + n, 0);
  const result: Record<string, VelocityClass> = {};
  let cumulative = 0;
  for (const [toyId, n] of entries.sort((a, b) => b[1] - a[1])) {
    if (n === 0 || total === 0) {
      result[toyId] = 'B';
      continue;
    }
    const shareBefore = cumulative / total;
    cumulative += n;
    result[toyId] = shareBefore < 0.8 ? 'A' : shareBefore < 0.95 ? 'B' : 'C';
  }
  return result;
}

export function expectedZone(velocity: VelocityClass): ZoneType {
  return velocity === 'A' ? 'FAST' : velocity === 'B' ? 'MEDIUM' : 'SLOW';
}
