import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { unitQr } from '@rentaltoys/shared';
import { resetDatabase, seedInventory, seedPlans, seedUsers, seedWarehouse } from '../prisma/seed';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
let adminToken = '';
let customerToken = '';
let kidId = '';

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function login(loginId: string, password: string) {
  const res = await request(app).post('/auth/login').send({ login: loginId, password }).expect(200);
  return res.body.token as string;
}

async function newCustomer(email: string, phone: string, interests: string[]) {
  const dob = new Date();
  dob.setFullYear(dob.getFullYear() - 6);
  const res = await request(app)
    .post('/auth/signup')
    .send({ name: 'Test Parent', email, phone, password: 'Secret@123', pincode: '600041', kids: [{ name: 'Kiddo', dateOfBirth: dob, interests }] })
    .expect(201);
  return { token: res.body.token as string, kidId: res.body.user.kids[0].id as string };
}

beforeAll(async () => {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
  adminToken = await login('admin@rentaltoys.in', 'Admin@1234');
  ({ token: customerToken, kidId } = await newCustomer('test@example.com', '9876543210', ['ELECTRIC', 'EDUCATIONAL_STEM']));
}, 120_000);

describe('auth and roles', () => {
  it('rejects duplicate signup and wrong password', async () => {
    await request(app)
      .post('/auth/signup')
      .send({ name: 'Dup', email: 'test@example.com', phone: '9876500000', password: 'Secret@123', kids: [{ name: 'K', dateOfBirth: '2022-01-01' }] })
      .expect(409);
    await request(app).post('/auth/login').send({ login: 'test@example.com', password: 'nope' }).expect(401);
  });

  it('keeps customers out of admin routes', async () => {
    await request(app).get('/admin/summary').set(auth(customerToken)).expect(403);
    await request(app).get('/admin/summary').expect(401);
  });
});

describe('personalised catalog', () => {
  it('shows interest-matched toys first for the kid', async () => {
    const res = await request(app).get(`/catalog?kidId=${kidId}`).set(auth(customerToken)).expect(200);
    const top = res.body.items.slice(0, 3);
    for (const t of top) expect(t.powerType === 'ELECTRIC' || t.interestTags.includes('EDUCATIONAL_STEM')).toBe(true);
    expect(top[0].reasons.join(' ')).toMatch(/Matches/);
  });

  it('returns home sections', async () => {
    const res = await request(app).get(`/catalog/for-you?kidId=${kidId}`).set(auth(customerToken)).expect(200);
    expect(res.body.sections.map((s: { key: string }) => s.key)).toEqual(['picked', 'popular', 'new']);
  });

  it('hides toys with no units in STORAGE', async () => {
    const toy = await request(app)
      .post('/admin/toys')
      .set(auth(adminToken))
      .send({
        sku: 'TEST-NEW', name: 'Fresh Arrival', colorType: 'SINGLE', primaryColor: 'RED', lengthCm: 10, breadthCm: 10, heightCm: 10, weightKg: 0.3,
        manufacturingDate: '2026-01-01', ageMinMonths: 12, ageMaxMonths: 48, material: 'PLASTIC', powerType: 'NON_ELECTRIC',
        pieceType: 'SINGLE', pieceCount: 1, mrp: 300,
      })
      .expect(201);
    await request(app).post('/admin/units').set(auth(adminToken)).send({ toyId: toy.body.id, cost: 200 }).expect(201);
    const res = await request(app).get('/catalog?pageSize=50').expect(200);
    expect(res.body.items.find((t: { id: string }) => t.id === toy.body.id)).toBeUndefined();
  });

  it('validates toy micro-details', async () => {
    const res = await request(app)
      .post('/admin/toys')
      .set(auth(adminToken))
      .send({
        sku: 'BAD', name: 'Bad toy', colorType: 'SINGLE', primaryColor: 'RED', lengthCm: 10, breadthCm: 10, heightCm: 10, weightKg: 0.3, manufacturingDate: '2026-01-01',
        ageMinMonths: 12, ageMaxMonths: 48, material: 'PLASTIC', powerType: 'ELECTRIC', pieceType: 'MULTI', pieceCount: 1, mrp: 300,
      })
      .expect(400);
    expect(JSON.stringify(res.body.details)).toMatch(/battery|piece/i);
  });
});

