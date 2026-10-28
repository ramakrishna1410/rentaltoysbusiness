import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import {
  INTERESTS,
  MATERIALS,
  PIECE_TYPES,
  POWER_TYPES,
  STAGE_LABELS,
  SUBSCRIPTION_STATUSES,
  TOY_STAGES,
  ZONE_TYPES,
  binQr,
  sizeClassFor,
} from '@rentaltoys/shared';
import { requireAdmin, requireStaff } from '../lib/auth';
import { HttpError, parse, wrap } from '../lib/http';
import { prisma } from '../lib/prisma';
import { MAX_PHOTOS_PER_TOY, MAX_PHOTO_BYTES, baseUrl, detectImage, photoIdsInclude, photoUrls } from '../lib/images';
import { storeQr } from '../lib/qr';
import { createUnit, getUnit, inventorySummary, moveUnit, reslotReport, resolveScan, slotSuggestions } from '../services/inventory';
import { subscriptionInclude } from '../services/subscriptions';

export const adminRouter = Router();
adminRouter.use(requireStaff);

// ---------- Toys (catalog SKUs with micro-level details) ----------

const toySchema = z
  .object({
    sku: z.string().min(2),
    name: z.string().min(2),
    brand: z.string().optional(),
    description: z.string().default(''),
    images: z.array(z.string().url()).default([]),
    color: z.string().min(1),
    lengthCm: z.number().positive(),
    breadthCm: z.number().positive(),
    heightCm: z.number().positive(),
    weightKg: z.number().positive(),
    manufacturingDate: z.coerce.date(),
    ageMinMonths: z.number().int().min(0),
    ageMaxMonths: z.number().int().min(1),
    material: z.enum(MATERIALS),
    powerType: z.enum(POWER_TYPES),
    batteryType: z.string().optional(),
    batteryCount: z.number().int().min(0).optional(),
    pieceType: z.enum(PIECE_TYPES),
    pieceCount: z.number().int().min(1).default(1),
    interestTags: z.array(z.enum(INTERESTS)).default([]),
    tags: z.array(z.string()).default([]),
    mrp: z.number().int().min(0),
    isActive: z.boolean().default(true),
  })
  .refine((t) => t.ageMaxMonths > t.ageMinMonths, { message: 'Max age must be above min age', path: ['ageMaxMonths'] })
  .refine((t) => (t.pieceType === 'SINGLE' ? t.pieceCount === 1 : t.pieceCount > 1), {
    message: 'Single-piece toys have 1 piece; multi-piece toys have more than 1',
    path: ['pieceCount'],
  })
  .refine((t) => t.powerType === 'NON_ELECTRIC' || !!t.batteryType, { message: 'Electric toys need a battery type', path: ['batteryType'] });

adminRouter.get(
  '/toys',
  wrap(async (req, res) => {
    const toys = await prisma.toy.findMany({
      orderBy: { name: 'asc' },
      include: { units: { select: { stage: true } }, photos: photoIdsInclude },
    });
    const base = baseUrl(req);
    res.json(
      toys.map(({ units, photos, ...t }) => ({
        ...t,
        images: photoUrls(base, { images: t.images, photos }),
        unitsByStage: units.reduce<Record<string, number>>((acc, u) => ({ ...acc, [u.stage]: (acc[u.stage] ?? 0) + 1 }), {}),
      })),
    );
  }),
);

adminRouter.get(
  '/toys/:id',
  wrap(async (req, res) => {
    const toy = await prisma.toy.findUnique({
      where: { id: req.params.id },
      include: { units: { include: { bin: true }, orderBy: { createdAt: 'desc' } }, photos: photoIdsInclude },
    });
    if (!toy) throw new HttpError(404, 'Toy not found');
    const base = baseUrl(req);
    const { photos, ...rest } = toy;
    res.json({ ...rest, images: photoUrls(base, toy), photos: photos.map((p) => ({ id: p.id, url: `${base}/images/${p.id}` })) });
  }),
);

// ---------- Toy photos (stored in Postgres, served from GET /images/:id) ----------

