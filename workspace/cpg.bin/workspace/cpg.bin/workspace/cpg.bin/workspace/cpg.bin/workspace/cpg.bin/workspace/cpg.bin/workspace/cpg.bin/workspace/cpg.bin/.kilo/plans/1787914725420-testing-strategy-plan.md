# Testing Strategy Plan — Call Center Broker API

## Goal
Establish a comprehensive testing strategy and CI pipeline for the NestJS + Prisma + PostgreSQL call-center API, covering unit, integration, and end-to-end coverage with clear ownership and validation gates before deployment.

---

## 1. Current State (as of plan date)

### Test infrastructure
- **Runner**: Jest 29 + ts-jest (TypeScript transpilation)
- **Unit test command**: `npm test` (`jest` with `testRegex: .*\.spec\.ts$`)
- **E2E test command**: `npm run test:e2e` (`jest --config ./test/jest-e2e.json` with `testRegex: .*\.e2e-spec\.ts$`)
- **All-in-one**: `npm run test:all` runs both
- **Mocking**: `jest-mock-extended` (`mockDeep`) for Prisma service mocks in unit tests
- **E2E harness**: `setupE2E()` / `teardownE2E()` in `server/src/test/setup-e2e.ts` — boots full NestJS app with `AppModule`
- **Seed data**: `server/src/test/seed.ts` — upserts admin user + default project
- **No coverage thresholds** configured in Jest
- **No CI/CD pipeline** (no `.github/workflows/`)

### Existing test files
| Type | File | Tests | Status |
|------|------|-------|--------|
| Unit | `auth.controller.spec.ts` | 4 | Passing |
| Unit | `auth.service.spec.ts` | 8 | Passing |
| Unit | `calls.controller.spec.ts` | 12 | Passing |
| Unit | `calls.service.spec.ts` | 24 | Passing |
| Unit | `owners.controller.spec.ts` | 11 | Passing |
| Unit | `owners.service.spec.ts` | 27 | Passing |
| Unit | `projects.controller.spec.ts` | 3 | Passing |
| Unit | `projects.service.spec.ts` | 3 | Passing |
| Unit | `sessions.controller.spec.ts` | 3 | Passing |
| Unit | `sessions.service.spec.ts` | 11 | Passing |
| Unit | `users.controller.spec.ts` | ~17 | Passing |
| Unit | `users.service.spec.ts` | 22 | Passing |
| Unit | `logger.middleware.spec.ts` | 1 | Passing |
| E2E | `api.spec.ts` | 3 | Passing (was broken, now fixed) |
| E2E | `e2e/auth.e2e-spec.ts` | 3 | **Not run by default** — separate config, has same bugs as api.spec.ts |
| E2E | `e2e/validation.e2e-spec.ts` | 5 | **Not run by default** — separate config, has same bugs as api.spec.ts |

**Total**: ~167 unit tests + 3 E2E tests passing. The 2 e2e-spec files are only run via `npm run test:e2e` and have not been verified — they contain the same category of bugs that `api.spec.ts` had (wrong endpoint paths, wrong status codes, broken teardown).

### What's NOT covered (gaps)
1. **RBAC/authorization** — `RolesGuard` and `@Roles()` decorator have **zero tests**
2. **JWT strategy** — `JwtStrategy` (passport-jwt) has **no tests** — token validation, expiry, malformed tokens
3. **Middleware** — `LoggerMiddleware` only tests instantiation (1 test), no behavior verification
4. **Error filtering** — No tests for global exception filter behavior or custom error responses
5. **Input validation** — DTO validation rules (class-validator decorators) are **not tested** at the unit level
6. **Profile image handling** — Image upload/download edge cases are minimally covered
7. **Concurrency** — No race condition tests (e.g., simultaneous call dispatch, upsert races)
8. **Database constraints** — No tests for unique constraint violations at the E2E level beyond single-user
9. **Coverage thresholds** — None configured; current coverage is unknown
10. **CI/CD** — No automated testing in CI; tests must be run manually

