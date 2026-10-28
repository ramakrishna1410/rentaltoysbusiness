import type { Prisma, Toy } from '@prisma/client';
import { ageInMonths, creditCost, recommend, type Interest, type RecToy } from '@rentaltoys/shared';
import { prisma } from '../lib/prisma';

export type CatalogToy = Toy & { availableUnits: number; creditCost: number };

/** Units a customer can actually get: in STORAGE and not already reserved for an order. */
export const availableUnitWhere = { stage: 'STORAGE', reservedForOrderId: null } satisfies Prisma.ToyUnitWhereInput;

export async function availableCatalog(where: Prisma.ToyWhereInput = {}): Promise<CatalogToy[]> {
  const toys = await prisma.toy.findMany({
    where: { isActive: true, ...where, units: { some: availableUnitWhere } },
    include: { _count: { select: { units: { where: availableUnitWhere } } } },
    orderBy: { name: 'asc' },
  });
  return toys.map(({ _count, ...toy }) => ({ ...toy, availableUnits: _count.units, creditCost: creditCost(toy.sizeClass) }));
}

export async function availableCount(toyId: string): Promise<number> {
  return prisma.toyUnit.count({ where: { toyId, ...availableUnitWhere } });
}

export async function rankForKid(kidId: string, toys: CatalogToy[], opts: { maxCredits?: number; limit?: number } = {}) {
  const kid = await prisma.kidProfile.findUniqueOrThrow({
    where: { id: kidId },
    include: { interactions: { where: { createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) } } } },
  });
  const ageMonths = ageInMonths(kid.dateOfBirth);
  const ranked = recommend<CatalogToy & RecToy>(
    {
      ageMonths,
      interests: kid.interests as Interest[],
      interactions: kid.interactions.map((i) => ({ toyId: i.toyId, type: i.type, value: i.value, createdAt: i.createdAt })),
    },
    toys as (CatalogToy & RecToy)[],
    opts,
  );
  return { kid, ageMonths, ranked };
}

export function toyCard(toy: CatalogToy, extra: { score?: number; reasons?: string[] } = {}) {
  return {
    id: toy.id,
    sku: toy.sku,
    name: toy.name,
    brand: toy.brand,
    images: toy.images,
    color: toy.color,
    ageMinMonths: toy.ageMinMonths,
    ageMaxMonths: toy.ageMaxMonths,
    material: toy.material,
    powerType: toy.powerType,
    pieceType: toy.pieceType,
    pieceCount: toy.pieceCount,
    interestTags: toy.interestTags,
    sizeClass: toy.sizeClass,
    creditCost: toy.creditCost,
    mrp: toy.mrp,
    availableUnits: toy.availableUnits,
    avgRating: toy.ratingCount ? Math.round((toy.ratingSum / toy.ratingCount) * 10) / 10 : null,
    ...extra,
  };
}
