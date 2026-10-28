import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase, seedInventory, seedPlans, seedUsers, seedWarehouse } from '../prisma/seed';
import { SEED_TOYS } from '../prisma/seed-data';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let staff = '';
let parent = '';
let kidId = '';

beforeAll(async () => {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
  staff = (await request(app).post('/auth/login').send({ login: 'staff@rentaltoys.in', password: 'Staff@1234' })).body.token;
  const login = await request(app).post('/auth/login').send({ login: 'parent@example.com', password: 'Parent@1234' });
  parent = login.body.token;
  kidId = (await request(app).get('/auth/me').set(auth(parent))).body.kids[0].id;
}, 120_000);

describe('customer catalog paging', () => {
  it('pages through every available toy exactly once, in ranked order', async () => {
    const seen: string[] = [];
    let page = 1;
    let body;
    do {
      body = (await request(app).get(`/catalog?kidId=${kidId}&page=${page}&pageSize=10`).set(auth(parent)).expect(200)).body;
      seen.push(...body.items.map((t: { id: string }) => t.id));
      page++;
    } while (body.hasMore);
    expect(body.total).toBe(SEED_TOYS.length);
    expect(new Set(seen).size).toBe(SEED_TOYS.length);
    const all = (await request(app).get(`/catalog?kidId=${kidId}&pageSize=50`).set(auth(parent))).body.items.map((t: { id: string }) => t.id);
    expect(seen).toEqual(all);
  });

  it('sorts by newest, popular and age', async () => {
    const get = async (sort: string) => (await request(app).get(`/catalog?sort=${sort}&pageSize=50`)).body.items;
    const popular = await get('popular');
    expect(popular[0].sku).toBe('PL-RCCAR-08');
    const age = await get('age');
    expect(age.map((t: { ageMinMonths: number }) => t.ageMinMonths)).toEqual([...age.map((t: { ageMinMonths: number }) => t.ageMinMonths)].sort((a, b) => a - b));
    await request(app).get('/catalog?sort=nope').expect(400);
  });
});

describe('admin toys paging and filters', () => {
  it('returns page numbers and stock per toy', async () => {
    const res = await request(app).get('/admin/toys?page=2&pageSize=10').set(auth(staff)).expect(200);
    expect(res.body).toMatchObject({ page: 2, pageSize: 10, total: SEED_TOYS.length, totalPages: 3 });
    expect(res.body.items).toHaveLength(10);
    expect(res.body.items[0].availableUnits).toBeGreaterThan(0);
  });

  it('searches by SKU and filters no-photo, out-of-stock and damaged toys', async () => {
    expect((await request(app).get('/admin/toys?q=wd-abacus').set(auth(staff))).body.items.map((t: { sku: string }) => t.sku)).toEqual(['WD-ABACUS-01']);
    expect((await request(app).get('/admin/toys?filter=noPhotos&pageSize=100').set(auth(staff))).body.total).toBe(SEED_TOYS.length);

    // Make one toy out of stock and damaged.
    const toy = await prisma.toy.findUniqueOrThrow({ where: { sku: 'PL-SLIDE-15' } });
    await prisma.toyUnit.updateMany({ where: { toyId: toy.id }, data: { stage: 'DAMAGE' } });
    const out = (await request(app).get('/admin/toys?filter=outOfStock').set(auth(staff))).body.items.map((t: { sku: string }) => t.sku);
    const dmg = (await request(app).get('/admin/toys?filter=hasDamaged').set(auth(staff))).body.items.map((t: { sku: string }) => t.sku);
    expect(out).toEqual(['PL-SLIDE-15']);
    expect(dmg).toEqual(['PL-SLIDE-15']);
    const lowest = (await request(app).get('/admin/toys?sort=stock').set(auth(staff))).body.items[0];
    expect(lowest.sku).toBe('PL-SLIDE-15');
  });

  it('filters by age band', async () => {
    const items = (await request(app).get('/admin/toys?ageBand=0-1&pageSize=100').set(auth(staff))).body.items;
    expect(items.length).toBeGreaterThan(0);
    for (const t of items) expect((t.ageMinMonths + t.ageMaxMonths) / 2).toBeLessThan(12);
  });
});