---

## 2. Recommended Test Types to Learn

### Unit Tests (Jest) — current focus
**Purpose**: Test individual functions, methods, and classes in isolation.

**Skills to learn**:
- Jest basics: `describe`, `it`, `expect`, `beforeEach`/`beforeAll`, `jest.fn()`
- Mocking with `jest-mock-extended`: `mockDeep<T>()` for Prisma, `mockReset()` between tests
- NestJS `Test.createTestingModule()` for isolated controller/service testing
- Asserting exception throwing: `.rejects.toThrow()`, `.toThrowException()`
- Mocking external services (bcrypt, JWT, Prisma client)

**Current coverage**: Good for services, moderate for controllers, lacking for guards and middleware

### Integration Tests (supertest + NestJS Testing Module)
**Purpose**: Test HTTP endpoint behavior including guards, pipes, interceptors, middleware — without a real database.

**Skills to learn**:
- NestJS `Test.createTestingModule()` with real controllers + mocked services
- `supertest` for HTTP assertions (`.expect(status)`, `.expect(header)`)
- Testing JWT auth flow: login → extract token → use as Bearer
- Testing `@UseGuards(JwtAuthGuard)` — verify 401 without token, 403 with insufficient role
- Testing `ValidationPipe` — invalid DTO payloads → 400
- Testing global prefix, middleware, interceptor behavior

**Note**: The current `api.spec.ts` is actually an integration test (boots real app, connects to real DB). True integration tests use mocked services.

### End-to-End (E2E) Tests (supertest + real database)
**Purpose**: Test the full application stack against a real PostgreSQL database.

**Skills to learn**:
- `setupE2E()` / `teardownE2E()` harness pattern
- Database seeding and cleanup per test suite
- Authentication flow (login → token → use token)
- Test data isolation (unique phone numbers, project names per test run)
- Database transaction rollback strategies for test isolation

**Current coverage**: `api.spec.ts` tests project creation, owner creation, and call flow
- Missing: user management E2E, session E2E, auth flow E2E (login, logout, register)

### Test Categories by What to Learn

| Category | What | Where | Tools |
|----------|------|-------|-------|
| Unit | Service method logic, error handling, data transformation | `*.service.spec.ts` | jest, jest-mock-extended |
| Unit | Controller routing, guards, DTO validation | `*.controller.spec.ts` | @nestjs/testing, jwt-mock |
| Unit | Guard/Strategy authorization logic | `guards/*.guard.spec.ts`, `strategies/*.strategy.spec.ts` | @nestjs/testing, mock-request |
| Unit | Middleware logging behavior | `logger/*.middleware.spec.ts` | mock-request, mock-response |
| Integration | Full HTTP request/response cycle with mocked DB | `integration/**/*.spec.ts` | supertest, Test.createTestingModule |
| E2E | Real database + real HTTP, auth flow | `api.spec.ts`, `e2e/*.e2e-spec.ts` | supertest, real PostgreSQL, prisma db push |

---

## 3. Implementation Plan

### Phase 1: Fix Existing E2E Test Infrastructure (blocking)
**Status**: Required before any E2E tests can be trusted

1. **Fix `e2e/auth.e2e-spec.ts`** — apply same fixes as api.spec.ts:
   - Fix `ReturnType<typeof setupE2E>` → `TestApp['prisma']`
   - Fix `import * as request` → `import request` (or use `TestApp['app']`)
   - Fix endpoint paths: `/auth/login` → `/api/v1/login`, `/users` → `/api/v1/users`
   - Fix login status: `.expect(201)` → `.expect(200)`
   - Fix teardown: `module: {} as any` → real module reference

2. **Fix `e2e/validation.e2e-spec.ts`** — same set of fixes

3. **Verify both e2e-spec files pass** via `npm run test:e2e` with database running

4. **Standardize E2E test pattern**: All E2E tests should use `TestApp` type, store `module` for teardown, use correct `/api/v1/` prefix

