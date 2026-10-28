// Personalised catalog ranking.
//
// Hybrid ranker that works from day one (cold start) and gets better with data:
//   - content-based: the kid's interest vector (from signup + behaviour) vs. each toy's metadata features
//   - age fit: hard filter around the toy's age range, soft preference for the middle of it
//   - popularity within the catalog (rentals + Bayesian-smoothed rating)
//   - availability and newness boosts
// followed by an MMR re-rank so the first screen is varied instead of ten copies of one category.

import { INTEREST_LABELS, type Interest, type InteractionType, type Material, type PowerType } from '../enums';
import { ageBandFor } from '../toy';

export interface RecToy {
  id: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  material: Material;
  powerType: PowerType;
  interestTags: Interest[];
  rentalCount: number;
  ratingSum: number;
  ratingCount: number;
  availableUnits: number;
  creditCost: number;
  createdAt: Date;
}

export interface RecInteraction {
  toyId: string;
  type: InteractionType;
  /** Rating 1–5 for RATING; ignored otherwise. */
  value?: number | null;
  createdAt: Date;
}

export interface RecKid {
  ageMonths: number;
  interests: Interest[];
  interactions: RecInteraction[];
}

export interface RecOptions {
  now?: Date;
  /** Toys costing more credits than this are left out (plan allowance). */
  maxCredits?: number;
  limit?: number;
  /** 1 = pure relevance, 0 = pure diversity. */
  mmrLambda?: number;
  halfLifeDays?: number;
}

export interface RecBreakdown {
  ageFit: number;
  interest: number;
  popularity: number;
  availability: number;
  newness: number;
}

export interface Recommendation<T extends RecToy = RecToy> {
  toy: T;
  score: number;
  breakdown: RecBreakdown;
  reasons: string[];
}

export const REC_WEIGHTS: RecBreakdown = { ageFit: 0.35, interest: 0.35, popularity: 0.15, availability: 0.1, newness: 0.05 };

const INTERACTION_WEIGHT: Record<InteractionType, number> = { VIEW: 0.1, WISHLIST: 0.5, RENT: 1, RATING: 1 };
const AGE_TOLERANCE_BELOW = 3;
const AGE_TOLERANCE_ABOVE = 6;
const DAY_MS = 86_400_000;

/** Features a toy expresses, from explicit tags plus what its metadata implies. */
export function toyFeatures(toy: Pick<RecToy, 'material' | 'powerType' | 'interestTags'>): Set<Interest> {
  const f = new Set<Interest>(toy.interestTags);
  if (toy.material === 'WOODEN') f.add('WOODEN');
  if (toy.material === 'FABRIC_PLUSH') f.add('SOFT_PLUSH');
  if (toy.powerType === 'ELECTRIC') f.add('ELECTRIC');
  return f;
}

/** Signup interests start at 1.0; each interaction nudges the toy's features, decaying with a half-life. */
export function interestVector(kid: RecKid, toysById: Map<string, RecToy>, now: Date, halfLifeDays = 30): Map<Interest, number> {
  const v = new Map<Interest, number>();
  for (const i of kid.interests) v.set(i, 1);
  for (const ev of kid.interactions) {
    const toy = toysById.get(ev.toyId);
    if (!toy) continue;
    const ageDays = Math.max(0, (now.getTime() - ev.createdAt.getTime()) / DAY_MS);
    const decay = Math.pow(0.5, ageDays / halfLifeDays);
    let w = INTERACTION_WEIGHT[ev.type] * decay;
    if (ev.type === 'RATING') w *= ((ev.value ?? 3) - 3) / 2; // 5★ → +1, 1★ → -1
    for (const f of toyFeatures(toy)) v.set(f, (v.get(f) ?? 0) + w);
  }
  return v;
}

function cosine(kidVec: Map<Interest, number>, features: Set<Interest>): number {
  if (features.size === 0) return 0;
  let dot = 0;
  let kidNorm = 0;
  for (const [k, w] of kidVec) {
    kidNorm += w * w;
    if (features.has(k)) dot += w;
  }
  if (kidNorm === 0) return 0;
  return Math.max(0, dot / (Math.sqrt(kidNorm) * Math.sqrt(features.size)));
}

export function ageFit(ageMonths: number, min: number, max: number): number {
  if (ageMonths < min - AGE_TOLERANCE_BELOW || ageMonths > max + AGE_TOLERANCE_ABOVE) return 0;
  if (ageMonths < min || ageMonths > max) return 0.3;
  const mid = (min + max) / 2;
  const half = (max - min) / 2 + 1;
  return 1 - 0.5 * (Math.abs(ageMonths - mid) / half);
}

