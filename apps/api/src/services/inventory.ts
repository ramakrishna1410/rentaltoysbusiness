import type { Prisma } from '@prisma/client';
import {
  ageBandFor,
  allowedNextStages,
  canPlace,
  checkMove,
  classifyVelocity,
  expectedZone,
  parseQr,
  pieceQr,
  requiresFullPieceScan,
  suggestBins,
  unitQr,
  volumeCm3,
  type SlotBin,
  type SlotItem,
  type ToyStage,
  type VelocityClass,
} from '@rentaltoys/shared';
import { HttpError } from '../lib/http';
import { prisma } from '../lib/prisma';
import { storeQr } from '../lib/qr';

const unitInclude = {
  toy: true,
  pieces: { orderBy: { pieceNo: 'asc' } },
  bin: { include: { shelf: { include: { rack: { include: { zone: true } } } } } },
} satisfies Prisma.ToyUnitInclude;

export type UnitWithDetails = Prisma.ToyUnitGetPayload<{ include: typeof unitInclude }>;

export async function getUnit(id: string): Promise<UnitWithDetails> {
  const unit = await prisma.toyUnit.findUnique({ where: { id }, include: unitInclude });
  if (!unit) throw new HttpError(404, 'Unit not found');
  return unit;
}

export interface CreateUnitInput {
  toyId: string;
  vendor?: string;
  procurementDate: Date;
  cost: number;
  condition?: 'NEW' | 'GOOD' | 'FAIR';
  pieceLabels?: string[];
  notes?: string;
}

/** Procures one physical unit: creates its QR plus one QR per piece, all stored in the backend. */
export async function createUnit(input: CreateUnitInput, userId: string) {
  const toy = await prisma.toy.findUnique({ where: { id: input.toyId } });
  if (!toy) throw new HttpError(404, 'Toy not found');
  const total = toy.pieceCount;
  if (input.pieceLabels && input.pieceLabels.length !== total) {
    throw new HttpError(400, `This toy has ${total} pieces; got ${input.pieceLabels.length} labels.`);
  }

  return prisma.$transaction(
    async (tx) => {
      const unit = await tx.toyUnit.create({
        data: {
          toyId: toy.id,
          vendor: input.vendor,
          procurementDate: input.procurementDate,
          cost: input.cost,
          condition: input.condition ?? 'NEW',
          notes: input.notes,
          // Placeholder; the real payload needs the generated id.
          qrPayload: `pending-${crypto.randomUUID()}`,
        },
      });
      const payload = unitQr(unit.id);
      const qrImageId = await storeQr(tx, payload);
      await tx.toyUnit.update({ where: { id: unit.id }, data: { qrPayload: payload, qrImageId } });

      for (let n = 1; n <= total; n++) {
        const p = pieceQr(unit.id, n, total);
        await tx.toyPiece.create({
          data: {
            unitId: unit.id,
            pieceNo: n,
            label: input.pieceLabels?.[n - 1] ?? (total === 1 ? toy.name : `${toy.name} – piece ${n} of ${total}`),
            qrPayload: p,
            qrImageId: await storeQr(tx, p),
          },
        });
      }
      await tx.stageMovement.create({
        data: { unitId: unit.id, fromStage: null, toStage: 'PROCUREMENT', scannedPayload: payload, scannedById: userId, reason: 'Procured' },
      });
      return tx.toyUnit.findUniqueOrThrow({ where: { id: unit.id }, include: unitInclude });
    },
    { timeout: 30_000 },
  );
}

async function velocityByToy(): Promise<Record<string, VelocityClass>> {
  const toys = await prisma.toy.findMany({ select: { id: true, rentalCount: true } });
  return classifyVelocity(Object.fromEntries(toys.map((t) => [t.id, t.rentalCount])));
}

