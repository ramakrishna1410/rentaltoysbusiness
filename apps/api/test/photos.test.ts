import QRCode from 'qrcode';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase, seedInventory, seedPlans, seedUsers, seedWarehouse } from '../prisma/seed';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
let staff = '';
let customer = '';
let toyId = '';
let png = '';

beforeAll(async () => {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
  staff = (await request(app).post('/auth/login').send({ login: 'staff@rentaltoys.in', password: 'Staff@1234' })).body.token;
  customer = (await request(app).post('/auth/login').send({ login: 'parent@example.com', password: 'Parent@1234' })).body.token;
  toyId = (await prisma.toy.findUniqueOrThrow({ where: { sku: 'WD-ABACUS-01' } })).id;
  png = (await QRCode.toBuffer('photo', { type: 'png' })).toString('base64');
}, 120_000);

describe('toy photos', () => {
  it('starts with no placeholder photos', async () => {
    const card = (await request(app).get('/catalog?pageSize=50')).body.items.find((t: { id: string }) => t.id === toyId);
    expect(card.images).toEqual([]);
  });

  it('uploads, serves and shows photos in the catalog, cover first', async () => {
    const first = await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: png }).expect(201);
    const second = await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: `data:image/png;base64,${png}` }).expect(201);

    const img = await request(app).get(`/images/${first.body.id}`).expect(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(Buffer.from(img.body).subarray(1, 4).toString()).toBe('PNG');

    const card = (await request(app).get('/catalog?pageSize=50')).body.items.find((t: { id: string }) => t.id === toyId);
    expect(card.images.map((u: string) => u.split('/').pop())).toEqual([first.body.id, second.body.id]);
    const detail = await request(app).get(`/catalog/${toyId}`).expect(200);
    expect(detail.body.images[0]).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/images/${first.body.id}$`));

    await request(app).put(`/admin/toys/${toyId}/photos/order`).set(auth(staff)).send({ photoIds: [second.body.id, first.body.id] }).expect(200);
    const admin = await request(app).get(`/admin/toys/${toyId}`).set(auth(staff)).expect(200);
    expect(admin.body.photos.map((p: { id: string }) => p.id)).toEqual([second.body.id, first.body.id]);

    await request(app).delete(`/admin/toys/${toyId}/photos/${second.body.id}`).set(auth(staff)).expect(204);
    await request(app).get(`/images/${second.body.id}`).expect(404);
  });

  it('rejects non-images, too many photos, and customers', async () => {
    await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: Buffer.from('not an image').toString('base64') }).expect(400);
    await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(customer)).send({ data: png }).expect(403);
    const existing = await prisma.toyImage.count({ where: { toyId } });
    for (let i = existing; i < 6; i++) await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: png }).expect(201);
    const res = await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: png }).expect(400);
    expect(res.body.error).toMatch(/at most 6/);
  });

  it('accepts a ~2 MB upload on the photo route', async () => {
    await prisma.toyImage.deleteMany({ where: { toyId } });
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2 * 1024 * 1024)]).toString('base64');
    await request(app).post(`/admin/toys/${toyId}/photos`).set(auth(staff)).send({ data: big }).expect(201);
  });
});
