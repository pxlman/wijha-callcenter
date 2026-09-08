/**
 * Auth Integration Tests
 *
 * Tests authentication endpoints (login, register, logout) through the full
 * HTTP stack — NestJS router, JwtAuthGuard, JwtStrategy, AuthService, bcryptjs,
 * and ValidationPipe — with PrismaService mocked (no real database needed).
 *
 * The test flow exercises the complete JWT token lifecycle:
 *   1. Login → AuthService.login() → bcrypt.compare() → jwtService.sign() →
 *      token stored in mock prisma.user.update({ jwtToken })
 *   2. Subsequent requests → JwtAuthGuard extracts Bearer token →
 *      JwtStrategy.validate() → AuthService.validateUserWithToken() →
 *      prisma.user.findUnique() reads stored token → match = authenticated
 *
 * Test coverage:
 *   - POST /api/v1/login with valid credentials → 200 + token
 *   - POST /api/v1/login with invalid email → 401 "Invalid email"
 *   - POST /api/v1/login with invalid password → 401 "Invalid password"
 *   - POST /api/v1/register with new email → 201 + token
 *   - POST /api/v1/register with duplicate email → 409 "Email already exists"
 *   - POST /api/v1/logout with valid token → 200
 *   - GET /api/v1/users without token → 401 (JwtAuthGuard rejects)
 *   - GET /api/v1/users with valid admin token → 200
 */

import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUser } from '@/prisma/mock-data';
import { setupIntegrationTest, teardownIntegrationTest } from './integration-helpers';
import request from 'supertest';

describe('Auth Integration Tests', () => {
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
   * Input: POST /api/v1/login with { email: 'admin1@gmail.com', password: 'admin123' }
   * Expected: HTTP 200, response body contains { token: string, user: object }
   *   - token is a JWT string longer than 20 chars
   *   - user.email is 'admin1@gmail.com', user.role is 'admin'
   */
  it('POST /api/v1/login with valid admin credentials returns 200 and token', async () => {
    const res = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.user.email).toBe('admin1@gmail.com');
    expect(res.body.user.role).toBe('admin');
  });

  /**
   * Input: POST /api/v1/login with { email: 'nonexistent@test.com', password: 'pass' }
   * Expected: HTTP 401, message "Invalid email"
   *   The user does not exist in the mock database, so AuthService.findUser
   *   returns null and login throws UnauthorizedException('Invalid email')
   */
  it('POST /api/v1/login with non-existent email returns 401 "Invalid email"', async () => {
    const res = await app.post('/api/v1/login')
      .send({ email: 'nonexistent@test.com', password: 'pass' })
      .expect(401);

    expect(res.body.message).toBe('Invalid email');
  });

  /**
   * Input: POST /api/v1/login with { email: 'admin1@gmail.com', password: 'wrongpassword' }
   * Expected: HTTP 401, message "Invalid password"
   *   The user exists but bcrypt.compare('wrongpassword', hashOfAdmin123) returns false
   */
  it('POST /api/v1/login with wrong password returns 401 "Invalid password"', async () => {
    const res = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'wrongpassword' })
      .expect(401);

    expect(res.body.message).toBe('Invalid password');
  });

  /**
   * Input: POST /api/v1/register with { email: 'newuser@test.com', password: 'password123', name: 'New User', phone: null, role: 'user' }
   * Expected: HTTP 201, response body contains { token, user: { email: 'newuser@test.com' } }
   *   - AuthService.register() creates the user (bcrypt.hash for password, prisma.user.create)
   *   - AuthController.register() then calls login() which issues a JWT
   */
  it('POST /api/v1/register with new email returns 201 and token', async () => {
    const res = await app.post('/api/v1/register')
      .send({
        email: 'newuser@test.com',
        password: 'password123',
        name: 'New User',
        phone: null,
        role: 'user',
      })
      .expect(201);

    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('newuser@test.com');
  });

  /**
   * Input: POST /api/v1/register with { email: 'admin1@gmail.com', password: 'password123', ... }
   *   The email 'admin1@gmail.com' already exists in the mock database
   * Expected: HTTP 401, message "Email already in use"
   *   - AuthService.register() calls prisma.user.findUnique({ where: { email } })
   *   - Finds existing user → throws UnauthorizedException('Email already in use')
   */
  it('POST /api/v1/register with duplicate email returns 401 "Email already in use"', async () => {
    const existingUser = mockUser({ id: 1, email: 'admin1@gmail.com' });
    prisma.user.findUnique.mockResolvedValue(existingUser);

    const res = await app.post('/api/v1/register')
      .send({
        email: 'admin1@gmail.com',
        password: 'password123',
        name: 'Admin',
        phone: null,
        role: 'admin',
      })
      .expect(401);

    expect(res.body.message).toBe('Email already in use');
  });

  /**
   * Input: POST /api/v1/logout with valid Bearer token obtained from login
   * Expected: HTTP 200, message "Logged out successfully"
   *   - AuthService.logout() clears the jwtToken in the database (prisma.user.update)
   */
  it('POST /api/v1/logout with valid token returns 200', async () => {
    const loginRes = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);

    const token = loginRes.body.token;

    const res = await app.post('/api/v1/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.message).toBe('Logged out successfully');
  });

  /**
   * Input: GET /api/v1/users with NO Authorization header
   * Expected: HTTP 401 — JwtAuthGuard rejects the request before it reaches the controller
   */
  it('GET /api/v1/users without token returns 401', async () => {
    await app.get('/api/v1/users').expect(401);
  });

  /**
   * Input: GET /api/v1/users with valid Bearer token from admin login
   * Expected: HTTP 200, response body is an array of UserResponseDto objects
   */
  it('GET /api/v1/users with valid admin token returns 200', async () => {
    const loginRes = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);

    const token = loginRes.body.token;

    const res = await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });
});
