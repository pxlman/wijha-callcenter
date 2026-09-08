/**
 * Users RBAC Integration Tests
 *
 * Tests role-based access control (RBAC) through the full HTTP stack.
 * The UsersController applies both JwtAuthGuard (for authentication) and
 * RolesGuard (for authorization) on admin-only endpoints.
 *
 * RBAC flow:
 *   1. Request with valid JWT (authenticated user) + correct role → 200
 *   2. Request with valid JWT but wrong role → 403 Forbidden
 *   3. Request with no JWT → 401 Unauthorized
 *
 * The RolesGuard reads @Roles() metadata from the route handler. When a role
 * is required and the authenticated user's role is not in the list, the guard
 * returns false, and NestJS responds with 403.
 *
 * Test coverage:
 *   - GET /users as admin → 200 (admin can list all users)
 *   - GET /users as regular user → 403 (only admins can list users)
 *   - GET /users without token → 401 (JwtAuthGuard blocks unauthenticated)
 *   - POST /users as admin → 201 (admin can create users)
 *   - POST /users as regular user → 403 (only admins can create users)
 *   - POST /users without token → 401 (JwtAuthGuard blocks unauthenticated)
 *   - GET /users/:id as regular user viewing own profile → 200
 */

import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '@/prisma/prisma.service';
import { setupIntegrationTest, teardownIntegrationTest } from './integration-helpers';
import request from 'supertest';

describe('Users RBAC Integration Tests', () => {
  let app: ReturnType<typeof request>;
  let prisma: DeepMockProxy<PrismaService>;
  let moduleRef: TestingModule;
  let appInstance: INestApplication;

  beforeEach(async () => {
    const ctx = await setupIntegrationTest();
    app = ctx.app;
    prisma = ctx.prisma;
    moduleRef = ctx.module;
    appInstance = ctx.appInstance;
  });

  afterEach(async () => {
    await teardownIntegrationTest(moduleRef, appInstance);
  });

  /**
   * Helper: logs in as a specific user and returns the Bearer token.
   * @param email - User's email
   * @param password - User's password
   * @returns JWT token string
   */
  async function loginAs(email: string, password: string): Promise<string> {
    const res = await app.post('/api/v1/login')
      .send({ email, password })
      .expect(200);
    return res.body.token;
  }

  /**
   * Input: GET /api/v1/users with admin Bearer token
   * Expected: HTTP 200, response body is an array
   *   Admin has role 'admin' which matches @Roles('admin') on GET /users
   */
  it('GET /api/v1/users as admin returns 200', async () => {
    const token = await loginAs('admin1@gmail.com', 'admin123');
    const res = await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  /**
   * Input: GET /api/v1/users with regular user Bearer token
   * Expected: HTTP 403 Forbidden
   *   Regular user has role 'user' which does NOT match @Roles('admin')
   *   RolesGuard returns false → NestJS responds 403
   */
  it('GET /api/v1/users as regular user returns 403', async () => {
    const token = await loginAs('agent1@gmail.com', 'agent123');
    const res = await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.message).toBe('Forbidden resource');
  });

  /**
   * Input: GET /api/v1/users with NO Authorization header
   * Expected: HTTP 401 Unauthorized
   *   JwtAuthGuard runs first and rejects the request before RolesGuard
   */
  it('GET /api/v1/users without token returns 401', async () => {
    await app.get('/api/v1/users').expect(401);
  });

  /**
   * Input: POST /api/v1/users with admin Bearer token and valid user data
   * Expected: HTTP 201, response body contains created user
   *   Admin has @Roles('admin') + @UseGuards(RolesGuard) → access granted
   */
  it('POST /api/v1/users as admin returns 201', async () => {
    const token = await loginAs('admin1@gmail.com', 'admin123');
    const res = await app.post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser@test.com',
        password: 'password123',
        name: 'New User',
        phone: '555-0000',
        role: 'user',
      })
      .expect(201);
    expect(res.body.email).toBe('newuser@test.com');
  });

  /**
   * Input: POST /api/v1/users with regular user Bearer token
   * Expected: HTTP 403 Forbidden
   *   Regular user has role 'user' which does NOT match @Roles('admin')
   */
  it('POST /api/v1/users as regular user returns 403', async () => {
    const token = await loginAs('agent1@gmail.com', 'agent123');
    await app.post('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .send({
        email: 'newuser2@test.com',
        password: 'password123',
        name: 'New User',
        phone: '555-0000',
        role: 'user',
      })
      .expect(403);
  });

  /**
   * Input: POST /api/v1/users with NO Authorization header
   * Expected: HTTP 401 Unauthorized
   *   JwtAuthGuard blocks the request before RolesGuard
   */
  it('POST /api/v1/users without token returns 401', async () => {
    await app.post('/api/v1/users')
      .send({
        email: 'nonexistent@test.com',
        password: 'password123',
        name: 'New User',
        phone: '555-0000',
        role: 'user',
      })
      .expect(401);
  });

  /**
   * Input: GET /api/v1/users/2 with regular user Bearer token (viewing own profile)
   * Expected: HTTP 200
   *   GET /users/:id does NOT have @Roles() — any authenticated user can view
   */
  it('GET /api/v1/users/:id as regular user viewing any profile returns 200', async () => {
    const token = await loginAs('agent1@gmail.com', 'agent123');
    const res = await app.get('/api/v1/users/2')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toBeDefined();
  });
});
