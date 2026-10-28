import { describe, expect, it } from 'vitest';
import {
  BILLING_CYCLES,
  DURATIONS,
  TIERS,
  TOY_STAGES,
  allowedCycles,
  canTransition,
  checkMove,
  checkOrderAllowance,
  instalmentSchedule,
  parseQr,
  pieceQr,
  quotePrice,
  rollPeriod,
  sizeClassFor,
  unitQr,
} from '../src';

describe('pricing', () => {
  it('prices every tier × duration × allowed billing cycle', () => {
    for (const tier of Object.values(TIERS)) {
      for (const d of Object.values(DURATIONS)) {
        for (const c of allowedCycles(d)) {
          const q = quotePrice(tier, d, c);
          expect(q.totalAmount).toBeGreaterThan(0);
          expect(q.instalmentCount * (c === 'MONTHLY' ? 1 : c === 'QUARTERLY' ? 3 : 12)).toBe(d.months);
        }
      }
    }
  });

  it('allows the agreed billing cycles only', () => {
    expect(allowedCycles(DURATIONS.MONTHLY)).toEqual(['MONTHLY']);
    expect(allowedCycles(DURATIONS.QUARTERLY).sort()).toEqual(['MONTHLY', 'QUARTERLY']);
    expect(allowedCycles(DURATIONS.YEARLY).sort()).toEqual([...BILLING_CYCLES].sort());
    expect(() => quotePrice(TIERS.PRO, DURATIONS.QUARTERLY, 'YEARLY')).toThrow();
  });

  it('makes paying upfront cheaper and longer commitments cheaper per month', () => {
    const monthly = quotePrice(TIERS.PRO, DURATIONS.YEARLY, 'MONTHLY');
    const upfront = quotePrice(TIERS.PRO, DURATIONS.YEARLY, 'YEARLY');
    expect(upfront.totalAmount).toBeLessThan(monthly.totalAmount);
    expect(quotePrice(TIERS.PRO, DURATIONS.YEARLY, 'MONTHLY').effectiveMonthly).toBeLessThan(
      quotePrice(TIERS.PRO, DURATIONS.MONTHLY, 'MONTHLY').effectiveMonthly,
    );
  });

  it('builds an instalment schedule that sums to the total', () => {
    const q = quotePrice(TIERS.ULTRA, DURATIONS.YEARLY, 'QUARTERLY');
    const s = instalmentSchedule(new Date('2026-01-31T00:00:00Z'), q);
    expect(s).toHaveLength(4);
    expect(s.reduce((a, i) => a + i.amount, 0)).toBe(q.totalAmount);
    expect(s[1].dueDate.toISOString().slice(0, 10)).toBe('2026-04-30');
  });
});

describe('allowance', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const state = {
    commitmentStart: start,
    commitmentEnd: new Date('2026-04-01T00:00:00Z'),
    periodStart: start,
    periodEnd: new Date('2026-02-01T00:00:00Z'),
    swapsUsed: 0,
    deliveriesUsed: 0,
    rolloverSwaps: 0,
    creditsInUse: 0,
  };
  const limits = { toyCredits: 3, swapsPerMonth: 2, deliveriesPerMonth: 2, swapRollover: true };

  it('rolls unused swaps into the next month when the plan allows', () => {
    const next = rollPeriod({ ...state, swapsUsed: 1 }, limits, new Date('2026-02-10T00:00:00Z'));
    expect(next.rolloverSwaps).toBe(1);
    expect(next.swapsUsed).toBe(0);
    expect(rollPeriod(state, { ...limits, swapRollover: false }, new Date('2026-02-10T00:00:00Z')).rolloverSwaps).toBe(0);
  });

  it('counts a large toy as 2 credits against the allowance', () => {
    expect(checkOrderAllowance(state, limits, { type: 'DELIVERY', newCredits: 2, returnCredits: 0 })).toEqual([]);
    expect(checkOrderAllowance({ ...state, creditsInUse: 2 }, limits, { type: 'DELIVERY', newCredits: 2, returnCredits: 0 })).not.toEqual([]);
    expect(sizeClassFor({ lengthCm: 90, breadthCm: 50, heightCm: 60 }, 6)).toBe('LARGE');
  });
});

describe('lifecycle', () => {
  const base = { pieceCount: 1, scannedPieceNos: [1] };

  it('only allows the documented transitions', () => {
    expect(canTransition('STORAGE', 'IN_TRANSIT')).toBe(true);
    expect(canTransition('PROCUREMENT', 'WITH_CUSTOMER')).toBe(false);
    for (const s of TOY_STAGES) expect(canTransition('SCRAP', s)).toBe(false);
  });

  it('rejects a stale scan', () => {
    const r = checkMove({ ...base, currentStage: 'SANITATION', expectedFromStage: 'PROCUREMENT', toStage: 'STORAGE', toBinId: 'b' });
    expect(r.ok).toBe(false);
  });

  it('needs every piece scanned on dispatch; missing pieces force DAMAGE on return', () => {
    const dispatch = checkMove({
      currentStage: 'STORAGE', expectedFromStage: 'STORAGE', toStage: 'IN_TRANSIT', pieceCount: 4, scannedPieceNos: [1, 2, 4],
      orderId: 'o', reservedForOrderId: 'o',
    });
    expect(dispatch.ok).toBe(false);
    expect(dispatch.missingPieceNos).toEqual([3]);

    const back = { currentStage: 'IN_TRANSIT', expectedFromStage: 'IN_TRANSIT', pieceCount: 4, scannedPieceNos: [1, 2] } as const;
    expect(checkMove({ ...back, toStage: 'SANITATION' }).ok).toBe(false);
    expect(checkMove({ ...back, toStage: 'DAMAGE', reason: 'Pieces missing' }).ok).toBe(true);
  });

  it('dispatches only units reserved for the order', () => {
    const r = checkMove({ ...base, currentStage: 'STORAGE', expectedFromStage: 'STORAGE', toStage: 'IN_TRANSIT', orderId: 'o1', reservedForOrderId: 'o2' });
    expect(r.ok).toBe(false);
  });
});

describe('qr payloads', () => {
  it('round-trips unit and piece payloads', () => {
    expect(parseQr(unitQr('abc'))).toEqual({ kind: 'UNIT', unitId: 'abc' });
    expect(parseQr(pieceQr('abc', 2, 5))).toEqual({ kind: 'PIECE', unitId: 'abc', pieceNo: 2, total: 5 });
    expect(parseQr('RT:P:abc:6/5')).toBeNull();
    expect(parseQr('hello')).toBeNull();
  });
});