function bayesRating(toy: RecToy, prior = 3.5, weight = 5): number {
  return (prior * weight + toy.ratingSum) / (weight + toy.ratingCount);
}

function similarity(a: RecToy, b: RecToy): number {
  const fa = toyFeatures(a);
  const fb = toyFeatures(b);
  fa.add(`M:${a.material}` as Interest);
  fb.add(`M:${b.material}` as Interest);
  fa.add(`A:${ageBandFor(a.ageMinMonths, a.ageMaxMonths)}` as Interest);
  fb.add(`A:${ageBandFor(b.ageMinMonths, b.ageMaxMonths)}` as Interest);
  let inter = 0;
  for (const x of fa) if (fb.has(x)) inter++;
  return inter / (fa.size + fb.size - inter);
}

export function scoreToys<T extends RecToy>(kid: RecKid, toys: T[], opts: RecOptions = {}): Recommendation<T>[] {
  const now = opts.now ?? new Date();
  const byId = new Map<string, RecToy>(toys.map((t) => [t.id, t]));
  const kidVec = interestVector(kid, byId, now, opts.halfLifeDays);
  const rented = new Set(kid.interactions.filter((i) => i.type === 'RENT').map((i) => i.toyId));
  const maxRentalsLog = Math.log1p(Math.max(0, ...toys.map((t) => t.rentalCount)));

  const out: Recommendation<T>[] = [];
  for (const toy of toys) {
    if (toy.availableUnits <= 0) continue;
    if (opts.maxCredits !== undefined && toy.creditCost > opts.maxCredits) continue;
    const age = ageFit(kid.ageMonths, toy.ageMinMonths, toy.ageMaxMonths);
    if (age === 0) continue;

    const features = toyFeatures(toy);
    const interest = kidVec.size === 0 ? 0.5 : cosine(kidVec, features);
    const popularity = 0.5 * (maxRentalsLog > 0 ? Math.log1p(toy.rentalCount) / maxRentalsLog : 0) + 0.5 * (bayesRating(toy) / 5);
    const availability = Math.min(toy.availableUnits, 3) / 3;
    const ageDays = (now.getTime() - toy.createdAt.getTime()) / DAY_MS;
    const newness = ageDays <= 30 ? 1 : ageDays >= 90 ? 0 : 1 - (ageDays - 30) / 60;

    const breakdown: RecBreakdown = { ageFit: age, interest, popularity, availability, newness };
    let score =
      REC_WEIGHTS.ageFit * age +
      REC_WEIGHTS.interest * interest +
      REC_WEIGHTS.popularity * popularity +
      REC_WEIGHTS.availability * availability +
      REC_WEIGHTS.newness * newness;
    if (rented.has(toy.id)) score *= 0.7;

    const reasons: string[] = [];
    const matched = kid.interests.filter((i) => features.has(i)).map((i) => INTEREST_LABELS[i]);
    if (matched.length) reasons.push(`Matches: ${matched.join(', ')}`);
    if (age >= 0.75) reasons.push('Great for their age');
    if (newness === 1) reasons.push('New arrival');
    if (rented.has(toy.id)) reasons.push('Rented before');

    out.push({ toy, score: Math.round(score * 1000) / 1000, breakdown, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.toy.id.localeCompare(b.toy.id));
}

/** Maximal Marginal Relevance: trade a little relevance for variety among the top results. */
export function diversify<T extends RecToy>(ranked: Recommendation<T>[], limit: number, lambda = 0.75): Recommendation<T>[] {
  const pool = [...ranked];
  const picked: Recommendation<T>[] = [];
  while (picked.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestVal = -Infinity;
    pool.forEach((cand, idx) => {
      const maxSim = picked.length ? Math.max(...picked.map((p) => similarity(cand.toy, p.toy))) : 0;
      const val = lambda * cand.score - (1 - lambda) * maxSim;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = idx;
      }
    });
    picked.push(pool.splice(bestIdx, 1)[0]);
  }
  return picked;
}

/** Full ranking: diversified head (first `limit`), then the rest by score. */
export function recommend<T extends RecToy>(kid: RecKid, toys: T[], opts: RecOptions = {}): Recommendation<T>[] {
  const ranked = scoreToys(kid, toys, opts);
  const limit = opts.limit ?? 10;
  const head = diversify(ranked, limit, opts.mmrLambda ?? 0.75);
  const headIds = new Set(head.map((r) => r.toy.id));
  return [...head, ...ranked.filter((r) => !headIds.has(r.toy.id))];
}
