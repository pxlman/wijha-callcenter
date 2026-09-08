/**
 * Auth E2E Tests
 *
 * End-to-end tests for authentication endpoints against a real PostgreSQL database.
 * Boots the full NestJS AppModule with all controllers, guards, pipes, and middleware.
 *
 * Prerequisites: PostgreSQL at localhost:5432 (database 'mydb', user 'myuser').
 * Schema deployed via `npx prisma db push` and seed (admin1@gmail.com / admin123).
 */

import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';

describe('Auth E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    await seedTestData(prisma);
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  it('POST /api/v1/login valid credentials returns 200 + token', async () => {
    const res = await app
      .post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('admin1@gmail.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('POST /api/v1/login invalid email returns 401', async () => {
    const res = await app
      .post('/api/v1/login')
      .send({ email: 'wrong@test.com', password: 'pass' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email');
  });

  it('POST /api/v1/login invalid password returns 401', async () => {
    const res = await app
      .post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toBe('Invalid password');
  });

  it('POST /api/v1/register creates user and logs in (201)', async () => {
    const res = await app
      .post('/api/v1/register')
      .send({
        email: `register-${Date.now()}@wijha.com`,
        password: 'Password123',
        name: 'New Reg',
        role: 'user',
      })
      .expect(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('user');
  });

  it('POST /api/v1/register duplicate email returns 401', async () => {
    await app
      .post('/api/v1/register')
      .send({ email: 'admin1@gmail.com', password: 'Password123' })
      .expect(401);
  });

  it('GET /api/v1/me with token returns the user (200)', async () => {
    const loginRes = await app
      .post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    const res = await app
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200);
    expect(res.body.email).toBe('admin1@gmail.com');
  });

  it('GET /api/v1/me without token returns 401', async () => {
    await app.get('/api/v1/me').expect(401);
  });

  it('POST /api/v1/logout with token returns 200', async () => {
    const loginRes = await app
      .post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    await app
      .post('/api/v1/logout')
      .set('Authorization', `Bearer ${loginRes.body.token}`)
      .expect(200);
  });

  it('GET /api/v1/users without token returns 401', async () => {
    await app.get('/api/v1/users').expect(401);
  });
});
