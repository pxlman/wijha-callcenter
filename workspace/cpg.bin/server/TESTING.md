# Testing Guide — Call Center Broker API

## Overview

This project has a **three-tier testing strategy**:

| Tier | File Pattern | Runner | Database | Purpose |
|------|-------------|--------|----------|---------|
| **Unit** | `*.spec.ts` (not `*.e2e-spec.ts`) | `jest` | Mocked | Individual classes/methods with `mockDeep` |
| **Integration** | `*.integration.spec.ts` | `jest` | Mocked | HTTP layer with real guards/pipes, mocked Prisma |
| **E2E** | `*.e2e-spec.ts` | `jest --config ./test/jest-e2e.json` | Real PostgreSQL | Full app with real database |

**Current totals**: 260 tests — 252 unit/integration + 8 E2E, all passing.

---

## How to Run Tests

### Unit + Integration Tests (no database required)

```bash
cd server
npm test                          # Run all *.spec.ts files (unit + integration)
npm test -- --watch               # Watch mode
npm test -- src/path/file.spec.ts # Run a single test file
npm test -- --coverage            # Run with coverage report (enforces thresholds)
npm run test:coverage             # Same as above (shorthand)
npm run test:integration          # Run only integration tests
```

### E2E Tests (requires PostgreSQL)

```bash
# 1. Start PostgreSQL
cd /home/gamal-kobisy/Projects/wijha-callcenter
docker-compose up -d db

# 2. Deploy schema (only needed if schema changed)
cd server
npx prisma db push

# 3. Run E2E tests
npm run test:e2e

# Run all tests (unit + integration + E2E):
npm run test:all

# Run a single E2E file:
npx jest --config ./test/jest-e2e.json src/e2e/auth.e2e-spec.ts
```

---

## Database Setup

### Local Development

The project uses Docker Compose for PostgreSQL:

```bash
cd /home/gamal-kobisy/Projects/wijha-callcenter
docker-compose up -d db
```

Connection details (from `server/.env`):
```
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb"
```

### Schema Management

```bash
cd server
npx prisma generate                               # Regenerate Prisma client
npx prisma db push --schema=prisma/schema.prisma --accept-data-loss  # Push schema (dev only)
npx prisma studio                                  # Open GUI for data browsing
```

### Seeding

Seed data is in `server/prisma/seed.sql`:
- `admin1@gmail.com` / `admin123` (role: admin)
- `agent1@gmail.com` / `agent123` (role: user)

To seed the database:
```bash
PGPASSWORD=mypassword psql -h localhost -U myuser -d mydb -f server/prisma/seed.sql
```

Or programmatically via `seedTestData(prisma)` in `src/test/seed.ts` (used by E2E tests).

---

## Test File Inventory

### Unit Test Files (17 files, 237 tests)

| File | Tests | What's Tested |
|------|-------|---------------|
| `auth/auth.service.spec.ts` | 7 | login, validateUserWithToken, logout, getMe |
| `auth/auth.controller.spec.ts` | 5 | login endpoint, me endpoint, logout endpoint |
| `common/guards/roles.guard.spec.ts` | 7 | RBAC allow/deny logic, missing user |
| `log/logger.middleware.spec.ts` | 12 | Method/URL logging, body/query/params, response time, next() |
| `owners/owners.service.spec.ts` | 18 | Create, merge, update, remove, getNextOwner, statuses |
| `owners/owners.controller.spec.ts` | 16 | CRUD, assign, bulk, statuses |
| `projects/projects.service.spec.ts` | 13 | CRUD, conflict handling |
| `projects/projects.controller.spec.ts` | 9 | CRUD, RBAC on delete |
| `calls/calls.service.spec.ts` | 19 | Submit, find, statuses, getNextOwner |
| `calls/calls.controller.spec.ts` | 16 | Call flow, filtering, query params |
| `sessions/sessions.service.spec.ts` | 9 | Create, merge, beat |
| `sessions/sessions.controller.spec.ts` | 3 | List, create, heartbeat |
| `users/users.service.spec.ts` | 18 | CRUD, stats, profile images |
| `users/users.controller.spec.ts` | 15 | CRUD, RBAC, profile images |
| `auth/strategies/jwt.strategy.spec.ts` | 5 | Token validation, revocation, missing header |
| `src/integration/auth.integration.spec.ts` | 8 | Login, register, logout, auth flow |
| `src/integration/users.integration.spec.ts` | 7 | RBAC: admin allows, user denies, no-token denies |