### Phase 2: Add Missing Unit Tests for Guards & Security
**Priority**: High — Guards have zero coverage

1. **Test `RolesGuard`** (`src/common/guards/roles.guard.spec.ts`)
   - Should allow when no `@Roles()` decorator present
   - Should allow when user has required role
   - Should deny (403) when user lacks required role
   - Should handle missing user object

2. **Test `JwtAuthGuard`** integration
   - Should reject request without Authorization header (401)
   - Should reject request with invalid token (401)
   - Should pass request with valid token
   - (Integration test with mock JWT service)

3. **Test JWT token flow end-to-end** (unit level)
   - Login returns valid JWT
   - Token payload contains `id`, `email`, `role`
   - Expired token is rejected
   - Malformed token is rejected

### Phase 3: Add Missing Unit Tests for Middleware & Error Handling
**Priority**: Medium

1. **Expand `LoggerMiddleware` tests** (`src/logger/logger.middleware.spec.ts`)
   - Currently 1 test (instantiation only)
   - Add: logs method + URL, logs response time, handles errors
   - Add: skips logging for health check endpoint (if applicable)

2. **Add exception filter tests** (if global filters exist)
   - Test `Prisma.PrismaClientKnownRequestError` → appropriate HTTP status
   - Test `NotFoundException` → 404
   - Test `UnauthorizedException` → 401
   - Test `ConflictException` → 409

### Phase 4: Add Integration Tests (Mocked DB Layer)
**Priority**: High — catches auth/guard/pipe issues without needing real DB

1. **Create `src/integration/` directory** with focused integration tests:
   - `auth.integration.spec.ts` — Login (200, 401), Register (201, 409 duplicate), Logout
   - `owners.integration.spec.ts` — CRUD with auth (200, 201, 401, 403, 404)
   - `owners.validation.spec.ts` — Invalid DTO → 400 (missing phones, invalid type, etc.)
   - `calls.integration.spec.ts` — Call flow with auth, status validation
   - `projects.integration.spec.ts` — CRUD with auth
   - `users.integration.spec.ts` — User list (admin only → 403 for regular user)

2. **Pattern**: `Test.createTestingModule({ controllers: [...], providers: [...] })` with `PrismaService` mocked via `mockDeep`

3. **Run independently**: `npm test -- --testRegex ".*integration.*spec.ts$"`

### Phase 5: Add E2E Tests for Uncovered Flows
**Priority**: Medium — requires database but tests real-world scenarios

1. **Fix and run existing e2e specs** (Phase 1)
2. **Add `users.e2e-spec.ts`**:
   - Admin creates users (201)
   - Regular user cannot list users (403)
   - Duplicate email (409)
   - Profile image upload/download/delete
3. **Add `sessions.e2e-spec.ts`**:
   - Session creation on login
   - Heartbeat extends session
   - Session filtering (agent vs admin)
4. **Add `calls.e2e-spec.ts`**:
   - Full call flow: next → calling → submit
   - Status transitions
   - Status count aggregation

### Phase 6: CI/CD Pipeline & Quality Gates
**Priority**: High — must gate deployment

1. **Create `.github/workflows/test.yml`**:
   ```yaml
   stages: [typecheck, test, coverage, e2e]
   ```
   - **Typecheck**: `npx tsc --noEmit` — fail on any TS error
   - **Unit tests**: `npm test` — must pass (13 unit files)
   - **Unit coverage**: `npm test -- --coverage` — enforce thresholds:
     - Global: 85% lines, 80% branches
     - Per-module thresholds for auth, guards, owners
   - **E2E tests**: Start PostgreSQL container → `npm run test:e2e` → tear down
   - **Security lint**: `npm run build` (catches unused vars, type issues)

2. **Add coverage thresholds** to Jest config in `package.json`:
   ```json
   "coverageThreshold": {
     "global": {
       "branches": 80,
       "functions": 85,
       "lines": 85,
       "statements": 85
     }
   }
   ```