async function slotBins(excludeUnitId?: string): Promise<SlotBin[]> {
  const bins = await prisma.bin.findMany({
    include: {
      shelf: { include: { rack: { include: { zone: true, shelves: { select: { level: true } } } } } },
      units: { where: { stage: 'STORAGE', id: excludeUnitId ? { not: excludeUnitId } : undefined }, include: { toy: true } },
    },
  });
  return bins.map((b) => ({
    id: b.id,
    code: b.code,
    lengthCm: b.lengthCm,
    breadthCm: b.breadthCm,
    heightCm: b.heightCm,
    maxWeightKg: b.maxWeightKg,
    usedVolumeCm3: b.usedVolumeCm3,
    usedWeightKg: b.usedWeightKg,
    shelfLevel: b.shelf.level,
    maxShelfLevel: Math.max(...b.shelf.rack.shelves.map((s) => s.level)),
    zoneType: b.shelf.rack.zone.type,
    pickCost: b.pickCost,
    toyIds: [...new Set(b.units.map((u) => u.toyId))],
    ageBands: [...new Set(b.units.map((u) => ageBandFor(u.toy.ageMinMonths, u.toy.ageMaxMonths)))],
  }));
}

function slotItem(unit: UnitWithDetails, velocity: VelocityClass): SlotItem {
  const t = unit.toy;
  return {
    toyId: t.id,
    lengthCm: t.lengthCm,
    breadthCm: t.breadthCm,
    heightCm: t.heightCm,
    weightKg: t.weightKg,
    velocity,
    ageBand: ageBandFor(t.ageMinMonths, t.ageMaxMonths),
  };
}

export async function slotSuggestions(unitId: string, limit = 3) {
  const unit = await getUnit(unitId);
  const velocity = (await velocityByToy())[unit.toyId] ?? 'B';
  const suggestions = suggestBins(slotItem(unit, velocity), await slotBins(unit.id), { limit });
  return { unitId, velocity, expectedZone: expectedZone(velocity), suggestions };
}

export async function resolveScan(payload: string) {
  const ref = parseQr(payload);
  if (!ref) throw new HttpError(400, 'Not a RentalToys QR code');
  if (ref.kind === 'BIN') {
    const bin = await prisma.bin.findUnique({
      where: { code: ref.binCode },
      include: { units: { where: { stage: 'STORAGE' }, include: { toy: true } }, shelf: { include: { rack: { include: { zone: true } } } } },
    });
    if (!bin) throw new HttpError(404, 'Bin not found');
    return { kind: 'BIN' as const, bin };
  }
  const unit = await getUnit(ref.unitId);
  const movements = await prisma.stageMovement.findMany({
    where: { unitId: unit.id },
    orderBy: { scannedAt: 'desc' },
    take: 10,
    include: { scannedBy: { select: { name: true } } },
  });
  const next = allowedNextStages(unit.stage).map((to) => ({
    stage: to,
    needsAllPieces: unit.toy.pieceCount > 0 && requiresFullPieceScan(unit.stage, to),
    needsBin: to === 'STORAGE',
    needsOrder: unit.stage === 'STORAGE' && to === 'IN_TRANSIT',
    needsReason: to === 'DAMAGE' || to === 'SCRAP',
  }));
  return {
    kind: ref.kind,
    pieceNo: ref.kind === 'PIECE' ? ref.pieceNo : undefined,
    unit,
    currentStage: unit.stage,
    nextStages: next,
    movements,
  };
}

export interface MoveInput {
  unitId: string;
  expectedFromStage: ToyStage;
  toStage: ToyStage;
  scannedPayload: string;
  pieceScans?: string[];
  toBinCode?: string;
  orderId?: string;
  reason?: string;
  userId: string;
}

function scannedPieceNos(unitId: string, scans: string[], pieceCount: number): number[] {
  const nos = new Set<number>();
  for (const s of scans) {
    const ref = parseQr(s);
    if (ref?.kind === 'PIECE' && ref.unitId === unitId) nos.add(ref.pieceNo);
    // A single-piece toy's unit label stands for its only piece.
    if (ref?.kind === 'UNIT' && ref.unitId === unitId && pieceCount === 1) nos.add(1);
  }
  return [...nos];
}

