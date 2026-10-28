import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { DURATIONS, TIERS, allowedCycles, binQr, quotePrice, sizeClassFor, unitQr } from '@rentaltoys/shared';
import { prisma } from '../src/lib/prisma';
import { storeQr } from '../src/lib/qr';
import { pickCost } from '../src/routes/admin';
import { createUnit, moveUnit, slotSuggestions } from '../src/services/inventory';
import { SEED_TOYS, imageFor } from './seed-data';

export async function resetDatabase() {
  // Children before parents.
  await prisma.interaction.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.planPrice.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.planTier.deleteMany();
  await prisma.planDuration.deleteMany();
  await prisma.stageMovement.deleteMany();
  await prisma.toyPiece.deleteMany();
  await prisma.toyUnit.deleteMany();
  await prisma.toy.deleteMany();
  await prisma.bin.deleteMany();
  await prisma.shelf.deleteMany();
  await prisma.rack.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.qrImage.deleteMany();
  await prisma.kidProfile.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedPlans() {
  for (const t of Object.values(TIERS)) await prisma.planTier.create({ data: t });
  for (const d of Object.values(DURATIONS)) {
    const { billingCycles: _cycles, ...rest } = d;
    await prisma.planDuration.create({ data: rest });
  }
  for (const t of Object.values(TIERS)) {
    for (const d of Object.values(DURATIONS)) {
      await prisma.plan.create({
        data: {
          tierCode: t.code,
          durationCode: d.code,
          prices: {
            create: allowedCycles(d).map((c) => {
              const q = quotePrice(t, d, c);
              return { billingCycle: c, instalmentCount: q.instalmentCount, instalmentAmount: q.instalmentAmount, totalAmount: q.totalAmount };
            }),
          },
        },
      });
    }
  }
}

interface RackSpec {
  code: string;
  levels: number;
  binsPerShelf: number;
  bin: { lengthCm: number; breadthCm: number; heightCm: number; maxWeightKg: number };
}

/** Fast zone near dispatch, medium in the middle, slow at the back; each has small bins and floor bays for large toys. */
export async function seedWarehouse() {
  const zones: { code: string; name: string; type: 'FAST' | 'MEDIUM' | 'SLOW'; distanceToDispatchM: number; racks: RackSpec[] }[] = [
    {
      code: 'Z-FAST', name: 'Fast movers (near dispatch)', type: 'FAST', distanceToDispatchM: 5,
      racks: [
        { code: 'F1', levels: 4, binsPerShelf: 4, bin: { lengthCm: 50, breadthCm: 40, heightCm: 35, maxWeightKg: 15 } },
        { code: 'FB', levels: 1, binsPerShelf: 2, bin: { lengthCm: 150, breadthCm: 80, heightCm: 100, maxWeightKg: 60 } },
      ],
    },
    {
      code: 'Z-MED', name: 'Regular movers', type: 'MEDIUM', distanceToDispatchM: 20,
      racks: [
        { code: 'M1', levels: 4, binsPerShelf: 4, bin: { lengthCm: 60, breadthCm: 45, heightCm: 40, maxWeightKg: 20 } },
        { code: 'MB', levels: 1, binsPerShelf: 2, bin: { lengthCm: 150, breadthCm: 80, heightCm: 120, maxWeightKg: 60 } },
      ],
    },
    {
      code: 'Z-SLOW', name: 'Slow movers (back)', type: 'SLOW', distanceToDispatchM: 40,
      racks: [
        { code: 'S1', levels: 3, binsPerShelf: 4, bin: { lengthCm: 60, breadthCm: 45, heightCm: 40, maxWeightKg: 20 } },
        { code: 'SB', levels: 1, binsPerShelf: 2, bin: { lengthCm: 160, breadthCm: 90, heightCm: 120, maxWeightKg: 80 } },
      ],
    },
  ];
  for (const z of zones) {
    const zone = await prisma.zone.create({ data: { code: z.code, name: z.name, type: z.type, distanceToDispatchM: z.distanceToDispatchM } });
    for (const r of z.racks) {
      const rack = await prisma.rack.create({ data: { zoneId: zone.id, code: r.code } });
      for (let level = 1; level <= r.levels; level++) {
        const shelf = await prisma.shelf.create({ data: { rackId: rack.id, level } });
        for (let n = 1; n <= r.binsPerShelf; n++) {
          const code = `${r.code}-L${level}-B${n}`;
          const qrImageId = await prisma.$transaction((tx) => storeQr(tx, binQr(code)));
          await prisma.bin.create({
            data: { shelfId: shelf.id, code, ...r.bin, pickCost: pickCost(z.distanceToDispatchM, level, r.levels), qrPayload: binQr(code), qrImageId },
          });
        }
      }
    }
  }
}

export async function seedUsers() {
  const hash = (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.create({
    data: { name: 'Admin', email: 'admin@rentaltoys.in', phone: '9000000001', role: 'ADMIN', passwordHash: await hash('Admin@1234') },
  });
  await prisma.user.create({
    data: { name: 'Warehouse Staff', email: 'staff@rentaltoys.in', phone: '9000000002', role: 'STAFF', passwordHash: await hash('Staff@1234') },
  });
  const fourYearsAgo = new Date();
  fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
  await prisma.user.create({
    data: {
      name: 'Priya Raman',
      email: 'parent@example.com',
      phone: '9840000000',
      passwordHash: await hash('Parent@1234'),
      addressLine: '12, 3rd Main Road',
      area: 'Adyar',
      pincode: '600020',
      kids: { create: { name: 'Aadhya', dateOfBirth: fourYearsAgo, interests: ['WOODEN', 'EDUCATIONAL_STEM', 'PUZZLES'] } },
    },
  });
  return admin;
}

/** Each unit goes through the same scan flow staff use: procure → sanitise → store in the top suggested bin. */
export async function seedInventory(adminId: string) {
  for (const s of SEED_TOYS) {
    const dims = { lengthCm: s.dims[0], breadthCm: s.dims[1], heightCm: s.dims[2] };
    const toy = await prisma.toy.create({
      data: {
        sku: s.sku, name: s.name, brand: s.brand, description: s.description, images: imageFor(s.sku), color: s.color,
        ...dims, weightKg: s.weightKg, manufacturingDate: new Date(s.mfg), ageMinMonths: s.age[0], ageMaxMonths: s.age[1],
        material: s.material, powerType: s.powerType, batteryType: s.battery?.[0], batteryCount: s.battery?.[1],
        pieceType: s.pieceType, pieceCount: s.pieceCount, interestTags: s.interests, tags: s.tags,
        sizeClass: sizeClassFor(dims, s.weightKg), mrp: s.mrp, rentalCount: s.rentals,
      },
    });
    for (let i = 0; i < s.units; i++) {
      const unit = await createUnit({ toyId: toy.id, vendor: 'Seed Distributors, Parrys', procurementDate: new Date(), cost: Math.round(s.mrp * 0.6) }, adminId);
      const payload = unitQr(unit.id);
      const pieceScans = unit.pieces.map((p) => p.qrPayload);
      await moveUnit({ unitId: unit.id, expectedFromStage: 'PROCUREMENT', toStage: 'SANITATION', scannedPayload: payload, pieceScans, userId: adminId });
      const { suggestions } = await slotSuggestions(unit.id);
      if (!suggestions.length) throw new Error(`No bin fits ${s.name}`);
      await moveUnit({
        unitId: unit.id, expectedFromStage: 'SANITATION', toStage: 'STORAGE', scannedPayload: payload, pieceScans,
        toBinCode: suggestions[0].binCode, userId: adminId,
      });
    }
  }
}

async function main() {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
  const units = await prisma.toyUnit.count();
  console.log(`Seeded 9 plans, ${SEED_TOYS.length} toys, ${units} units.`);
  console.log('Logins: admin@rentaltoys.in / Admin@1234, staff@rentaltoys.in / Staff@1234, parent@example.com / Parent@1234');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
