import type { BillingCycle, DurationCode, TierCode } from './enums';

export interface TierConfig {
  code: TierCode;
  name: string;
  /** Standard toy = 1 credit, large toy = 2. */
  toyCredits: number;
  swapsPerMonth: number;
  deliveriesPerMonth: number;
  expressDelivery: boolean;
  baseMonthlyPrice: number;
}

export interface DurationConfig {
  code: DurationCode;
  name: string;
  months: number;
  /** Multiplier on the tier's monthly base price. */
  priceFactor: number;
  swapRollover: boolean;
  pauseDays: number;
  buyoutDiscountPct: number;
  extras: string[];
  /** Allowed ways to pay, with the extra discount (%) for paying more upfront. */
  billingCycles: Partial<Record<BillingCycle, number>>;
}

// Placeholder business numbers; the seed writes these to the DB, where the admin can change them.
export const TIERS: Record<TierCode, TierConfig> = {
  BASIC: { code: 'BASIC', name: 'Basic', toyCredits: 2, swapsPerMonth: 1, deliveriesPerMonth: 1, expressDelivery: false, baseMonthlyPrice: 799 },
  PRO: { code: 'PRO', name: 'Pro', toyCredits: 3, swapsPerMonth: 2, deliveriesPerMonth: 2, expressDelivery: false, baseMonthlyPrice: 1199 },
  ULTRA: { code: 'ULTRA', name: 'Ultra', toyCredits: 5, swapsPerMonth: 4, deliveriesPerMonth: 4, expressDelivery: true, baseMonthlyPrice: 1699 },
};

export const DURATIONS: Record<DurationCode, DurationConfig> = {
  MONTHLY: {
    code: 'MONTHLY', name: 'Monthly', months: 1, priceFactor: 1, swapRollover: false, pauseDays: 0, buyoutDiscountPct: 0,
    extras: [], billingCycles: { MONTHLY: 0 },
  },
  QUARTERLY: {
    code: 'QUARTERLY', name: 'Quarterly', months: 3, priceFactor: 0.9, swapRollover: true, pauseDays: 7, buyoutDiscountPct: 10,
    extras: [], billingCycles: { MONTHLY: 0, QUARTERLY: 5 },
  },
  YEARLY: {
    code: 'YEARLY', name: 'Yearly', months: 12, priceFactor: 0.8, swapRollover: true, pauseDays: 28, buyoutDiscountPct: 20,
    extras: ['Birthday surprise toy', 'Early access to new toys'],
    billingCycles: { MONTHLY: 0, QUARTERLY: 3, YEARLY: 8 },
  },
};

export const CYCLE_MONTHS: Record<BillingCycle, number> = { MONTHLY: 1, QUARTERLY: 3, YEARLY: 12 };

export interface PriceQuote {
  billingCycle: BillingCycle;
  instalmentCount: number;
  instalmentAmount: number;
  totalAmount: number;
  effectiveMonthly: number;
}

export function allowedCycles(duration: DurationConfig): BillingCycle[] {
  return Object.keys(duration.billingCycles) as BillingCycle[];
}

export function quotePrice(tier: TierConfig, duration: DurationConfig, cycle: BillingCycle): PriceQuote {
  const cycleDiscount = duration.billingCycles[cycle];
  if (cycleDiscount === undefined) {
    throw new Error(`${duration.name} plans cannot be paid ${cycle.toLowerCase()}`);
  }
  const totalAmount = Math.round(tier.baseMonthlyPrice * duration.months * duration.priceFactor * (1 - cycleDiscount / 100));
  const instalmentCount = duration.months / CYCLE_MONTHS[cycle];
  return {
    billingCycle: cycle,
    instalmentCount,
    instalmentAmount: Math.round(totalAmount / instalmentCount),
    totalAmount,
    effectiveMonthly: Math.round(totalAmount / duration.months),
  };
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** Instalments sum exactly to the total; any rounding difference lands on the last one. */
export function instalmentSchedule(
  start: Date,
  quote: Pick<PriceQuote, 'billingCycle' | 'instalmentCount' | 'totalAmount'>,
): { seq: number; dueDate: Date; amount: number }[] {
  const base = Math.round(quote.totalAmount / quote.instalmentCount);
  return Array.from({ length: quote.instalmentCount }, (_, i) => ({
    seq: i + 1,
    dueDate: addMonths(start, i * CYCLE_MONTHS[quote.billingCycle]),
    amount: i === quote.instalmentCount - 1 ? quote.totalAmount - base * (quote.instalmentCount - 1) : base,
  }));
}