/** Scan-validated stage change. Records the stage before and after in StageMovement. */
export async function moveUnit(input: MoveInput) {
  const unit = await getUnit(input.unitId);
  const scanned = parseQr(input.scannedPayload);
  if (!scanned || scanned.kind === 'BIN' || scanned.unitId !== unit.id) {
    throw new HttpError(400, 'Scan this toy’s own QR label to move it.');
  }

  const pieceNos = scannedPieceNos(unit.id, [input.scannedPayload, ...(input.pieceScans ?? [])], unit.toy.pieceCount);
  const toBin = input.toBinCode ? await prisma.bin.findUnique({ where: { code: input.toBinCode } }) : null;
  if (input.toBinCode && !toBin) throw new HttpError(404, `Bin ${input.toBinCode} not found`);

  const check = checkMove({
    currentStage: unit.stage,
    expectedFromStage: input.expectedFromStage,
    toStage: input.toStage,
    pieceCount: unit.toy.pieceCount,
    scannedPieceNos: pieceNos,
    toBinId: toBin?.id,
    orderId: input.orderId,
    reservedForOrderId: unit.reservedForOrderId,
    reason: input.reason,
  });
  if (!check.ok) {
    const stale = unit.stage !== input.expectedFromStage;
    throw new HttpError(stale ? 409 : 400, check.errors[0], { errors: check.errors, missingPieceNos: check.missingPieceNos, currentStage: unit.stage });
  }

  const vol = volumeCm3(unit.toy);
  if (toBin) {
    const [slot] = (await slotBins(unit.id)).filter((b) => b.id === toBin.id);
    if (!slot || !canPlace(slotItem(unit, 'B'), slot)) throw new HttpError(400, `Toy does not fit in bin ${toBin.code}.`);
  }

  const from = unit.stage;
  const to = input.toStage;

  return prisma.$transaction(async (tx) => {
    // Optimistic lock: a concurrent scan that already moved the toy makes this update match nothing.
    const leavingStorage = from === 'STORAGE' && to !== 'STORAGE';
    const updated = await tx.toyUnit.updateMany({
      where: { id: unit.id, stage: from },
      data: {
        stage: to,
        binId: to === 'STORAGE' ? toBin!.id : leavingStorage ? null : unit.binId,
        reservedForOrderId: leavingStorage ? null : unit.reservedForOrderId,
      },
    });
    if (updated.count !== 1) throw new HttpError(409, 'Toy was moved by another scan. Rescan to refresh.');

    if (leavingStorage && unit.binId) {
      await tx.bin.update({
        where: { id: unit.binId },
        data: { usedVolumeCm3: { decrement: vol }, usedWeightKg: { decrement: unit.toy.weightKg } },
      });
    }
    if (to === 'STORAGE') {
      await tx.bin.update({
        where: { id: toBin!.id },
        data: { usedVolumeCm3: { increment: vol }, usedWeightKg: { increment: unit.toy.weightKg } },
      });
    }

    let orderId = input.orderId ?? null;
    if (from === 'STORAGE' && to === 'IN_TRANSIT') {
      await tx.order.update({ where: { id: orderId! }, data: { status: 'DISPATCHED' } });
    }
    if (from === 'IN_TRANSIT' && to === 'WITH_CUSTOMER') {
      const item = await tx.orderItem.findFirst({
        where: { unitId: unit.id, direction: 'OUT', order: { status: 'DISPATCHED' } },
        include: { order: { include: { subscription: true, items: { include: { unit: true } } } } },
        orderBy: { order: { createdAt: 'desc' } },
      });
      if (item) {
        orderId = item.orderId;
        await tx.toy.update({ where: { id: unit.toyId }, data: { rentalCount: { increment: 1 } } });
        await tx.interaction.create({
          data: { userId: item.order.subscription.userId, kidId: item.order.kidId, toyId: unit.toyId, type: 'RENT' },
        });
        const othersDelivered = item.order.items
          .filter((i) => i.direction === 'OUT' && i.unitId !== unit.id)
          .every((i) => i.unit?.stage === 'WITH_CUSTOMER');
        if (othersDelivered) await tx.order.update({ where: { id: item.orderId }, data: { status: 'DELIVERED' } });
      }
    }

    // Coming back from a customer with pieces missing: mark them and charge the subscription.
    if (from === 'IN_TRANSIT' && to === 'DAMAGE' && check.missingPieceNos.length) {
      await tx.toyPiece.updateMany({ where: { unitId: unit.id, pieceNo: { in: check.missingPieceNos } }, data: { status: 'MISSING' } });
      const lastOut = await tx.orderItem.findFirst({
        where: { unitId: unit.id, direction: 'OUT' },
        include: { order: true },
        orderBy: { order: { createdAt: 'desc' } },
      });
      const pickup = await tx.stageMovement.findFirst({ where: { unitId: unit.id }, orderBy: { scannedAt: 'desc' } });
      if (lastOut && pickup?.fromStage === 'WITH_CUSTOMER') {
        orderId = lastOut.orderId;
        await tx.subscription.update({
          where: { id: lastOut.order.subscriptionId },
          data: { missingPieceCharges: { increment: check.missingPieceNos.length } },
        });
      }
    }
    if (from === 'DAMAGE' && to === 'SANITATION') {
      await tx.toyPiece.updateMany({ where: { unitId: unit.id }, data: { status: 'PRESENT' } });
    }

    const movement = await tx.stageMovement.create({
      data: {
        unitId: unit.id,
        fromStage: from,
        toStage: to,
        scannedPayload: input.scannedPayload,
        scannedById: input.userId,
        fromBinId: unit.binId,
        toBinId: to === 'STORAGE' ? toBin!.id : null,
        orderId,
        pieceScan: { scanned: pieceNos, missing: check.missingPieceNos, total: unit.toy.pieceCount },
        reason: input.reason,
      },
    });
    return { movement, before: from, after: to, missingPieceNos: check.missingPieceNos };
  });
}

