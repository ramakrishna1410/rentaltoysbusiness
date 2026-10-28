import { describe, expect, it } from 'vitest';
import { ageFit, recommend, scoreToys, type RecToy } from '../src';

const now = new Date('2026-10-01T00:00:00Z');
const old = new Date('2026-01-01T00:00:00Z');

const toy = (id: string, over: Partial<RecToy> = {}): RecToy => ({
  id,
  ageMinMonths: 36,
  ageMaxMonths: 72,
  material: 'PLASTIC',
  powerType: 'NON_ELECTRIC',
  interestTags: [],
  rentalCount: 0,
  ratingSum: 0,
  ratingCount: 0,
  availableUnits: 2,
  creditCost: 1,
  createdAt: old,
  ...over,
});

describe('ageFit', () => {
  it('is highest in the middle of the range, low in the tolerance band, zero outside', () => {
    expect(ageFit(54, 36, 72)).toBe(1);
    expect(ageFit(36, 36, 72)).toBeGreaterThan(0.5);
    expect(ageFit(34, 36, 72)).toBe(0.3);
    expect(ageFit(20, 36, 72)).toBe(0);
  });
});

describe('scoreToys', () => {
  const kid = { ageMonths: 48, interests: ['WOODEN', 'EDUCATIONAL_STEM'] as const, interactions: [] };

  it('ranks toys matching signup interests first (cold start)', () => {
    const toys = [
      toy('plastic-car'),
      toy('wooden-abacus', { material: 'WOODEN', interestTags: ['EDUCATIONAL_STEM'] }),
      toy('plush', { material: 'FABRIC_PLUSH' }),
    ];
    const ranked = scoreToys({ ...kid, interests: [...kid.interests] }, toys, { now });
    expect(ranked[0].toy.id).toBe('wooden-abacus');
    expect(ranked[0].reasons[0]).toContain('Wooden');
  });

  it('drops toys with no available units, wrong age, or too many credits', () => {
    const toys = [
      toy('out-of-stock', { availableUnits: 0 }),
      toy('baby', { ageMinMonths: 0, ageMaxMonths: 12 }),
      toy('large', { creditCost: 2 }),
      toy('ok'),
    ];
    const ids = scoreToys({ ...kid, interests: [...kid.interests] }, toys, { now, maxCredits: 1 }).map((r) => r.toy.id);
    expect(ids).toEqual(['ok']);
  });

  it('learns from behaviour: renting electric toys lifts other electric toys', () => {
    const toys = [toy('rc-car', { powerType: 'ELECTRIC' }), toy('robot', { powerType: 'ELECTRIC' }), toy('blocks', { interestTags: ['BUILDING_BLOCKS'] })];
    const base = { ageMonths: 48, interests: [] as never[], interactions: [] as never[] };
    const before = scoreToys(base, toys, { now }).find((r) => r.toy.id === 'robot')!.score;
    const after = scoreToys(
      { ...base, interactions: [{ toyId: 'rc-car', type: 'RENT', createdAt: now }] as never[] },
      toys,
      { now },
    ).find((r) => r.toy.id === 'robot')!.score;
    expect(after).toBeGreaterThan(before);
  });
});

describe('recommend (MMR)', () => {
  it('mixes categories in the head instead of stacking near-duplicates', () => {
    const toys = [
      toy('w1', { material: 'WOODEN', rentalCount: 10 }),
      toy('w2', { material: 'WOODEN', rentalCount: 9 }),
      toy('w3', { material: 'WOODEN', rentalCount: 8 }),
      toy('puzzle', { interestTags: ['PUZZLES'], material: 'WOODEN', rentalCount: 1 }),
    ];
    const kid = { ageMonths: 48, interests: ['WOODEN', 'PUZZLES'] as never[], interactions: [] };
    const head = recommend(kid, toys, { now, limit: 2, mmrLambda: 0.5 }).slice(0, 2).map((r) => r.toy.id);
    expect(head).toContain('puzzle');
  });
});

describe('Get started preferences', () => {
  const plain = { ageMonths: 48, interests: [] as never[], interactions: [] as never[] };

  it('boosts toys in the kid’s favourite colour and says why', () => {
    const toys = [
      toy('red-car', { colorType: 'SINGLE', primaryColor: 'RED' }),
      toy('blue-car', { colorType: 'SINGLE', primaryColor: 'BLUE' }),
    ];
    const ranked = scoreToys({ ...plain, favoriteColors: ['RED'] }, toys, { now });
    expect(ranked[0].toy.id).toBe('red-car');
    expect(ranked[0].reasons).toContain('Loves red');
  });

  it('counts dual toys that include the favourite colour', () => {
    const toys = [toy('red-yellow', { colorType: 'DUAL', primaryColor: 'RED', secondaryColor: 'YELLOW' }), toy('green', { colorType: 'SINGLE', primaryColor: 'GREEN' })];
    expect(scoreToys({ ...plain, favoriteColors: ['YELLOW'] }, toys, { now })[0].toy.id).toBe('red-yellow');
  });

  it('outdoor kids see ride-ons higher; indoor kids see them lower', () => {
    const toys = [toy('bike', { interestTags: ['OUTDOOR_RIDE_ON'] }), toy('blocks', { interestTags: ['BUILDING_BLOCKS'] })];
    expect(scoreToys({ ...plain, playPlace: 'OUTDOOR' }, toys, { now })[0].toy.id).toBe('bike');
    const indoor = scoreToys({ ...plain, interests: ['OUTDOOR_RIDE_ON', 'BUILDING_BLOCKS'] as never[], playPlace: 'INDOOR' }, toys, { now });
    expect(indoor[0].toy.id).toBe('blocks');
  });

  it('a learning goal lifts STEM toys; screen-free lowers battery toys', () => {
    const toys = [toy('abacus', { interestTags: ['EDUCATIONAL_STEM'] }), toy('plush', { material: 'FABRIC_PLUSH' })];
    expect(scoreToys({ ...plain, goals: ['LEARNING'] }, toys, { now })[0].toy.id).toBe('abacus');
    const e = [toy('robot', { powerType: 'ELECTRIC' }), toy('wood', { material: 'WOODEN' })];
    expect(scoreToys({ ...plain, goals: ['SCREEN_FREE'] }, e, { now })[0].toy.id).toBe('wood');
  });
});