### E2E Test Files (9 files, ~100 tests)

| File | Tests | What's Tested |
|------|-------|---------------|
| `e2e/auth.e2e-spec.ts` | 10 | Login, register, logout, me endpoint |
| `e2e/api.e2e-spec.ts` | 5 | Full call dispatch flows, callback, not-interested |
| `e2e/calls.e2e-spec.ts` | 18 | Call CRUD, next dispatch, calling notify, statuses |
| `e2e/owners.e2e-spec.ts` | 18 | Owner CRUD, bulk, assign, statuses, merge |
| `e2e/projects.e2e-spec.ts` | 10 | Project CRUD, duplicate, RBAC delete |
| `e2e/security.e2e-spec.ts` | 6 | JWT tampering, expired tokens, malformed headers |
| `e2e/sessions.e2e-spec.ts` | 7 | Session list, create, merge, heartbeat |
| `e2e/users.e2e-spec.ts` | 18 | User CRUD, profile image, stats, deactivate |
| `e2e/validation.e2e-spec.ts` | 5 | DTO validation, missing fields, duplicate email |

---

## Jest Configuration

### Unit Tests (`package.json` jest section)

```json
{
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": [
    "**/*.(t|j)s",
    "!**/*.spec.ts",
    "!**/*.e2e-spec.ts",
    "!**/dto/**",
    "!**/interfaces/**",
    "!**/mock-data.ts"
  ],
  "coverageDirectory": "../coverage",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" },
  "coverageThreshold": {
    "global": {
      "branches": 75,
      "functions": 80,
      "lines": 85,
      "statements": 80
    }
  }
}
```

- `rootDir` is `src` (relative to `server/package.json`, so it's `server/src/`)
- Matches all `*.spec.ts` files (including `*.integration.spec.ts`)
- Coverage excludes test files, DTOs, interfaces, and mock-data
- `coverageThreshold` enforces minimum coverage — CI will fail if thresholds not met

### E2E Tests (`test/jest-e2e.json`)

```json
{
  "rootDir": "../src",
  "testRegex": ".*\\.e2e-spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "testEnvironment": "node",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/$1" }
}
```

- `rootDir` is `../src` (relative to `test/jest-e2e.json`, so it's `server/src/`)
- Only matches `*.e2e-spec.ts` files
- Run via: `npm run test:e2e` or `npx jest --config ./test/jest-e2e.json`

### npm Scripts

| Script | Command | What it runs |
|--------|---------|-------------|
| `npm test` | `jest` | All `*.spec.ts` (unit + integration) |
| `npm run test:e2e` | `jest --config ./test/jest-e2e.json` | All `*.e2e-spec.ts` |
| `npm run test:all` | `npm run test && npm run test:e2e` | Both unit and E2E |
| `npm run test:coverage` | `jest --coverage` | Unit tests with coverage + thresholds |
| `npm run test:integration` | `jest --testPathPattern integration` | Only integration tests |

---

## Patterns for Writing Tests

### Unit Test Pattern (mocked Prisma)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { YourService } from './your.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUser } from '@/prisma/mock-data';

describe('YourService', () => {
  let service: YourService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    // $transaction needs special handling — pass the mock itself as tx
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YourService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<YourService>(YourService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Example: mock return value
  it('should return user by id', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser({ id: 1, email: 'test@example.com' }));
    const result = await service.findById(1);
    expect(result).not.toBeNull();
    expect(result!.email).toBe('test@example.com');
  });
});
```

**Key conventions:**
- Use `mockDeep<PrismaService>()` for mocking Prisma
- Use absolute imports (`@/`) per AGENTS.md
- For `findMany`/`groupBy`/etc. that need custom logic: cast to `jest.Mock`:
  `(prisma.someMethod as jest.Mock).mockImplementation(...)`
- Mock `$transaction` with: `prisma.$transaction.mockImplementation(async (cb) => cb(prisma))`
- Reference mock data from `@/prisma/mock-data` (`mockUser`, `mockClient`, `mockProject`, `mockCallRecord`, etc.)
- Override guards in controller tests: `.overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })`
- Mock bcryptjs at file level if needed: `jest.mock('bcryptjs')`

### Integration Test Pattern (real guards/pipes, mocked Prisma)

Integration tests in `src/integration/` use the full NestJS app (real routers,
guards, pipes, strategies) but with PrismaService mocked. No PostgreSQL needed.

```typescript
import { setupIntegrationTest, teardownIntegrationTest } from './integration-helpers';

