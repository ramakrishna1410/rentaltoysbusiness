import type { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { CATALOG_SORTS, COLOR_FILTERS, INTERESTS, PARENT_GOALS, PLAY_PLACES, MATERIALS, PIECE_TYPES, POWER_TYPES, paginate, remaining } from '@rentaltoys/shared';
import { optionalAuth, requireAuth } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { baseUrl, photoIdsInclude } from '../lib/images';
import { prisma } from '../lib/prisma';
import { availableCatalog, availableCount, rankForKid, rankForProfile, toyCard } from '../services/catalog';
import { currentSubscription, limitsFor } from '../services/subscriptions';

/** Comma-separated list query param, e.g. ?colors=RED,PINK */
function csv<T extends string>(values: readonly [T, ...T[]]) {
  return z
    .string()
    .optional()
    .transform((s) => (s ? s.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(values)));
}

const filterSchema = z.object({
  kidId: z.string().optional(),
  ageMonths: z.coerce.number().int().min(0).optional(),
  material: z.enum(MATERIALS).optional(),
  powerType: z.enum(POWER_TYPES).optional(),
  pieceType: z.enum(PIECE_TYPES).optional(),
  interest: z.enum(INTERESTS).optional(),
  q: z.string().optional(),
  color: z.enum(COLOR_FILTERS).optional(),
  sort: z.enum(CATALOG_SORTS).default('best'),
  // Guest answers from "Get started" (ranking only, never filtering): used when there's no kidId.
  kidAgeMonths: z.coerce.number().int().min(0).max(216).optional(),
  likes: csv(INTERESTS),
  colors: csv(COLOR_FILTERS),
  playPlace: z.enum(PLAY_PLACES).optional(),
  goals: csv(PARENT_GOALS),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** Same rule as matchesColor in @rentaltoys/shared, as a database filter. */
function colorWhere(color: (typeof COLOR_FILTERS)[number] | undefined): Prisma.ToyWhereInput {
  if (!color) return {};
  if (color === 'DUAL' || color === 'MULTI') return { colorType: color };
  return { OR: [{ primaryColor: color }, { colorType: 'DUAL', secondaryColor: color }] };
}

export const catalogRouter = Router();
catalogRouter.use(optionalAuth);

async function ensureOwnKid(userId: string | undefined, kidId: string) {
  if (!userId) throw new HttpError(401, 'Login to get personalised results');
  const kid = await prisma.kidProfile.findFirst({ where: { id: kidId, userId } });
  if (!kid) throw new HttpError(404, 'Kid profile not found');
}

/**
 * Catalog of toys with at least one unit in STORAGE, one page at a time.
 * sort=best ranks for the kid when kidId is given (popularity otherwise). The whole filtered list is
 * ranked before slicing, so page 2 continues page 1's order; fine for a catalog of a few thousand toys.
 */
catalogRouter.get(
  '/',
  wrap(async (req, res) => {
    const f = parse(filterSchema, req.query);
    const base = baseUrl(req);
    const where: Prisma.ToyWhereInput = {
      material: f.material,
      powerType: f.powerType,
      pieceType: f.pieceType,
      interestTags: f.interest ? { has: f.interest } : undefined,
      ...(f.ageMonths !== undefined ? { ageMinMonths: { lte: f.ageMonths }, ageMaxMonths: { gte: f.ageMonths } } : {}),
      // Both of these use OR internally, so they're combined with AND rather than spread.
      AND: [
        colorWhere(f.color),
        f.q ? { OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { brand: { contains: f.q, mode: 'insensitive' } }] } : {},
      ],
    };
    const toys = await availableCatalog(where);
    if (f.kidId) await ensureOwnKid(req.user?.id, f.kidId);

    let cards: ReturnType<typeof toyCard>[];
    const guest =
      !f.kidId && f.kidAgeMonths !== undefined
        ? { ageMonths: f.kidAgeMonths, interests: f.likes, favoriteColors: f.colors, playPlace: f.playPlace ?? null, goals: f.goals, interactions: [] }
        : null;
    if (f.sort === 'best' && (f.kidId || guest)) {
      const ranked = f.kidId ? (await rankForKid(f.kidId, toys, { limit: 12 })).ranked : rankForProfile(guest!, toys, { limit: 12 });
      const rankedIds = new Set(ranked.map((r) => r.toy.id));
      // Toys outside the kid's age window still show, after the ranked ones.
      const rest = toys.filter((t) => !rankedIds.has(t.id)).sort((a, b) => b.rentalCount - a.rentalCount);
      cards = [...ranked.map((r) => toyCard(r.toy, base, { score: r.score, reasons: r.reasons })), ...rest.map((t) => toyCard(t, base))];
    } else {
      const order: Record<typeof f.sort, (a: (typeof toys)[number], b: (typeof toys)[number]) => number> = {
        best: (a, b) => b.rentalCount - a.rentalCount,
        popular: (a, b) => b.rentalCount - a.rentalCount,
        newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        age: (a, b) => a.ageMinMonths - b.ageMinMonths || a.ageMaxMonths - b.ageMaxMonths,
      };
      cards = toys.sort((a, b) => order[f.sort](a, b) || a.name.localeCompare(b.name)).map((t) => toyCard(t, base));
    }
    res.json(paginate(cards, f.page, f.pageSize));
  }),
);

/** Home screen sections for one kid. */
catalogRouter.get(
  '/for-you',
  requireAuth(),
  wrap(async (req, res) => {
    const { kidId } = parse(z.object({ kidId: z.string() }), req.query);
    await ensureOwnKid(req.user!.id, kidId);
    const base = baseUrl(req);
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
        { key: 'picked', title: `Picked for ${kid.name}`, toys: ranked.slice(0, 10).map((r) => toyCard(r.toy, base, { score: r.score, reasons: r.reasons })) },
        { key: 'popular', title: 'Popular for this age', toys: popular.map((t) => toyCard(t, base)) },
        { key: 'new', title: 'New arrivals', toys: newest.map((t) => toyCard(t, base)) },
      ],
    });
  }),
);

catalogRouter.get(
  '/:id',
  wrap(async (req, res) => {
    const toy = await prisma.toy.findFirst({ where: { id: req.params.id, isActive: true }, include: { photos: photoIdsInclude } });
    if (!toy) throw new HttpError(404, 'Toy not found');
    const availableUnits = await availableCount(toy.id);
    const kidId = typeof req.query.kidId === 'string' ? req.query.kidId : undefined;
    if (req.user && kidId) {
      const kid = await prisma.kidProfile.findFirst({ where: { id: kidId, userId: req.user.id } });
      if (kid) await prisma.interaction.create({ data: { userId: req.user.id, kidId, toyId: toy.id, type: 'VIEW' } });
    }
    res.json({
      ...toyCard({ ...toy, availableUnits, creditCost: toy.sizeClass === 'LARGE' ? 2 : 1 }, baseUrl(req)),
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
