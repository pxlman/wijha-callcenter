/**
 * Security E2E Tests
 *
 * Tests authentication and authorization security controls against the real
 * PostgreSQL database and full NestJS stack.
 *
 * Test coverage:
 *   - JWT token tampering → 401 (signature invalid)
 *   - Expired JWT → 401 (token expired, passport-jwt rejects)
 *   - Malformed Authorization headers → 401
 *   - Path traversal (non-integer IDs) → 400 (ValidationPipe rejects)
 *   - Password hash not leaked in any response body
 *
 * Prerequisites: Same as other E2E tests (PostgreSQL + seed data)
 */

import { JwtService } from '@nestjs/jwt';
import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';

describe('Security E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let token = '';
  let jwtService: JwtService;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    jwtService = testModule.get<JwtService>(JwtService);
    await seedTestData(prisma);

    const res = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    token = res.body.token;
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  /**
   * Input: Valid JWT with one character flipped (breaks signature)
   * Expected: HTTP 401 — JwtAuthGuard detects invalid signature, rejects request
   * Security: Prevents token forgery via tampering
   */
  it('JWT token tampering returns 401', async () => {
    const tampered = token.slice(0, -5) + 'XXXXX';
    await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });

  /**
   * Input: JWT signed with correct secret but expired (exp claim in the past)
   * Expected: HTTP 401 — passport-jwt's ignoreExpiration: false rejects expired tokens
   * Security: Ensures expired tokens cannot access protected endpoints
   */
  it('Expired JWT returns 401', async () => {
    const expiredToken = jwtService.sign(
      { id: 1, email: 'admin1@gmail.com', role: 'admin' } as never,
      { expiresIn: '-1h' } as never,
    );
    await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  /**
   * Input: Various malformed Authorization header values
   * Expected: HTTP 401 for all — JwtAuthGuard cannot extract a valid token
   * Security: Prevents authentication bypass via header manipulation
   */
  it.each([
    ['empty Bearer scheme', 'Bearer '],
    ['no scheme prefix', token],
    ['wrong scheme', `Basic ${token}`],
    ['malformed', 'Bearer token123'],
  ])('Malformed Authorization header (%s) returns 401', async (_desc, authHeader) => {
    await app.get('/api/v1/users')
      .set('Authorization', authHeader)
      .expect(401);
  });

  /**
   * Input: GET /api/v1/owners/abc (non-integer path parameter)
   * Expected: HTTP 400 — ValidationPipe/@Param decorator rejects non-numeric id
   * Security: Prevents type confusion / unexpected behavior from invalid path params
   */
  it('Path traversal with non-integer ID returns 400', async () => {
    await app.patch('/api/v1/owners/abc')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'LEAD' })
      .expect(400);
  });

  /**
   * Input: GET /api/v1/owners/../../etc/passwd (path traversal attempt)
   * Expected: HTTP 404 — Express strips path traversal, route doesn't match
   * Security: Path traversal cannot access files outside the app
   */
  it('Path traversal attempt returns 404', async () => {
    await app.get('/api/v1/owners/../../etc/passwd')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  /**
   * Input: Login response, user detail response — check all responses
   * Expected: No response body should contain 'passwordHash' or 'password_hash'
   * Security: Password hashes must never leak to the client
   */
  it('Password hash is never returned in response bodies', async () => {
    // Check login response
    const loginRes = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    const loginStr = JSON.stringify(loginRes.body);
    expect(loginStr).not.toContain('passwordHash');
    expect(loginStr).not.toContain('password_hash');

    // Use the freshly issued token (re-login invalidated the beforeAll token)
    const freshToken = loginRes.body.token;

    // Check users list response
    const usersRes = await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);
    const usersStr = JSON.stringify(usersRes.body);
    expect(usersStr).not.toContain('passwordHash');
    expect(usersStr).not.toContain('password_hash');

    // Check user detail response
    const userRes = await app.get('/api/v1/users/1')
      .set('Authorization', `Bearer ${freshToken}`)
      .expect(200);
    const userStr = JSON.stringify(userRes.body);
    expect(userStr).not.toContain('passwordHash');
    expect(userStr).not.toContain('password_hash');
  });

  /**
   * Input: GET /api/v1/users with a token signed by a different secret
   * Expected: HTTP 401 — signature verification fails
   * Security: Tokens signed with unknown secrets are rejected
   */
  it('JWT signed with wrong secret returns 401', async () => {
    const wrongSecretToken = jwtService.sign(
      { id: 1, email: 'admin1@gmail.com', role: 'admin' } as never,
      { secret: 'wrong-secret', expiresIn: '1h' } as never,
    );
    await app.get('/api/v1/users')
      .set('Authorization', `Bearer ${wrongSecretToken}`)
      .expect(401);
  });
});