adminRouter.post(
  '/toys/:id/photos',
  wrap(async (req, res) => {
    const body = parse(
      z.object({ data: z.string().min(1), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() }),
      req.body,
    );
    const toy = await prisma.toy.findUnique({ where: { id: req.params.id }, include: { _count: { select: { photos: true } } } });
    if (!toy) throw new HttpError(404, 'Toy not found');
    if (toy._count.photos >= MAX_PHOTOS_PER_TOY) throw new HttpError(400, `A toy can have at most ${MAX_PHOTOS_PER_TOY} photos`);
    const buf = Buffer.from(body.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buf.length > MAX_PHOTO_BYTES) throw new HttpError(400, 'Photo is larger than 3 MB');
    const mimeType = detectImage(buf);
    if (!mimeType) throw new HttpError(400, 'Only JPEG, PNG or WebP photos are allowed');
    const last = await prisma.toyImage.findFirst({ where: { toyId: toy.id }, orderBy: { sortOrder: 'desc' } });
    const photo = await prisma.toyImage.create({
      data: { toyId: toy.id, data: new Uint8Array(buf), mimeType, width: body.width, height: body.height, sortOrder: (last?.sortOrder ?? -1) + 1 },
      select: { id: true, sortOrder: true },
    });
    res.status(201).json({ ...photo, url: `${baseUrl(req)}/images/${photo.id}` });
  }),
);

adminRouter.delete(
  '/toys/:id/photos/:photoId',
  wrap(async (req, res) => {
    const deleted = await prisma.toyImage.deleteMany({ where: { id: req.params.photoId, toyId: req.params.id } });
    if (deleted.count === 0) throw new HttpError(404, 'Photo not found');
    res.status(204).end();
  }),
);

/** Reorders photos; the first id becomes the cover shown in the catalog. */
adminRouter.put(
  '/toys/:id/photos/order',
  wrap(async (req, res) => {
    const { photoIds } = parse(z.object({ photoIds: z.array(z.string()).min(1) }), req.body);
    const existing = await prisma.toyImage.findMany({ where: { toyId: req.params.id }, select: { id: true } });
    const ids = new Set(existing.map((p) => p.id));
    if (photoIds.length !== ids.size || !photoIds.every((id) => ids.has(id))) {
      throw new HttpError(400, 'Send every photo id of this toy exactly once');
    }
    await prisma.$transaction(photoIds.map((id, sortOrder) => prisma.toyImage.update({ where: { id }, data: { sortOrder } })));
    res.json({ ok: true });
  }),
);

adminRouter.post(
  '/toys',
  wrap(async (req, res) => {
    const body = parse(toySchema, req.body);
    const toy = await prisma.toy.create({ data: { ...body, sizeClass: sizeClassFor(body, body.weightKg) } });
    res.status(201).json(toy);
  }),
);

adminRouter.patch(
  '/toys/:id',
  wrap(async (req, res) => {
    const existing = await prisma.toy.findUnique({ where: { id: req.params.id }, include: { _count: { select: { units: true } } } });
    if (!existing) throw new HttpError(404, 'Toy not found');
    const merged = parse(toySchema, { ...existing, brand: existing.brand ?? undefined, batteryType: existing.batteryType ?? undefined, batteryCount: existing.batteryCount ?? undefined, ...req.body });
    if (merged.pieceCount !== existing.pieceCount && existing._count.units > 0) {
      throw new HttpError(400, 'Piece count cannot change once units with piece QR labels exist');
    }
    res.json(await prisma.toy.update({ where: { id: existing.id }, data: { ...merged, sizeClass: sizeClassFor(merged, merged.weightKg) } }));
  }),
);

// ---------- Units, QR labels and scan-driven stage moves ----------