describe('Feature Integration', () => {
  let app, prisma, moduleRef, appInstance;

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

  it('GET /api/v1/users without token returns 401', async () => {
    await app.get('/api/v1/users').expect(401);
  });
});
```

The helper (`integration-helpers.ts`) sets up:
- `AppModule` with `PrismaService` overridden by `mockDeep`
- Real `JwtAuthGuard`, `JwtStrategy`, `RolesGuard`
- `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- Dynamic token store for login → validation flow

### E2E Test Pattern (real DB + real app)

```typescript
import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';

describe('Feature E2E', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let token: string;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    await seedTestData(prisma);

    const res = await app.post('/api/v1/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(200);
    token = res.body.token;
  });

  afterAll(async () => {
    await teardownE2E({ app, prisma, module: testModule });
  });
});
```

---

## Mock Data Helpers (`src/prisma/mock-data.ts`)

| Factory | Returns | Key Fields |
|---------|---------|------------|
| `mockUser(overrides?)` | User object | id, email, phoneNumber, passwordHash, name, role, jwtToken, profileImage |
| `mockClient(overrides?)` | Client object | id (bigint), name, type, phones, clientInfo, nextDialAt, agentId |
| `mockProject(overrides?)` | Project object | id, name, description |
| `mockCallRecord(overrides?)` | CallDetailRecord | id, clientId, agentId, status, time, duration, agentNotes |
| `mockUserSession(overrides?)` | UserSession | agentId, firstBeat, lastBeat, duration |
| `mockNumber(overrides?)` | Number | number, clientId |
| `mockClientInfo(overrides?)` | ClientInfo | key, clientId, value |

Usage:
```typescript
const user = mockUser({ id: 5, email: 'agent5@test.com', role: 'admin' });
const client = mockClient({ id: 1n, name: 'John Doe', type: 'OWNER' });
const call = mockCallRecord({ id: 1n, status: 'completed', duration: 120 });
```

---

## Common Pitfalls

1. **Namespace imports**: Never use `import * as request from 'supertest'`. Use
   `import request from 'supertest'` or use the `TestApp['app']` type from setup-e2e.

2. **Endpoint prefix**: All API routes are under the global prefix `api/v1` (set in `main.ts`
   and `setup-e2e.ts`). So `/login` → `/api/v1/login`, `/owners` → `/api/v1/owners`.

3. **Login status code**: `POST /api/v1/login` returns **200** (configured with `@HttpCode(HttpStatus.OK)`), NOT 201.
   Register returns **201**.

4. **All endpoints require auth**: `Authorization: Bearer ${token}` header. Login with seeded admin: `admin1@gmail.com` / `admin123`.

5. **Teardown must use the real module**: `teardownE2E({ app, prisma, module: testModule })` — never `module: {} as any`.

6. **ValidationPipe**: Configured with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
   Unknown properties → 400. Password fields require `@MinLength(6)`.

7. **BigInt IDs**: Client/owner IDs are `BigInt` in the database. Use `1n` (bigint literal) in mocks.

8. **Phone validation**: `OwnerPhoneDto` uses `@IsPhoneNumber('EG')` — phone numbers must be valid
   Egyptian phone numbers (e.g., `+201012345678`).

9. **bcryptjs**: In unit tests, `bcryptjs` is typically mocked (`jest.mock('bcryptjs')`). In integration
   and E2E tests, real bcryptjs is used — so tests involving password hashing are slower but realistic.

10. **Test isolation**: Unit tests mock at the module level. Integration tests use `beforeEach`/`afterEach`
    to create and tear down the app. E2E tests use `beforeAll`/`afterAll` and seed/cleanup.

---

## CI/CD Pipeline

The CI pipeline (`.github/workflows/test.yml`) runs four stages in parallel:

| Stage | Command | Purpose |
|-------|---------|---------|
| **Typecheck** | `npx tsc --noEmit` | Fail on any TypeScript error |
| **Unit Tests** | `npm test -- --coverage` | Run unit tests + enforce coverage thresholds |
| **E2E Tests** | `npm run test:e2e` | Run end-to-end tests against PostgreSQL |
| **Build** | `npm run build` | Verify production build succeeds |

Each test stage spins up a PostgreSQL 16 container, deploys the schema, and seeds data.
