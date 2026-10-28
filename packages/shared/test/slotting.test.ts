import { describe, expect, it } from 'vitest';
import { classifyVelocity, fitsDimensions, suggestBins, type SlotBin, type SlotItem } from '../src';

const bin = (over: Partial<SlotBin>): SlotBin => ({
  id: over.code ?? 'B',
  code: 'B',
  lengthCm: 50,
  breadthCm: 40,
  heightCm: 40,
  maxWeightKg: 30,
  usedVolumeCm3: 0,
  usedWeightKg: 0,
  shelfLevel: 2,
  maxShelfLevel: 4,
  zoneType: 'MEDIUM',
  pickCost: 5,
  toyIds: [],
  ageBands: [],
  ...over,
});

const item = (over: Partial<SlotItem> = {}): SlotItem => ({
  toyId: 't1',
  lengthCm: 30,
  breadthCm: 20,
  heightCm: 20,
  weightKg: 1,
  velocity: 'B',
  ...over,
});

describe('fitsDimensions', () => {
  it('accepts any axis rotation', () => {
    expect(fitsDimensions({ lengthCm: 10, breadthCm: 45, heightCm: 30 }, { lengthCm: 50, breadthCm: 40, heightCm: 20 })).toBe(true);
  });
  it('rejects when one side is too long', () => {
    expect(fitsDimensions({ lengthCm: 60, breadthCm: 10, heightCm: 10 }, { lengthCm: 50, breadthCm: 40, heightCm: 40 })).toBe(false);
  });
});

describe('suggestBins', () => {
  it('filters bins by weight and remaining volume', () => {
    const bins = [
      bin({ code: 'HEAVY', usedWeightKg: 29.5 }),
      bin({ code: 'FULL', usedVolumeCm3: 50 * 40 * 40 * 0.85 - 100 }),
      bin({ code: 'OK' }),
    ];
    expect(suggestBins(item(), bins).map((s) => s.binCode)).toEqual(['OK']);
  });

  it('prefers the tighter fit (best-fit) when everything else is equal', () => {
    const bins = [bin({ code: 'BIG', lengthCm: 100, breadthCm: 80, heightCm: 60 }), bin({ code: 'SNUG' })];
    expect(suggestBins(item(), bins)[0].binCode).toBe('SNUG');
  });

  it('keeps small toys out of the large floor bays', () => {
    const bins = [bin({ code: 'BAY', lengthCm: 150, breadthCm: 80, heightCm: 100, shelfLevel: 1, maxShelfLevel: 1 }), bin({ code: 'SHELF' })];
    expect(suggestBins(item(), bins)[0].binCode).toBe('SHELF');
  });

  it('sends A-class toys to fast zones near dispatch and C-class to slow zones', () => {
    const bins = [bin({ code: 'FAST', zoneType: 'FAST', pickCost: 1 }), bin({ code: 'SLOW', zoneType: 'SLOW', pickCost: 10 })];
    expect(suggestBins(item({ velocity: 'A' }), bins)[0].binCode).toBe('FAST');
    expect(suggestBins(item({ velocity: 'C' }), bins)[0].binCode).toBe('SLOW');
  });

  it('puts heavy toys on low shelves', () => {
    const bins = [bin({ code: 'TOP', shelfLevel: 4 }), bin({ code: 'FLOOR', shelfLevel: 1 })];
    expect(suggestBins(item({ weightKg: 9 }), bins)[0].binCode).toBe('FLOOR');
  });

  it('co-locates units of the same toy', () => {
    const bins = [bin({ code: 'OTHER' }), bin({ code: 'SAME', toyIds: ['t1'] })];
    const [top] = suggestBins(item(), bins);
    expect(top.binCode).toBe('SAME');
    expect(top.reasons).toContain('Same toy already stored here');
  });

  it('returns at most `limit` suggestions', () => {
    const bins = Array.from({ length: 6 }, (_, i) => bin({ code: `B${i}` }));
    expect(suggestBins(item(), bins, { limit: 3 })).toHaveLength(3);
  });
});

describe('classifyVelocity', () => {
  it('splits rentals Pareto-style and starts unrented toys at B', () => {
    const v = classifyVelocity({ hit: 80, mid: 15, tail: 5, fresh: 0 });
    expect(v).toEqual({ hit: 'A', mid: 'B', tail: 'C', fresh: 'B' });
  });
});