3. **Add pre-commit hook** (if allowed by environment) or AGENTS.md rule:
   - Run `npm test` before any commit
   - Run `npx tsc --noEmit` before any commit

### Phase 7: Testing Best Practices Documentation
**Priority**: Medium — institutional knowledge

1. **Create `server/TESTING.md`**:
   - How to run each test suite (`npm test`, `npm run test:e2e`, `npm run test:all`)
   - How to start the test database (`docker-compose up -d db` + `npx prisma db push`)
   - Test file naming conventions (unit vs integration vs e2e)
   - Mocking patterns (when to use `mockDeep` vs manual mocks)
   - When to write unit vs integration vs e2e
   - Common pitfalls (namespace imports, type inference, endpoint prefix mismatches)

---

## 4. Key Decisions Needed

### 4.1 E2E test classification
The `api.spec.ts` file uses `setupE2E()` which boots a real NestJS app + real PostgreSQL. The `e2e/*.e2e-spec.ts` files do the same. These are both E2E tests in practice, but `api.spec.ts` is in `src/` while `e2e/` specs are in `src/e2e/`.

**Decision**: Should we restructure to have clear separation?
- **Recommended**: Keep current structure. `api.spec.ts` = integration E2E, `src/e2e/` = feature E2E. Run all via `npm run test:all`. Add `src/integration/` for HTTP-layer tests with mocked Prisma.

### 4.2 Test data management
Currently `seed.ts` hardcodes the admin user with a specific bcrypt hash. This couples tests to specific seeded data.

**Decision**: Use **test data factories** (builder pattern) for creating test data instead of hardcoded seed. Seed only the minimum (admin user) needed for auth, let each test create its own data and clean up.

### 4.3 Database isolation strategy
Currently E2E tests run against a single database (`mydb`), cleaning up created records in `afterAll`. This can cause issues if tests run in parallel or fail mid-way.

**Decision**: Use **database transactions per test** or **unique database per test run** (e.g., `test_${date}_${pid}`). For now, keep the current cleanup approach but ensure `afterAll` always runs (try/finally pattern).

### 4.4 RBAC testing gaps
The `RolesGuard` exists but `@Roles()` decorator is never used in any controller. All controllers use `@UseGuards(JwtAuthGuard)` only — admin-only endpoints rely on service-level checks, not the guard.

**Decision**: Audit which endpoints should be admin-only. Add `@Roles('admin')` to those endpoints and test the guard. This is a code change beyond testing — defer to implementation phase.

---

## 5. Validation Plan

| Check | How | When |
|-------|-----|------|
| TypeScript compilation | `npx tsc --noEmit` | CI stage 1 |
| Unit tests (13 files, 167 tests) | `npm test` | CI stage 2 |
| Unit test coverage ≥ 85% | `npm test -- --coverage` | CI stage 3 |
| E2E tests pass with real DB | `npm run test:e2e` (after `docker-compose up -d db` + `prisma db push`) | CI stage 4 |
| No console.error in test output | `jest --silent` or grep output | CI stage 2 (warning threshold) |
| No open handles leaked | `--detectOpenHandles` | CI stage 4 |
| api.yaml matches routing | Manual verification | Pre-deployment |

---

## 6. Open Questions

1. **Q: Should `npm run test:e2e` be the default `npm test`?**
   Currently `npm test` only runs unit tests. E2E tests (with DB) are separate. For CI, we need both. Recommendation: keep separate, run both in CI via `test:all`.

2. **Q: Where should integration tests (mocked DB) live?**
   Suggested: `src/integration/` directory, matched by `.*integration.*spec.ts$` or a separate testScript.

3. **Q: Should we fix the pre-existing uncommitted changes to `owners.service.ts` and `projects.service.ts`?**
   These changes are in the working tree but not committed. They change behavior (e.g., `findById` returning `null` instead of throwing `NotFoundException`). The tests may or may not match. This needs investigation before adding new tests.
