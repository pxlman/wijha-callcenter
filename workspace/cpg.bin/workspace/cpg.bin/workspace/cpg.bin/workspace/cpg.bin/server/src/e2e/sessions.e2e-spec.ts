/**
 * Sessions E2E — main coverage layer (list, create/merge, heartbeat).
 */

import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';
import { login } from '@/test/e2e-helpers';

describe('Sessions E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let adminToken: string;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    await seedTestData(prisma);
    adminToken = await login(app, 'admin1@gmail.com', 'admin123');
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  it('GET /sessions returns current agent sessions (200)', async () => {
    const res = await app
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /sessions?from&to filters range (200)', async () => {
    await app
      .get('/api/v1/sessions?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('POST /sessions creates a non-overlapping session (201)', async () => {
    const res = await app
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        first_beat: '2026-08-28T08:00:00Z',
        last_beat: '2026-08-28T09:00:00Z',
      })
      .expect(201);
    expect(res.body.is_active).toBe(false);
    expect(res.body.duration).toBe(3600);
  });

  it('POST /sessions invalid dates returns 400', async () => {
    await app
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ first_beat: 'nope', last_beat: 'also-nope' })
      .expect(400);
  });

  it('POST /sessions overlapping merges into one session (201)', async () => {
    await app
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        first_beat: '2026-08-28T10:00:00Z',
        last_beat: '2026-08-28T11:00:00Z',
      })
      .expect(201);
    const res = await app
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        first_beat: '2026-08-28T10:30:00Z',
        last_beat: '2026-08-28T11:30:00Z',
      })
      .expect(201);
    // Merged window spans 10:00 -> 11:30 = 5400s
    expect(res.body.duration).toBe(5400);
    const list = await app
      .get('/api/v1/sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const overlapping = list.body.filter(
      (s: any) => s.first_beat.startsWith('2026-08-28T10'),
    );
    expect(overlapping.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /sessions/active marks session active (200)', async () => {
    const res = await app
      .post('/api/v1/sessions/active')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.is_active).toBe(true);
  });

  it('GET /sessions without token returns 401', async () => {
    await app.get('/api/v1/sessions').expect(401);
  });
});
