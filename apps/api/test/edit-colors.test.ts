import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase, seedInventory, seedPlans, seedUsers, seedWarehouse } from '../prisma/seed';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let staff = '';

const base = {
  name: 'Test Car', lengthCm: 20, breadthCm: 10, heightCm: 10, weightKg: 0.5, manufacturingDate: '2026-01-01',
  ageMinMonths: 24, ageMaxMonths: 60, material: 'PLASTIC', powerType: 'NON_ELECTRIC', pieceType: 'SINGLE', pieceCount: 1, mrp: 500,
};

beforeAll(async () => {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
  staff = (await request(app).post('/auth/login').send({ login: 'staff@rentaltoys.in', password: 'Staff@1234' })).body.token;
}, 120_000);

const skus = (body: { items: { sku: string }[] }) => body.items.map((t) => t.sku).sort();

describe('structured toy colours', () => {
  it('derives the colour label and rejects inconsistent colours', async () => {
    const single = await request(app).post('/admin/toys').set(auth(staff)).send({ ...base, sku: 'c-single', colorType: 'SINGLE', primaryColor: 'RED' }).expect(201);
    expect(single.body).toMatchObject({ sku: 'C-SINGLE', color: 'Red' });
    const dual = await request(app).post('/admin/toys').set(auth(staff)).send({ ...base, sku: 'C-DUAL', colorType: 'DUAL', primaryColor: 'BLACK', secondaryColor: 'WHITE' }).expect(201);
    expect(dual.body.color).toBe('Black & White');
    const multi = await request(app).post('/admin/toys').set(auth(staff)).send({ ...base, sku: 'C-MULTI', colorType: 'MULTI' }).expect(201);
    expect(multi.body.color).toBe('Multicolour');

    for (const bad of [
      { colorType: 'SINGLE' },
      { colorType: 'SINGLE', primaryColor: 'RED', secondaryColor: 'BLUE' },
      { colorType: 'DUAL', primaryColor: 'RED' },
      { colorType: 'DUAL', primaryColor: 'RED', secondaryColor: 'RED' },
      { colorType: 'MULTI', primaryColor: 'RED' },
    ]) {
      await request(app).post('/admin/toys').set(auth(staff)).send({ ...base, sku: 'C-BAD', ...bad }).expect(400);
    }
  });

  it('filters the customer catalog by colour (base colour, dual, multicolour)', async () => {
    const red = (await request(app).get('/catalog?color=RED&pageSize=50')).body;
    // Red-based RC car, plus the blue & red dual slide.
    expect(skus(red)).toEqual(['PL-RCCAR-08', 'PL-SLIDE-15']);
    const dual = (await request(app).get('/catalog?color=DUAL&pageSize=50')).body;
    expect(skus(dual)).toEqual(['PL-DOCTOR-11', 'PL-SLIDE-15', 'WD-KITCH-04']);
    const multi = (await request(app).get('/catalog?color=MULTI&pageSize=50')).body;
    expect(multi.items.every((t: { colorType: string }) => t.colorType === 'MULTI')).toBe(true);
    // Colour and search combine.
    expect(skus((await request(app).get('/catalog?color=RED&q=car&pageSize=50')).body)).toEqual(['PL-RCCAR-08']);
    await request(app).get('/catalog?color=TEAL').expect(400);
  });

  it('filters admin toys by colour', async () => {
    const res = await request(app).get('/admin/toys?color=NATURAL_WOOD&pageSize=100').set(auth(staff)).expect(200);
    expect(skus(res.body)).toEqual(['AR-EASEL-25', 'WD-SHAPE-06', 'WD-TRAIN-05']);
  });
});

describe('editing a toy', () => {
  it('updates details, re-derives colour and size, and clears battery fields', async () => {
    const toy = await prisma.toy.findUniqueOrThrow({ where: { sku: 'PL-ROBOT-07' } });
    const res = await request(app)
      .patch(`/admin/toys/${toy.id}`)
      .set(auth(staff))
      .send({ name: 'Coding Robot Mouse (v2)', powerType: 'NON_ELECTRIC', colorType: 'DUAL', primaryColor: 'BLUE', secondaryColor: 'WHITE', lengthCm: 90 })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'Coding Robot Mouse (v2)', color: 'Blue & White', batteryType: null, batteryCount: null, sizeClass: 'LARGE' });
    // Untouched fields stay.
    expect(res.body.mrp).toBe(toy.mrp);
  });

  it('can hide a toy from customers', async () => {
    const toy = await prisma.toy.findUniqueOrThrow({ where: { sku: 'PL-RCCAR-08' } });
    await request(app).patch(`/admin/toys/${toy.id}`).set(auth(staff)).send({ isActive: false }).expect(200);
    expect(skus((await request(app).get('/catalog?pageSize=50')).body)).not.toContain('PL-RCCAR-08');
    await request(app).get(`/catalog/${toy.id}`).expect(404);
    await request(app).patch(`/admin/toys/${toy.id}`).set(auth(staff)).send({ isActive: true }).expect(200);
  });

  it('rejects duplicate SKUs, invalid ages and piece-count changes once units exist', async () => {
    const toy = await prisma.toy.findUniqueOrThrow({ where: { sku: 'WD-STACK-02' } });
    const dup = await request(app).patch(`/admin/toys/${toy.id}`).set(auth(staff)).send({ sku: 'wd-abacus-01' }).expect(409);
    expect(dup.body.error).toMatch(/already used/);
    await request(app).patch(`/admin/toys/${toy.id}`).set(auth(staff)).send({ ageMinMonths: 40, ageMaxMonths: 20 }).expect(400);
    await request(app).patch(`/admin/toys/${toy.id}`).set(auth(staff)).send({ pieceCount: 9 }).expect(400);
  });
});
