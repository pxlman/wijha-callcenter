/**
 * Projects E2E — main coverage layer (CRUD + admin-only delete).
 */

import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';
import { login } from '@/test/e2e-helpers';

describe('Projects E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let adminToken: string;
  let agentToken: string;
  let agentId: number;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    await seedTestData(prisma);
    adminToken = await login(app, 'admin1@gmail.com', 'admin123');

    const agentRes = await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'e2e-agent@wijha.com', password: 'Password123', name: 'Agent', role: 'user' })
      .expect(201);
    agentId = agentRes.body.id;
    agentToken = await login(app, 'e2e-agent@wijha.com', 'Password123');
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  it('GET /projects lists projects (200)', async () => {
    const res = await app
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /projects creates a project (201)', async () => {
    const res = await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Summer Campaign', description: 'Q3 outreach' })
      .expect(201);
    expect(res.body.name).toBe('Summer Campaign');
  });

  it('POST /projects duplicate name returns 409', async () => {
    await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Default Project' })
      .expect(409);
  });

  it('POST /projects missing name returns 400', async () => {
    await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'no name' })
      .expect(400);
  });

  it('GET /projects/:id returns the project (200)', async () => {
    const res = await app
      .get('/api/v1/projects/1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).not.toBeNull();
  });

  it('GET /projects/:id not found returns empty body (200)', async () => {
    const res = await app
      .get('/api/v1/projects/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({});
  });

  it('PATCH /projects/:id updates (200)', async () => {
    const created = await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamable' })
      .expect(201);
    const res = await app
      .patch(`/api/v1/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Renamed' })
      .expect(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('PATCH /projects/:id not found returns 404', async () => {
    await app
      .patch('/api/v1/projects/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' })
      .expect(404);
  });

  it('DELETE /projects/:id as non-admin returns 403', async () => {
    const created = await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Protected' })
      .expect(201);
    await app
      .delete(`/api/v1/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(403);
  });

  it('DELETE /projects/:id as admin removes it (204)', async () => {
    const created = await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Removable' })
      .expect(201);
    await app
      .delete(`/api/v1/projects/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });

  it('DELETE /projects/:id not found returns 404', async () => {
    await app
      .delete('/api/v1/projects/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
