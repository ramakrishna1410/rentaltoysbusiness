import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetDatabase, seedInventory, seedPlans, seedUsers, seedWarehouse } from '../prisma/seed';
import { createApp } from '../src/app';
import { MEDIA_DIR } from '../src/landing';

const app = createApp();
const clip = path.join(MEDIA_DIR, 'landing', '02-warehouse.mp4');

beforeAll(async () => {
  await resetDatabase();
  await seedPlans();
  await seedWarehouse();
  const admin = await seedUsers();
  await seedInventory(admin.id);
}, 120_000);

afterAll(() => {
  fs.rmSync(clip, { force: true });
});

describe('landing slides', () => {
  it('lists 5 slides and only links videos that exist', async () => {
    fs.rmSync(clip, { force: true });
    const before = (await request(app).get('/landing').expect(200)).body.slides;
    expect(before).toHaveLength(5);
    expect(before.every((s: { videoUrl: string | null }) => s.videoUrl === null)).toBe(true);

    fs.writeFileSync(clip, Buffer.alloc(4096, 1));
    const after = (await request(app).get('/landing')).body.slides;
    expect(after[1].videoUrl).toMatch(/\/media\/landing\/02-warehouse\.mp4$/);
    const ranged = await request(app).get('/media/landing/02-warehouse.mp4').set('Range', 'bytes=0-99').expect(206);
    expect(ranged.headers['content-type']).toBe('video/mp4');
    await request(app).get('/media/landing/nope.mp4').expect(404);
  });
});

describe('guest catalog from Get started answers', () => {
  const items = async (q: string) => (await request(app).get(`/catalog?pageSize=50&${q}`).expect(200)).body.items;

  it('ranks for the answers without an account', async () => {
    const outdoor = await items('kidAgeMonths=48&playPlace=OUTDOOR&likes=OUTDOOR_RIDE_ON');
    expect(['PL-BALANCE-16', 'PL-SLIDE-15', 'PL-RIDEON-14']).toContain(outdoor[0].sku);
    expect(outdoor[0].reasons.join(' ')).toMatch(/Outdoor/);

    const pinkLover = await items('kidAgeMonths=48&colors=PINK');
    expect(pinkLover[0].reasons).toContain('Loves pink');
    // Ranking only: every available toy is still listed.
    expect(pinkLover).toHaveLength(28);
  });

  it('rejects unknown answer values', async () => {
    await request(app).get('/catalog?kidAgeMonths=48&colors=TEAL').expect(400);
    await request(app).get('/catalog?kidAgeMonths=48&goals=NAPS').expect(400);
  });
});

describe('signup saves the Get started answers on the kid', () => {
  it('stores colours, play place and goals, and uses them for For you', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Guest Parent', email: 'guest@example.com', phone: '9123400000', password: 'Secret@123',
        kids: [{ name: 'Mira', dateOfBirth: '2022-03-01', interests: ['PRETEND_PLAY'], favoriteColors: ['PINK', 'MULTI'], playPlace: 'INDOOR', goals: ['SOCIAL'] }],
      })
      .expect(201);
    const kid = res.body.user.kids[0];
    expect(kid).toMatchObject({ favoriteColors: ['PINK', 'MULTI'], playPlace: 'INDOOR', goals: ['SOCIAL'] });
    const forYou = await request(app).get(`/catalog/for-you?kidId=${kid.id}`).set('Authorization', `Bearer ${res.body.token}`).expect(200);
    const reasons = forYou.body.sections[0].toys.flatMap((t: { reasons: string[] }) => t.reasons).join(' ');
    expect(reasons).toMatch(/Loves pink|Bright multicolour/);
  });
});