describe('plans and billing cycles', () => {
  it('lists 9 plans with the agreed billing cycles', async () => {
    const res = await request(app).get('/plans').expect(200);
    expect(res.body.plans).toHaveLength(9);
    const cycles = (tier: string, dur: string) =>
      res.body.plans.find((p: { tierCode: string; durationCode: string }) => p.tierCode === tier && p.durationCode === dur).prices.map((x: { billingCycle: string }) => x.billingCycle).sort();
    expect(cycles('BASIC', 'MONTHLY')).toEqual(['MONTHLY']);
    expect(cycles('PRO', 'QUARTERLY')).toEqual(['MONTHLY', 'QUARTERLY']);
    expect(cycles('ULTRA', 'YEARLY')).toEqual(['MONTHLY', 'QUARTERLY', 'YEARLY']);
  });

  it('creates instalments per billing cycle and rejects disallowed cycles', async () => {
    const plans = (await request(app).get('/plans')).body.plans as { id: string; tierCode: string; durationCode: string }[];
    const yearlyPro = plans.find((p) => p.tierCode === 'PRO' && p.durationCode === 'YEARLY')!;
    const quarterlyPro = plans.find((p) => p.tierCode === 'PRO' && p.durationCode === 'QUARTERLY')!;
    const other = await newCustomer('other@example.com', '9876500001', []);
    await request(app).post('/subscriptions').set(auth(other.token)).send({ planId: quarterlyPro.id, billingCycle: 'YEARLY' }).expect(400);
    const res = await request(app).post('/subscriptions').set(auth(other.token)).send({ planId: yearlyPro.id, billingCycle: 'QUARTERLY' }).expect(201);
    expect(res.body.invoices).toHaveLength(4);
  });
});

