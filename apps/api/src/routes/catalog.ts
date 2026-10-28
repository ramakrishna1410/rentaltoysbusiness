import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { INTERESTS, MATERIALS, PIECE_TYPES, POWER_TYPES, remaining } from '@rentaltoys/shared';
import { optionalAuth, requireAuth } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { prisma } from '../lib/prisma';
import { availableCatalog, availableCount, rankForKid, toyCard } from '../services/catalog';
import { currentSubscription, limitsFor } from '../services/subscriptions';

const filterSchema = z.object({
  kidId: z.string().optional(),
  ageMonths: z.coerce.number().int().min(0).optional(),
  material: z.enum(MATERIALS).optional(),
  powerType: z.enum(POWER_TYPES).optional(),
  pieceType: z.enum(PIECE_TYPES).optional(),
  interest: z.enum(INTERESTS).optional(),
  q: z.string().optional(),
});

export const catalogRouter = Router();
catalogRouter.use(optionalAuth);

async function ensureOwnKid(userId: string | undefined, kidId: string) {
  if (!userId) throw new HttpError(401, 'Login to get personalised results');
  const kid = await prisma.kidProfile.findFirst({ where: { id: kidId, userId } });
  if (!kid) throw new HttpError(404, 'Kid profile not found');
}

/**
 * Catalog of toys with at least one unit in STORAGE. With kidId, results are ranked for that kid;
 * otherwise they are sorted by popularity.
 */
catalogRouter.get(
  '/',
  wrap(async (req, res) => {
    const f = parse(filterSchema, req.query);
    const where: Prisma.ToyWhereInput = {
      material: f.material,
      powerType: f.powerType,
      pieceType: f.pieceType,
      interestTags: f.interest ? { has: f.interest } : undefined,
      ...(f.ageMonths !== undefined ? { ageMinMonths: { lte: f.ageMonths }, ageMaxMonths: { gte: f.ageMonths } } : {}),
      ...(f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { brand: { contains: f.q, mode: 'insensitive' } }] } : {}),
    };
    const toys = await availableCatalog(where);
    if (f.kidId) {
      await ensureOwnKid(req.user?.id, f.kidId);
      const { ranked } = await rankForKid(f.kidId, toys, { limit: 12 });
      const rankedIds = new Set(ranked.map((r) => r.toy.id));
      // Toys outside the kid's age window still show, after the ranked ones.
      const rest = toys.filter((t) => !rankedIds.has(t.id)).sort((a, b) => b.rentalCount - a.rentalCount);
      res.json([
        ...ranked.map((r) => toyCard(r.toy, { score: r.score, reasons: r.reasons })),
        ...rest.map((t) => toyCard(t)),
      ]);
      return;
    }
    res.json(toys.sort((a, b) => b.rentalCount - a.rentalCount).map((t) => toyCard(t)));
  }),
);

/** Home screen sections for one kid. */
catalogRouter.get(
  '/for-you',
  requireAuth(),
  wrap(async (req, res) => {
    const { kidId } = parse(z.object({ kidId: z.string() }), req.query);
    await ensureOwnKid(req.user!.id, kidId);
    const toys = await availableCatalog();
    const sub = await currentSubscription(req.user!.id);
    const maxCredits = sub && sub.status === 'ACTIVE' ? limitsFor(sub).toyCredits : undefined;
    const { kid, ageMonths, ranked } = await rankForKid(kidId, toys, { maxCredits, limit: 10 });

    const inAge = ranked.map((r) => r.toy);
    const popular = [...inAge].sort((a, b) => b.rentalCount - a.rentalCount).slice(0, 10);
    const newest = [...inAge].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
    res.json({
      kid: { id: kid.id, name: kid.name, ageMonths, interests: kid.interests },
      allowance: sub && sub.status === 'ACTIVE' ? remaining(sub, limitsFor(sub)) : null,
      sections: [
        { key: 'picked', title: `Picked for ${kid.name}`, toys: ranked.slice(0, 10).map((r) => toyCard(r.toy, { score: r.score, reasons: r.reasons })) },
        { key: 'popular', title: 'Popular for this age', toys: popular.map((t) => toyCard(t)) },
        { key: 'new', title: 'New arrivals', toys: newest.map((t) => toyCard(t)) },
      ],
    });
  }),
);

catalogRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const toy = await prisma.toy.findFirst({ where: { id: req.params.id, isActive: true } });
    if (!toy) throw new HttpError(404, 'Toy not found');
    const availableUnits = await availableCount(toy.id);
    const kidId = typeof req.query.kidId === 'string' ? req.query.kidId : undefined;
    if (req.user && kidId) {
      const kid = await prisma.kidProfile.findFirst({ where: { id: kidId, userId: req.user.id } });
      if (kid) await prisma.interaction.create({ data: { userId: req.user.id, kidId, toyId: toy.id, type: 'VIEW' } });
    }
    res.json({
      ...toyCard({ ...toy, availableUnits, creditCost: toy.sizeClass === 'LARGE' ? 2 : 1 }),
      description: toy.description,
      lengthCm: toy.lengthCm,
      breadthCm: toy.breadthCm,
      heightCm: toy.heightCm,
      weightKg: toy.weightKg,
      batteryType: toy.batteryType,
      batteryCount: toy.batteryCount,
      tags: toy.tags,
    });
  }),
);

const feedbackSchema = z.object({ kidId: z.string().optional(), rating: z.number().int().min(1).max(5).optional() });

catalogRouter.post(
  '/:id/wishlist',
  requireAuth(),
  wrap(async (req, res) => {
    const { kidId } = parse(feedbackSchema, req.body);
    if (kidId) await ensureOwnKid(req.user!.id, kidId);
    await prisma.interaction.create({ data: { userId: req.user!.id, kidId, toyId: req.params.id, type: 'WISHLIST' } });
    res.status(201).json({ ok: true });
  }),
);

catalogRouter.post(
  '/:id/rating',
  requireAuth(),
  wrap(async (req, res) => {
    const { kidId, rating } = parse(feedbackSchema.required({ rating: true }), req.body);
    if (kidId) await ensureOwnKid(req.user!.id, kidId);
    const rented = await prisma.interaction.findFirst({ where: { userId: req.user!.id, toyId: req.params.id, type: 'RENT' } });
    if (!rented) throw new HttpError(400, 'You can rate toys you have rented');
    await prisma.$transaction([
      prisma.interaction.create({ data: { userId: req.user!.id, kidId, toyId: req.params.id, type: 'RATING', value: rating } }),
      prisma.toy.update({ where: { id: req.params.id }, data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } } }),
    ]);
    res.status(201).json({ ok: true });
  }),
);
