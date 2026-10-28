import { beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase } from '../prisma/seed';
import { seedBase } from '../prisma/seed-base';
import { prisma } from '../src/lib/prisma';

const env = { ADMIN_EMAIL: 'Owner@RentalToys.in', ADMIN_PHONE: '9000000099', ADMIN_PASSWORD: 'VeryStrong#2026' };

describe('production base seed', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  it('creates plans, warehouse and one admin, and is safe to re-run', async () => {
    await seedBase(env);
    const price = await prisma.planPrice.findFirstOrThrow();
    await prisma.planPrice.update({ where: { id: price.id }, data: { totalAmount: 1 } });

    await seedBase(env);
    expect(await prisma.plan.count()).toBe(9);
    expect(await prisma.planPrice.count()).toBe(18);
    expect(await prisma.zone.count()).toBe(3);
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(await prisma.toy.count()).toBe(0);
    // Admin edits to prices survive a re-run.
    expect((await prisma.planPrice.findUniqueOrThrow({ where: { id: price.id } })).totalAmount).toBe(1);
  });

  it('requires admin credentials', async () => {
    await expect(seedBase({})).rejects.toThrow(/ADMIN_EMAIL/);
  });
});