adminRouter.get(
  '/units',
  wrap(async (req, res) => {
    const q = parse(z.object({ stage: z.enum(TOY_STAGES).optional(), toyId: z.string().optional() }), req.query);
    res.json(
      await prisma.toyUnit.findMany({
        where: { stage: q.stage, toyId: q.toyId },
        include: { toy: { select: { name: true, sku: true, pieceCount: true } }, bin: { select: { code: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 200,
      }),
    );
  }),
);

adminRouter.post(
  '/units',
  wrap(async (req, res) => {
    const body = parse(
      z.object({
        toyId: z.string(),
        vendor: z.string().optional(),
        procurementDate: z.coerce.date().default(() => new Date()),
        cost: z.number().int().min(0),
        condition: z.enum(['NEW', 'GOOD', 'FAIR']).optional(),
        pieceLabels: z.array(z.string().min(1)).optional(),
        notes: z.string().optional(),
      }),
      req.body,
    );
    res.status(201).json(await createUnit(body, req.user!.id));
  }),
);

adminRouter.get(
  '/units/:id',
  wrap(async (req, res) => {
    const unit = await getUnit(req.params.id);
    const movements = await prisma.stageMovement.findMany({
      where: { unitId: unit.id },
      orderBy: { scannedAt: 'desc' },
      include: { scannedBy: { select: { name: true } } },
    });
    res.json({ ...unit, movements });
  }),
);

adminRouter.get(
  '/units/:id/slot-suggestions',
  wrap(async (req, res) => {
    res.json(await slotSuggestions(req.params.id));
  }),
);

adminRouter.get(
  '/scan/:payload',
  wrap(async (req, res) => {
    res.json(await resolveScan(decodeURIComponent(req.params.payload)));
  }),
);

adminRouter.post(
  '/units/:id/move',
  wrap(async (req, res) => {
    const body = parse(
      z.object({
        expectedFromStage: z.enum(TOY_STAGES),
        toStage: z.enum(TOY_STAGES),
        scannedPayload: z.string(),
        pieceScans: z.array(z.string()).default([]),
        toBinCode: z.string().optional(),
        orderId: z.string().optional(),
        reason: z.string().optional(),
      }),
      req.body,
    );
    res.json(await moveUnit({ ...body, unitId: req.params.id, userId: req.user!.id }));
  }),
);

/** Printable sheet: one label for the unit and one per piece, using the QR images stored in the backend. */
adminRouter.get(
  '/units/:id/labels',
  wrap(async (req, res) => {
    const unit = await getUnit(req.params.id);
    const ids = [unit.qrImageId, ...unit.pieces.map((p) => p.qrImageId)].filter((x): x is string => !!x);
    const images = new Map((await prisma.qrImage.findMany({ where: { id: { in: ids } } })).map((i) => [i.id, i]));
    const label = (qrImageId: string | null, title: string, sub: string) => {
      const img = qrImageId ? images.get(qrImageId) : undefined;
      const src = img ? `data:image/png;base64,${Buffer.from(img.png).toString('base64')}` : '';
      return `<div class="l"><img src="${src}"/><b>${escapeHtml(title)}</b><span>${escapeHtml(sub)}</span></div>`;
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Labels ${unit.toy.sku}</title>
<style>body{font-family:sans-serif;margin:8mm}.g{display:flex;flex-wrap:wrap;gap:4mm}.l{width:48mm;border:1px dashed #999;padding:2mm;display:flex;flex-direction:column;align-items:center;font-size:9pt;text-align:center}.l img{width:40mm;height:40mm}</style>
</head><body><div class="g">
${label(unit.qrImageId, unit.toy.name, `UNIT · ${unit.toy.sku} · ${unit.toy.pieceCount} pc`)}
${unit.toy.pieceCount > 1 ? unit.pieces.map((p) => label(p.qrImageId, p.label, `PIECE ${p.pieceNo}/${unit.toy.pieceCount} · ${unit.toy.sku}`)).join('\n') : ''}
</div></body></html>`;
    res.type('html').send(html);
  }),
);

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------- Warehouse ----------

adminRouter.get(
  '/warehouse',
  wrap(async (_req, res) => {
    res.json(
      await prisma.zone.findMany({
        orderBy: { distanceToDispatchM: 'asc' },
        include: {
          racks: {
            orderBy: { code: 'asc' },
            include: {
              shelves: {
                orderBy: { level: 'asc' },
                include: { bins: { orderBy: { code: 'asc' }, include: { _count: { select: { units: { where: { stage: 'STORAGE' } } } } } } },
              },
            },
          },
        },
      }),
    );
  }),
);

adminRouter.post(
  '/warehouse/zones',
  requireAdmin,
  wrap(async (req, res) => {
    const body = parse(z.object({ code: z.string(), name: z.string(), type: z.enum(ZONE_TYPES), distanceToDispatchM: z.number().int().min(0) }), req.body);
    res.status(201).json(await prisma.zone.create({ data: body }));
  }),
);

/** Adds a rack with `levels` shelves and identical bins per shelf. */
adminRouter.post(
  '/warehouse/racks',
  requireAdmin,
  wrap(async (req, res) => {
    const body = parse(
      z.object({
        zoneId: z.string(),
        code: z.string(),
        levels: z.number().int().min(1).max(10),
        binsPerShelf: z.number().int().min(1).max(20),
        bin: z.object({ lengthCm: z.number().positive(), breadthCm: z.number().positive(), heightCm: z.number().positive(), maxWeightKg: z.number().positive() }),
      }),
      req.body,
    );
    const zone = await prisma.zone.findUnique({ where: { id: body.zoneId } });
    if (!zone) throw new HttpError(404, 'Zone not found');
    const rack = await prisma.$transaction(async (tx) => {
      const rack = await tx.rack.create({ data: { zoneId: zone.id, code: body.code } });
      for (let level = 1; level <= body.levels; level++) {
        const shelf = await tx.shelf.create({ data: { rackId: rack.id, level } });
        for (let n = 1; n <= body.binsPerShelf; n++) {
          const code = `${body.code}-L${level}-B${n}`;
          await tx.bin.create({
            data: {
              shelfId: shelf.id,
              code,
              ...body.bin,
              pickCost: pickCost(zone.distanceToDispatchM, level, body.levels),
              qrPayload: binQr(code),
              qrImageId: await storeQr(tx, binQr(code)),
            },
          });
        }
      }
      return rack;
    });
    res.status(201).json(rack);
  }),
);

/** Walk distance plus a penalty for shelves above shoulder height or at floor level. */
export function pickCost(distanceM: number, level: number, levels: number): number {
  const reach = level === 1 ? 1.5 : level > Math.max(2, levels - 1) ? 2 : 0;
  return Math.round((distanceM / 5 + reach) * 10) / 10;
}

adminRouter.get('/warehouse/reslot', wrap(async (_req, res) => res.json(await reslotReport())));
adminRouter.get('/summary', wrap(async (_req, res) => res.json({ ...(await inventorySummary()), stageLabels: STAGE_LABELS })));

// ---------- Subscriptions, invoices, orders, plans ----------

adminRouter.get(
  '/subscriptions',
  wrap(async (req, res) => {
    const { status } = parse(z.object({ status: z.enum(SUBSCRIPTION_STATUSES).optional() }), req.query);
    res.json(
      await prisma.subscription.findMany({
        where: { status },
        include: { ...subscriptionInclude, user: { select: { name: true, phone: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }),
);

adminRouter.post(
  '/subscriptions/:id/:action(pause|resume|cancel)',
  requireAdmin,
  wrap(async (req, res) => {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id }, include: subscriptionInclude });
    if (!sub) throw new HttpError(404, 'Subscription not found');
    const action = req.params.action;
    if (action === 'pause') {
      if (sub.status !== 'ACTIVE') throw new HttpError(400, 'Only active subscriptions can be paused');
      if (sub.plan.duration.pauseDays === 0) throw new HttpError(400, 'This plan has no pause days');
      const until = new Date(Date.now() + sub.plan.duration.pauseDays * 86_400_000);
      res.json(await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAUSED', pausedUntil: until } }));
    } else if (action === 'resume') {
      if (sub.status !== 'PAUSED') throw new HttpError(400, 'Subscription is not paused');
      res.json(await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', pausedUntil: null } }));
    } else {
      res.json(await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'CANCELLED' } }));
    }
  }),
);

/** Payments are manual for now: marking the first instalment paid activates the subscription. */
adminRouter.post(
  '/invoices/:id/mark-paid',
  requireAdmin,
  wrap(async (req, res) => {
    const { paymentRef } = parse(z.object({ paymentRef: z.string().min(1) }), req.body);
    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id }, include: { subscription: true } });
    if (!invoice) throw new HttpError(404, 'Invoice not found');
    if (invoice.status === 'PAID') throw new HttpError(400, 'Invoice is already paid');
    const updated = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date(), paymentRef } });
      if (invoice.subscription.status === 'PENDING_PAYMENT') {
        await tx.subscription.update({ where: { id: invoice.subscriptionId }, data: { status: 'ACTIVE' } });
      }
      return inv;
    });
    res.json(updated);
  }),
);

adminRouter.get(
  '/orders',
  wrap(async (_req, res) => {
    res.json(
      await prisma.order.findMany({
        include: {
          items: { include: { toy: { select: { name: true, pieceCount: true } }, unit: { select: { id: true, stage: true, bin: { select: { code: true } } } } } },
          subscription: { include: { user: { select: { name: true, phone: true, addressLine: true, area: true, pincode: true } } } },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 200,
      }),
    );
  }),
);

adminRouter.patch(
  '/plan-prices/:id',
  requireAdmin,
  wrap(async (req, res) => {
    const body = parse(z.object({ instalmentAmount: z.number().int().positive(), totalAmount: z.number().int().positive() }), req.body);
    res.json(await prisma.planPrice.update({ where: { id: req.params.id }, data: body }));
  }),
);

adminRouter.post(
  '/staff',
  requireAdmin,
  wrap(async (req, res) => {
    const body = parse(
      z.object({ name: z.string(), email: z.string().email(), phone: z.string(), password: z.string().min(8), role: z.enum(['STAFF', 'ADMIN']) }),
      req.body,
    );
    const { password, ...rest } = body;
    const user = await prisma.user.create({ data: { ...rest, passwordHash: await bcrypt.hash(password, 10) }, select: { id: true, name: true, role: true } });
    res.status(201).json(user);
  }),
);
