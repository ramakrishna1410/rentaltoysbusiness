// Production seed: plans, warehouse layout and the first admin. Safe to run repeatedly;
// it only creates what is missing and never overwrites prices or passwords changed later.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { DURATIONS, TIERS, allowedCycles, quotePrice } from '@rentaltoys/shared';
import { isMain } from '../src/lib/is-main';
import { prisma } from '../src/lib/prisma';
import { seedWarehouse } from './seed';

export async function ensurePlans() {
  for (const t of Object.values(TIERS)) {
    await prisma.planTier.upsert({ where: { code: t.code }, create: t, update: {} });
  }
  for (const d of Object.values(DURATIONS)) {
    const { billingCycles: _cycles, ...rest } = d;
    await prisma.planDuration.upsert({ where: { code: d.code }, create: rest, update: {} });
  }
  for (const t of Object.values(TIERS)) {
    for (const d of Object.values(DURATIONS)) {
      const plan = await prisma.plan.upsert({
        where: { tierCode_durationCode: { tierCode: t.code, durationCode: d.code } },
        create: { tierCode: t.code, durationCode: d.code },
        update: {},
      });
      for (const c of allowedCycles(d)) {
        const q = quotePrice(t, d, c);
        await prisma.planPrice.upsert({
          where: { planId_billingCycle: { planId: plan.id, billingCycle: c } },
          create: { planId: plan.id, billingCycle: c, instalmentCount: q.instalmentCount, instalmentAmount: q.instalmentAmount, totalAmount: q.totalAmount },
          update: {},
        });
      }
    }
  }
}

export async function ensureWarehouse() {
  if ((await prisma.zone.count()) === 0) await seedWarehouse();
}

export async function ensureAdmin(env: NodeJS.ProcessEnv = process.env) {
  const { ADMIN_EMAIL: email, ADMIN_PHONE: phone, ADMIN_PASSWORD: password, ADMIN_NAME: name } = env;
  if (!email || !phone || !password) throw new Error('Set ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD to create the first admin');
  if (password.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
  const existing = await prisma.user.findFirst({ where: { OR: [{ email: email.toLowerCase() }, { phone }] } });
  if (existing) return existing;
  return prisma.user.create({
    data: { name: name ?? 'Admin', email: email.toLowerCase(), phone, role: 'ADMIN', passwordHash: await bcrypt.hash(password, 10) },
  });
}

export async function seedBase(env: NodeJS.ProcessEnv = process.env) {
  await ensurePlans();
  await ensureWarehouse();
  return ensureAdmin(env);
}

if (isMain(import.meta.url)) {
  seedBase()
    .then((admin) => console.log(`Base data ready. Admin: ${admin.email}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
