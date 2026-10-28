import { addMonths } from './plans';

/** The subset of a subscription the allowance rules look at. */
export interface AllowanceState {
  commitmentStart: Date;
  commitmentEnd: Date;
  periodStart: Date;
  periodEnd: Date;
  swapsUsed: number;
  deliveriesUsed: number;
  rolloverSwaps: number;
  creditsInUse: number;
}

export interface AllowanceLimits {
  toyCredits: number;
  swapsPerMonth: number;
  deliveriesPerMonth: number;
  swapRollover: boolean;
}

/**
 * Allowances reset every month of the commitment. With rollover (quarterly/yearly), unused swaps carry
 * into the next month but never past the end of the commitment, and the carried amount is capped at
 * one quarter's worth so it cannot pile up unbounded.
 */
export function rollPeriod(state: AllowanceState, limits: AllowanceLimits, now: Date): AllowanceState {
  let s = { ...state };
  while (now >= s.periodEnd && s.periodEnd < s.commitmentEnd) {
    const unused = Math.max(0, limits.swapsPerMonth + s.rolloverSwaps - s.swapsUsed);
    const nextEnd = addMonths(s.periodEnd, 1);
    s = {
      ...s,
      periodStart: s.periodEnd,
      periodEnd: nextEnd > s.commitmentEnd ? s.commitmentEnd : nextEnd,
      swapsUsed: 0,
      deliveriesUsed: 0,
      rolloverSwaps: limits.swapRollover ? Math.min(unused, limits.swapsPerMonth * 3) : 0,
    };
  }
  return s;
}

export function remaining(state: AllowanceState, limits: AllowanceLimits) {
  return {
    swaps: Math.max(0, limits.swapsPerMonth + state.rolloverSwaps - state.swapsUsed),
    deliveries: Math.max(0, limits.deliveriesPerMonth - state.deliveriesUsed),
    credits: Math.max(0, limits.toyCredits - state.creditsInUse),
  };
}

export interface OrderAsk {
  type: 'DELIVERY' | 'SWAP';
  newCredits: number;
  returnCredits: number;
}

/** Returns the reasons an order cannot be placed (empty when allowed). */
export function checkOrderAllowance(state: AllowanceState, limits: AllowanceLimits, ask: OrderAsk): string[] {
  const errors: string[] = [];
  const left = remaining(state, limits);
  if (left.deliveries < 1) errors.push('No deliveries left this month.');
  if (ask.type === 'SWAP') {
    if (left.swaps < 1) errors.push('No swaps left this month.');
    if (ask.returnCredits <= 0) errors.push('A swap must return at least one toy.');
  }
  const after = state.creditsInUse - ask.returnCredits + ask.newCredits;
  if (after > limits.toyCredits) {
    errors.push(`Plan allows ${limits.toyCredits} toy credits at home; this order needs ${after}.`);
  }
  if (ask.newCredits <= 0) errors.push('Pick at least one toy.');
  return errors;
}
