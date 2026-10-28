import type { BillingCycle, DurationCode, TierCode } from '@rentaltoys/shared';

export interface PlanTier {
  code: TierCode;
  name: string;
  toyCredits: number;
  swapsPerMonth: number;
  deliveriesPerMonth: number;
  expressDelivery: boolean;
  baseMonthlyPrice: number;
}

export interface PlanDuration {
  code: DurationCode;
  name: string;
  months: number;
  priceFactor: number;
  swapRollover: boolean;
  pauseDays: number;
  buyoutDiscountPct: number;
  extras: string[];
}

export interface PlanPrice {
  id: string;
  billingCycle: BillingCycle;
  instalmentCount: number;
  instalmentAmount: number;
  totalAmount: number;
}

export interface Plan {
  id: string;
  tierCode: TierCode;
  durationCode: DurationCode;
  prices: PlanPrice[];
}

export interface Subscription {
  id: string;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
  billingCycle: BillingCycle;
  commitmentEnd: string;
  periodEnd: string;
  missingPieceCharges: number;
  plan: { tier: PlanTier; duration: PlanDuration };
  invoices: { id: string; seq: number; dueDate: string; amount: number; status: 'PENDING' | 'PAID' }[];
  remaining: { swaps: number; deliveries: number; credits: number };
  toysAtHome: { unitId: string; toyId: string; name: string; images: string[]; creditCost: number; returnRequested: boolean }[];
}

export const CYCLE_LABEL: Record<BillingCycle, string> = { MONTHLY: 'Pay monthly', QUARTERLY: 'Pay quarterly', YEARLY: 'Pay yearly' };
export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
