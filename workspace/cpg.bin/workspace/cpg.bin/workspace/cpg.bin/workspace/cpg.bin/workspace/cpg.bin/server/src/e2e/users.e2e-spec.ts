/**
 * Users E2E — main coverage layer (CRUD, role enforcement, profile image, stats).
 */

import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';
import { login } from '@/test/e2e-helpers';

const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofIh0aHBwqLC8lJyUoIiuCnJ2eygaJjwrYrdoZGOcA8jP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD/2Q==',
  'base64',
);

describe('Users E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let adminToken: string;
  let agentToken: string;
  let agentId: number;
  let counter = 0;
  const email = () => `e2e-user-${counter++}@wijha.com`;

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
      .send({ email: 'e2e-agent-user@wijha.com', password: 'Password123', name: 'Agent', role: 'user' })
      .expect(201);
    agentId = agentRes.body.id;
    agentToken = await login(app, 'e2e-agent-user@wijha.com', 'Password123');
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  it('GET /users lists users as admin (200)', async () => {
    const res = await app
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /users?role=admin filters (200)', async () => {
    const res = await app
      .get('/api/v1/users?role=admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.every((u: any) => u.role === 'admin')).toBe(true);
  });

  it('GET /users?online=true filters (200)', async () => {
    await app
      .get('/api/v1/users?online=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('GET /users as non-admin returns 403', async () => {
    await app.get('/api/v1/users').set('Authorization', `Bearer ${agentToken}`).expect(403);
  });

  it('POST /users creates a user (201)', async () => {
    const res = await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email(), password: 'Password123', name: 'Rep', role: 'user' })
      .expect(201);
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('POST /users duplicate email returns 409', async () => {
    const e = email();
    await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: e, password: 'Password123', role: 'user' })
      .expect(201);
    await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: e, password: 'Password123', role: 'user' })
      .expect(409);
  });

  it('POST /users weak password returns 400', async () => {
    await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email(), password: '123', role: 'user' })
      .expect(400);
  });

  it('POST /users invalid email returns 400', async () => {
    await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'notanemail', password: 'Password123', role: 'user' })
      .expect(400);
  });

  it('POST /users missing role returns 400', async () => {
    await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email(), password: 'Password123' })
      .expect(400);
  });

  it('POST /users/bulk creates many (201)', async () => {
    const res = await app
      .post('/api/v1/users/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        users: [
          { email: email(), password: 'Password123', role: 'user' },
          { email: email(), password: 'Password123', role: 'user' },
        ],
      })
      .expect(201);
    expect(res.body).toHaveLength(2);
  });

  it('POST /users/bulk duplicate email returns 409', async () => {
    const e = email();
    await app
      .post('/api/v1/users/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ users: [{ email: e, password: 'Password123', role: 'user' }] })
      .expect(201);
    await app
      .post('/api/v1/users/bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ users: [{ email: e, password: 'Password123', role: 'user' }] })
      .expect(409);
  });

  it('GET /users/:id returns the user (200)', async () => {
    const res = await app
      .get(`/api/v1/users/${agentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(agentId);
  });

  it('GET /users/:id not found returns empty body (200)', async () => {
    const res = await app
      .get(`/api/v1/users/999999`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({});
  });

  it('PATCH /users/:id self update succeeds (200)', async () => {
    const res = await app
      .patch(`/api/v1/users/${agentId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Agent Renamed' })
      .expect(200);
    expect(res.body.name).toBe('Agent Renamed');
  });

  it('PATCH /users/:id updating another user returns 403', async () => {
    await app
      .patch('/api/v1/users/1')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ name: 'Hack' })
      .expect(403);
  });

  it('PATCH /users/:id not found returns 404', async () => {
    await app
      .patch('/api/v1/users/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X' })
      .expect(404);
  });

  it('PATCH /users/:id/deactivate as admin (200)', async () => {
    const res = await app
      .patch(`/api/v1/users/${agentId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.role).toBe('deactivated');
  });

  it('PATCH /users/:id/deactivate not found returns 404', async () => {
    await app
      .patch('/api/v1/users/999999/deactivate')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('POST /users/:id/profile-image uploads image (200)', async () => {
    const res = await app
      .post(`/api/v1/users/${agentId}/profile-image`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('profile_image', JPEG, { filename: 'pic.jpg', contentType: 'image/jpeg' })
      .expect(200);
    expect(res.body.has_profile_image).toBe(true);
  });

  it('POST /users/:id/profile-image wrong mime returns 400', async () => {
    await app
      .post(`/api/v1/users/${agentId}/profile-image`)
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('profile_image', Buffer.from('hello'), { filename: 'pic.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('POST /users/:id/profile-image no file returns 400', async () => {
    await app
      .post(`/api/v1/users/${agentId}/profile-image`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(400);
  });

  it('POST /users/:id/profile-image for another user returns 403', async () => {
    await app
      .post('/api/v1/users/1/profile-image')
      .set('Authorization', `Bearer ${agentToken}`)
      .attach('profile_image', JPEG, { filename: 'pic.jpg', contentType: 'image/jpeg' })
      .expect(403);
  });

  it('GET /users/:id/profile-image returns binary (200)', async () => {
    await app
      .get(`/api/v1/users/${agentId}/profile-image`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200)
      .expect('Content-Type', 'image/jpeg');
  });

  it('GET /users/:id/profile-image missing returns 404', async () => {
    const fresh = await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: email(), password: 'Password123', role: 'user' })
      .expect(201);
    await app
      .get(`/api/v1/users/${fresh.body.id}/profile-image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('DELETE /users/:id/profile-image removes image (200)', async () => {
    const res = await app
      .delete(`/api/v1/users/${agentId}/profile-image`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(res.body.has_profile_image).toBe(false);
  });

  it('GET /users/:id/stats returns metrics (200)', async () => {
    const res = await app
      .get(`/api/v1/users/${agentId}/stats`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('total_calls');
    expect(res.body).toHaveProperty('avg_duration_seconds');
    expect(res.body).toHaveProperty('total_session_time_seconds');
  });

  it('GET /users/:id/stats with date range filters (200)', async () => {
    const res = await app
      .get(`/api/v1/users/${agentId}/stats?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toHaveProperty('total_calls');
  });

  it('GET /users/:id/stats not found returns empty body (200)', async () => {
    const res = await app
      .get('/api/v1/users/999999/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body).toEqual({});
  });
});
