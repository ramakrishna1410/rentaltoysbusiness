import type { Prisma } from '@prisma/client';
import { rollPeriod, type AllowanceLimits } from '@rentaltoys/shared';
import { prisma, type Tx } from '../lib/prisma';

export const subscriptionInclude = {
  plan: { include: { tier: true, duration: true } },
  invoices: { orderBy: { seq: 'asc' } },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{ include: typeof subscriptionInclude }>;

export function limitsFor(sub: SubscriptionWithPlan): AllowanceLimits {
  return {
    toyCredits: sub.plan.tier.toyCredits,
    swapsPerMonth: sub.plan.tier.swapsPerMonth,
    deliveriesPerMonth: sub.plan.tier.deliveriesPerMonth,
    swapRollover: sub.plan.duration.swapRollover,
  };
}

/** Brings the monthly allowance period up to date (and expires finished commitments) before it is used. */
export async function refreshSubscription(sub: SubscriptionWithPlan, db: Tx | typeof prisma = prisma, now = new Date()) {
  let data: Prisma.SubscriptionUpdateInput = {};
  if (sub.status === 'ACTIVE' || sub.status === 'PAUSED') {
    if (now >= sub.commitmentEnd) data.status = 'EXPIRED';
    else if (sub.status === 'PAUSED' && sub.pausedUntil && now >= sub.pausedUntil) {
      data = { status: 'ACTIVE', pausedUntil: null };
    }
    const rolled = rollPeriod(sub, limitsFor(sub), now);
    if (rolled.periodStart.getTime() !== sub.periodStart.getTime()) {
      Object.assign(data, {
        periodStart: rolled.periodStart,
        periodEnd: rolled.periodEnd,
        swapsUsed: rolled.swapsUsed,
        deliveriesUsed: rolled.deliveriesUsed,
        rolloverSwaps: rolled.rolloverSwaps,
      });
    }
  }
  if (Object.keys(data).length === 0) return sub;
  return db.subscription.update({ where: { id: sub.id }, data, include: subscriptionInclude });
}

export async function currentSubscription(userId: string, db: Tx | typeof prisma = prisma) {
  const sub = await db.subscription.findFirst({
    where: { userId, status: { in: ['ACTIVE', 'PAUSED', 'PENDING_PAYMENT'] } },
    include: subscriptionInclude,
    orderBy: { createdAt: 'desc' },
  });
  return sub ? refreshSubscription(sub, db) : null;
}