/** Units sitting in a zone that no longer matches how often they rent. */
export async function reslotReport() {
  const velocity = await velocityByToy();
  const units = await prisma.toyUnit.findMany({
    where: { stage: 'STORAGE', binId: { not: null } },
    include: { toy: true, bin: { include: { shelf: { include: { rack: { include: { zone: true } } } } } } },
  });
  return units
    .map((u) => {
      const v = velocity[u.toyId] ?? 'B';
      return { unitId: u.id, toy: u.toy.name, bin: u.bin!.code, zone: u.bin!.shelf.rack.zone.type, velocity: v, expectedZone: expectedZone(v) };
    })
    .filter((r) => r.zone !== r.expectedZone);
}

export async function inventorySummary() {
  const [byStage, bins] = await Promise.all([
    prisma.toyUnit.groupBy({ by: ['stage'], _count: true }),
    prisma.bin.findMany({ include: { shelf: { include: { rack: { include: { zone: true } } } } } }),
  ]);
  const zones = new Map<string, { zone: string; type: string; capacityCm3: number; usedCm3: number; bins: number }>();
  for (const b of bins) {
    const z = b.shelf.rack.zone;
    const row = zones.get(z.code) ?? { zone: z.code, type: z.type, capacityCm3: 0, usedCm3: 0, bins: 0 };
    row.capacityCm3 += volumeCm3(b) * 0.85;
    row.usedCm3 += b.usedVolumeCm3;
    row.bins += 1;
    zones.set(z.code, row);
  }
  return {
    byStage: Object.fromEntries(byStage.map((s) => [s.stage, s._count])),
    zones: [...zones.values()].map((z) => ({ ...z, utilisationPct: z.capacityCm3 ? Math.round((z.usedCm3 / z.capacityCm3) * 100) : 0 })),
  };
}
