import { Router } from 'express';
import { z } from 'zod';
import { BILLING_CYCLES, addMonths, checkOrderAllowance, creditCost, instalmentSchedule, remaining } from '@rentaltoys/shared';
import { requireAuth } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { prisma } from '../lib/prisma';
import { currentSubscription, limitsFor, subscriptionInclude } from '../services/subscriptions';

export const plansRouter = Router();

/** All 9 plans (3 durations × Basic/Pro/Ultra) with their allowed billing cycles. */
plansRouter.get(
  '/',
  wrap(async (_req, res) => {
    const [tiers, durations, plans] = await Promise.all([
      prisma.planTier.findMany({ orderBy: { baseMonthlyPrice: 'asc' } }),
      prisma.planDuration.findMany({ orderBy: { months: 'asc' } }),
      prisma.plan.findMany({ where: { isActive: true }, include: { prices: true } }),
    ]);
    res.json({ tiers, durations, plans });
  }),
);

export const subscriptionsRouter = Router();
subscriptionsRouter.use(requireAuth());

/** Units currently at the customer's home under this subscription. */
async function toysAtHome(subscriptionId: string) {
  const items = await prisma.orderItem.findMany({
    where: { direction: 'OUT', order: { subscriptionId }, unit: { stage: 'WITH_CUSTOMER' } },
    include: { toy: true, order: { select: { createdAt: true } } },
    orderBy: { order: { createdAt: 'asc' } },
  });
  // A unit can appear in several past orders; the latest OUT is the one that matters.
  const latestOut = new Map<string, (typeof items)[number]>();
  for (const i of items) if (i.unitId) latestOut.set(i.unitId, i);
  const returns = await prisma.orderItem.findMany({
    where: { direction: 'RETURN', unitId: { in: [...latestOut.keys()] }, order: { subscriptionId, status: { not: 'CANCELLED' } } },
    include: { order: { select: { createdAt: true } } },
  });
  return [...latestOut.values()].map((i) => ({
    unitId: i.unitId!,
    toyId: i.toyId,
    name: i.toy.name,
    images: i.toy.images,
    creditCost: creditCost(i.toy.sizeClass),
    returnRequested: returns.some((r) => r.unitId === i.unitId && r.order.createdAt > i.order.createdAt),
  }));
}

subscriptionsRouter.get(
  '/current',
  wrap(async (req, res) => {
    const sub = await currentSubscription(req.user!.id);
    if (!sub) {
      res.json(null);
      return;
    }
    res.json({ ...sub, remaining: remaining(sub, limitsFor(sub)), toysAtHome: await toysAtHome(sub.id) });
  }),
);

subscriptionsRouter.post(
  '/',
  wrap(async (req, res) => {
    const { planId, billingCycle } = parse(z.object({ planId: z.string(), billingCycle: z.enum(BILLING_CYCLES) }), req.body);
    if (await currentSubscription(req.user!.id)) throw new HttpError(409, 'You already have a subscription');
    const plan = await prisma.plan.findUnique({ where: { id: planId }, include: { duration: true, prices: true } });
    if (!plan || !plan.isActive) throw new HttpError(404, 'Plan not found');
    const price = plan.prices.find((p) => p.billingCycle === billingCycle);
    if (!price) throw new HttpError(400, `${plan.duration.name} plans cannot be paid ${billingCycle.toLowerCase()}`);

    const start = new Date();
    const sub = await prisma.subscription.create({
      data: {
        userId: req.user!.id,
        planId,
        billingCycle,
        commitmentStart: start,
        commitmentEnd: addMonths(start, plan.duration.months),
        periodStart: start,
        periodEnd: addMonths(start, 1),
        invoices: { create: instalmentSchedule(start, { billingCycle, instalmentCount: price.instalmentCount, totalAmount: price.totalAmount }) },
      },
      include: subscriptionInclude,
    });
    res.status(201).json(sub);
  }),
);

export const ordersRouter = Router();
ordersRouter.use(requireAuth());

const orderSchema = z.object({
  type: z.enum(['DELIVERY', 'SWAP']),
  kidId: z.string().optional(),
  toyIds: z.array(z.string()).min(1),
  returnUnitIds: z.array(z.string()).default([]),
  scheduledDate: z.coerce.date(),
});

ordersRouter.get(
  '/',
  wrap(async (req, res) => {
    res.json(
      await prisma.order.findMany({
        where: { subscription: { userId: req.user!.id } },
        include: { items: { include: { toy: { select: { name: true, images: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);

/** Request a delivery or swap. Reserves one STORAGE unit per toy so dispatch can scan it out. */
ordersRouter.post(
  '/',
  wrap(async (req, res) => {
    const body = parse(orderSchema, req.body);
    const sub = await currentSubscription(req.user!.id);
    if (!sub || sub.status !== 'ACTIVE') throw new HttpError(400, 'You need an active subscription to order toys');
    if (body.kidId && !(await prisma.kidProfile.findFirst({ where: { id: body.kidId, userId: req.user!.id } }))) {
      throw new HttpError(404, 'Kid profile not found');
    }

    const toys = await prisma.toy.findMany({ where: { id: { in: body.toyIds }, isActive: true } });
    if (toys.length !== new Set(body.toyIds).size) throw new HttpError(404, 'Some toys were not found');
    const home = await toysAtHome(sub.id);
    const returning = home.filter((h) => !h.returnRequested && body.returnUnitIds.includes(h.unitId));
    if (returning.length !== body.returnUnitIds.length) throw new HttpError(400, 'You can only return toys you have at home that are not already being returned');

    const ask = {
      type: body.type,
      newCredits: body.toyIds.reduce((s, id) => s + creditCost(toys.find((t) => t.id === id)!.sizeClass), 0),
      returnCredits: returning.reduce((s, r) => s + r.creditCost, 0),
    };
    const errors = checkOrderAllowance(sub, limitsFor(sub), ask);
    if (errors.length) throw new HttpError(400, errors[0], { errors });

    const order = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: { subscriptionId: sub.id, kidId: body.kidId, type: body.type, scheduledDate: body.scheduledDate },
      });
      for (const toyId of body.toyIds) {
        const candidates = await tx.toyUnit.findMany({
          where: { toyId, stage: 'STORAGE', reservedForOrderId: null },
          include: { bin: true },
        });
        // Closest-to-dispatch unit first: cheaper to pick.
        candidates.sort((a, b) => (a.bin?.pickCost ?? 0) - (b.bin?.pickCost ?? 0));
        let reserved: string | undefined;
        for (const c of candidates) {
          const r = await tx.toyUnit.updateMany({ where: { id: c.id, stage: 'STORAGE', reservedForOrderId: null }, data: { reservedForOrderId: order.id } });
          if (r.count === 1) {
            reserved = c.id;
            break;
          }
        }
        if (!reserved) throw new HttpError(409, `${toys.find((t) => t.id === toyId)!.name} just went out of stock`);
        await tx.orderItem.create({ data: { orderId: order.id, toyId, unitId: reserved, direction: 'OUT' } });
      }
      for (const r of returning) {
        await tx.orderItem.create({ data: { orderId: order.id, toyId: r.toyId, unitId: r.unitId, direction: 'RETURN' } });
      }
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          deliveriesUsed: { increment: 1 },
          swapsUsed: body.type === 'SWAP' ? { increment: 1 } : undefined,
          creditsInUse: sub.creditsInUse - ask.returnCredits + ask.newCredits,
        },
      });
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
    });
    res.status(201).json(order);
  }),
);