describe('subscription → order → scan-driven lifecycle', () => {
  let subId = '';
  let orderId = '';
  let unitId = '';
  let pieceScans: string[] = [];

  it('activates a subscription once the first instalment is marked paid', async () => {
    const plans = (await request(app).get('/plans')).body.plans as { id: string; tierCode: string; durationCode: string }[];
    const plan = plans.find((p) => p.tierCode === 'PRO' && p.durationCode === 'QUARTERLY')!;
    const sub = await request(app).post('/subscriptions').set(auth(customerToken)).send({ planId: plan.id, billingCycle: 'MONTHLY' }).expect(201);
    subId = sub.body.id;
    expect(sub.body.invoices).toHaveLength(3);
    await request(app).post('/orders').set(auth(customerToken)).send({ type: 'DELIVERY', toyIds: ['x'], scheduledDate: new Date() }).expect(400);
    await request(app).post(`/admin/invoices/${sub.body.invoices[0].id}/mark-paid`).set(auth(adminToken)).send({ paymentRef: 'UPI-123' }).expect(200);
    const current = await request(app).get('/subscriptions/current').set(auth(customerToken)).expect(200);
    expect(current.body.status).toBe('ACTIVE');
    expect(current.body.remaining).toEqual({ swaps: 2, deliveries: 2, credits: 3 });
  });

  it('enforces toy credits (large toy = 2)', async () => {
    const kitchen = await prisma.toy.findUniqueOrThrow({ where: { sku: 'WD-KITCH-04' } });
    const jeep = await prisma.toy.findUniqueOrThrow({ where: { sku: 'PL-RIDEON-14' } });
    const res = await request(app)
      .post('/orders')
      .set(auth(customerToken))
      .send({ type: 'DELIVERY', kidId, toyIds: [kitchen.id, jeep.id], scheduledDate: new Date() })
      .expect(400);
    expect(res.body.error).toMatch(/credits/);
  });

  it('reserves a STORAGE unit for a delivery order', async () => {
    const robot = await prisma.toy.findUniqueOrThrow({ where: { sku: 'PL-ROBOT-07' } });
    const before = (await request(app).get(`/catalog/${robot.id}`)).body.availableUnits;
    const res = await request(app).post('/orders').set(auth(customerToken)).send({ type: 'DELIVERY', kidId, toyIds: [robot.id], scheduledDate: new Date() }).expect(201);
    orderId = res.body.id;
    unitId = res.body.items[0].unitId;
    expect((await request(app).get(`/catalog/${robot.id}`)).body.availableUnits).toBe(before - 1);
    const unit = await prisma.toyUnit.findUniqueOrThrow({ where: { id: unitId }, include: { pieces: true } });
    expect(unit.reservedForOrderId).toBe(orderId);
    expect(unit.pieces).toHaveLength(4);
    pieceScans = unit.pieces.map((p) => p.qrPayload);
  });

  it('stores QR images in the backend and prints a label per piece', async () => {
    const unit = await prisma.toyUnit.findUniqueOrThrow({ where: { id: unitId } });
    const png = await request(app).get(`/qr/${unit.qrImageId}.png`).expect(200);
    expect(png.headers['content-type']).toBe('image/png');
    const labels = await request(app).get(`/admin/units/${unitId}/labels`).set(auth(adminToken)).expect(200);
    expect(labels.text.match(/<img src="data:image\/png/g)).toHaveLength(5);
  });

  it('shows the current stage and next stages on scan', async () => {
    const res = await request(app).get(`/admin/scan/${encodeURIComponent(pieceScans[2])}`).set(auth(adminToken)).expect(200);
    expect(res.body.currentStage).toBe('STORAGE');
    expect(res.body.pieceNo).toBe(3);
    expect(res.body.nextStages.map((s: { stage: string }) => s.stage)).toEqual(['IN_TRANSIT', 'SANITATION', 'DAMAGE']);
  });

  it('needs every piece scanned to dispatch, then records before/after', async () => {
    const base = { expectedFromStage: 'STORAGE', toStage: 'IN_TRANSIT', scannedPayload: unitQr(unitId), orderId };
    const missing = await request(app).post(`/admin/units/${unitId}/move`).set(auth(adminToken)).send({ ...base, pieceScans: pieceScans.slice(0, 3) }).expect(400);
    expect(missing.body.details.missingPieceNos).toEqual([4]);

    const unit = await prisma.toyUnit.findUniqueOrThrow({ where: { id: unitId } });
    const ok = await request(app).post(`/admin/units/${unitId}/move`).set(auth(adminToken)).send({ ...base, pieceScans }).expect(200);
    expect([ok.body.before, ok.body.after]).toEqual(['STORAGE', 'IN_TRANSIT']);
    const after = await prisma.toyUnit.findUniqueOrThrow({ where: { id: unitId } });
    expect(after.binId).toBeNull();
    const bin = await prisma.bin.findUniqueOrThrow({ where: { id: unit.binId! } });
    expect(bin.usedVolumeCm3).toBeGreaterThanOrEqual(0);

    // Same scan again from a stale screen.
    await request(app).post(`/admin/units/${unitId}/move`).set(auth(adminToken)).send({ ...base, pieceScans }).expect(409);
  });

  it('delivers, counts the rental and shows the toy at home', async () => {
    const toy = await prisma.toyUnit.findUniqueOrThrow({ where: { id: unitId }, include: { toy: true } });
    await request(app)
      .post(`/admin/units/${unitId}/move`)
      .set(auth(adminToken))
      .send({ expectedFromStage: 'IN_TRANSIT', toStage: 'WITH_CUSTOMER', scannedPayload: unitQr(unitId) })
      .expect(200);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('DELIVERED');
    expect((await prisma.toy.findUniqueOrThrow({ where: { id: toy.toyId } })).rentalCount).toBe(toy.toy.rentalCount + 1);
    const current = await request(app).get('/subscriptions/current').set(auth(customerToken)).expect(200);
    expect(current.body.toysAtHome.map((t: { unitId: string }) => t.unitId)).toEqual([unitId]);
  });

  it('swaps, and a return with missing pieces can only go to DAMAGE and is charged', async () => {
    const abacus = await prisma.toy.findUniqueOrThrow({ where: { sku: 'WD-ABACUS-01' } });
    await request(app)
      .post('/orders')
      .set(auth(customerToken))
      .send({ type: 'SWAP', kidId, toyIds: [abacus.id], returnUnitIds: [unitId], scheduledDate: new Date() })
      .expect(201);
    // Can't return the same toy twice.
    await request(app)
      .post('/orders')
      .set(auth(customerToken))
      .send({ type: 'SWAP', kidId, toyIds: [abacus.id], returnUnitIds: [unitId], scheduledDate: new Date() })
      .expect(400);

    const scan = (body: object) => request(app).post(`/admin/units/${unitId}/move`).set(auth(adminToken)).send({ scannedPayload: unitQr(unitId), ...body });
    await scan({ expectedFromStage: 'WITH_CUSTOMER', toStage: 'IN_TRANSIT' }).expect(200);
    await scan({ expectedFromStage: 'IN_TRANSIT', toStage: 'SANITATION', pieceScans: pieceScans.slice(0, 2) }).expect(400);
    await scan({ expectedFromStage: 'IN_TRANSIT', toStage: 'DAMAGE', pieceScans: pieceScans.slice(0, 2), reason: '2 pieces missing' }).expect(200);

    const sub = await prisma.subscription.findUniqueOrThrow({ where: { id: subId } });
    expect(sub.missingPieceCharges).toBe(2);
    const pieces = await prisma.toyPiece.findMany({ where: { unitId, status: 'MISSING' } });
    expect(pieces.map((p) => p.pieceNo).sort()).toEqual([3, 4]);

    const history = await request(app).get(`/admin/units/${unitId}`).set(auth(adminToken)).expect(200);
    expect(history.body.movements.map((m: { fromStage: string; toStage: string }) => `${m.fromStage}>${m.toStage}`)).toEqual([
      'IN_TRANSIT>DAMAGE',
      'WITH_CUSTOMER>IN_TRANSIT',
      'IN_TRANSIT>WITH_CUSTOMER',
      'STORAGE>IN_TRANSIT',
      'SANITATION>STORAGE',
      'PROCUREMENT>SANITATION',
      'null>PROCUREMENT',
    ]);
  });

  it('rejects transitions outside the lifecycle', async () => {
    const fresh = await prisma.toyUnit.findFirstOrThrow({ where: { stage: 'PROCUREMENT' } });
    await request(app)
      .post(`/admin/units/${fresh.id}/move`)
      .set(auth(adminToken))
      .send({ expectedFromStage: 'PROCUREMENT', toStage: 'WITH_CUSTOMER', scannedPayload: unitQr(fresh.id) })
      .expect(400);
    // Scanning another toy's label cannot move this one.
    await request(app)
      .post(`/admin/units/${fresh.id}/move`)
      .set(auth(adminToken))
      .send({ expectedFromStage: 'PROCUREMENT', toStage: 'SANITATION', scannedPayload: unitQr(unitId) })
      .expect(400);
  });

  it('suggests bins and stores a unit into a scanned bin', async () => {
    const fresh = await prisma.toyUnit.findFirstOrThrow({ where: { stage: 'PROCUREMENT' } });
    const sug = await request(app).get(`/admin/units/${fresh.id}/slot-suggestions`).set(auth(adminToken)).expect(200);
    expect(sug.body.suggestions.length).toBeGreaterThan(0);
    await request(app)
      .post(`/admin/units/${fresh.id}/move`)
      .set(auth(adminToken))
      .send({ expectedFromStage: 'PROCUREMENT', toStage: 'STORAGE', scannedPayload: unitQr(fresh.id), toBinCode: sug.body.suggestions[0].binCode })
      .expect(200);
    const res = await request(app).get('/catalog?pageSize=50').expect(200);
    expect(res.body.items.find((t: { id: string }) => t.id === fresh.toyId)).toBeDefined();
  });
});
