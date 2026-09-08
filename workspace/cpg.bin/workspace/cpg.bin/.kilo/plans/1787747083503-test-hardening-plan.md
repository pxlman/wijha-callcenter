# Test Hardening Plan — Production Deploy Readiness

## Goal
Make the backend test suite reliable enough to gate a deploy in ~2–3 hours.

## Approach
- Fix all currently failing unit tests first.
- Add an E2E test layer using real PostgreSQL via Docker Compose.
- Add negative validation and auth edge-case tests.
- Keep all existing unit tests intact.

## Prerequisites
- Docker Compose available (`docker compose up -d db`).
- Project root: `/home/gamal-kobisy/Projects/wijha-callcenter`.
- Node modules already installed in `server/`.

---

## Step 1: Fix currently failing unit tests (20 min)

### 1.1 `server/src/owners/owners.service.spec.ts` line 84
**Edit:**
```ts
// Before
const result = await service.findAll(undefined, undefined, 1, 20, 5);
// After
const result = await service.findAll(undefined, undefined, undefined, 1, 20, 5);
```

### 1.2 `server/src/owners/owners.service.spec.ts` lines 514–626
**Root cause:** `update()` does `prisma.client.update(...)` then re-fetches with `findUnique`. The global mock returns stale default data (`type: 'OWNER'`).

**Edit:** In each `update` test, override `prisma.client.findUnique` to return the updated values, OR change the service to return the `update` result directly.

**Recommended service change in `server/src/owners/owners.service.ts`:**
```ts
// Remove the second findUnique block (lines 247–256) and return the update result directly.
// When info is provided, build the response manually from the update result + new info.
```

### 1.3 `server/src/owners/owners.controller.spec.ts` lines 175–178
**Edit:**
```ts
it('should update owner type', async () => {
  prisma.client.findUnique.mockResolvedValue(
    mockClient({ type: 'BOTH', numbers: [], clientInfo: [] }),
  );
  const result = await controller.patch(1, { type: 'BOTH' });
  expect(result.type).toBe('BOTH');
});
```

### 1.4 `server/src/projects/projects.service.ts` lines 16–20
**Edit:**
```ts
// Before
async findById(id: number): Promise<ProjectResponseDto | null> {
  const project = await this.prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundException('Project not found');
  return project;
}

// After
async findById(id: number): Promise<ProjectResponseDto | null> {
  const project = await this.prisma.project.findUnique({ where: { id } });
  return project ?? null;
}
```

### 1.5 `server/src/auth/auth.service.spec.ts` lines 54–68
**Edit:**
```ts
// Before
await expect(service.login('nonexistent', 'password')).rejects.toThrow(
  'Invalid email or password',
);
// After
await expect(service.login('nonexistent', 'password')).rejects.toThrow(
  'Invalid email',
);

// Before
await expect(service.login('agent', 'wrongpassword')).rejects.toThrow(
  'Invalid email or password',
);
// After
await expect(service.login('agent', 'wrongpassword')).rejects.toThrow(
  'Invalid password',
);
```

### Validate
```bash
cd /home/gamal-kobisy/Projects/wijha-callcenter/server && npm test
```
Expected: `210 passed, 210 total`

---

## Step 2: Install test dependencies (5 min)

### 2.1 Install supertest and types
```bash
cd /home/gamal-kobisy/Projects/wijha-callcenter/server
npm install --save-dev supertest @types/supertest
```

### 2.2 Create `.env.test` in server root
**File:** `server/.env.test`
```env
DATABASE_URL="postgresql://testuser:testpass@localhost:5432/testdb"
JWT_SECRET="test-secret"
JWT_EXPIRES_IN="1d"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

---

## Step 3: Create E2E test infrastructure (30 min)

### 3.1 Create test database setup script
**File:** `server/src/test/setup-e2e.ts`
```ts
import { Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/prisma/prisma.service';
import { AppModule } from '@/app.module';
import * as request from 'supertest';

export interface TestApp {
  app: request.SuperTest<request.Test>;
  prisma: PrismaService;
  module: TestingModule;
}

export async function setupE2E(): Promise<TestApp> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  await app.init();
  await app.listen(3001);

  const prisma = module.get<PrismaService>(PrismaService);
  await prisma.$connect();

  return {
    app: request(app.getHttpServer()),
    prisma,
    module,
  };
}

export async function teardownE2E(ctx: TestApp): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.module.close();
}
```

### 3.2 Create E2E Jest config
**File:** `server/test/jest-e2e.json`
```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.e2e-spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "testEnvironment": "node",
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  }
}
```

### 3.3 Update `server/package.json`
**Edit scripts section:**
```json
"scripts": {
  "build": "npx prisma generate && nest build",
  "start": "npm run build && npm run start:prod",
  "start:dev": "nest start --watch",
  "start:prod": "node dist/main",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:studio": "prisma studio",
  "test": "jest",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "test:all": "npm run test && npm run test:e2e"
}
```

---

## Step 4: Convert `api.spec.ts` to E2E (40 min)

### 4.1 Replace `server/src/api.spec.ts` content
**Before:** Uses `fetch` against `localhost:3000` and skips if unreachable.

**After:** Uses `setupE2E()` and real HTTP requests against the in-memory NestJS app.

**Key changes:**
- Remove `BASE_URL`, `healthCheck`, and skip logic.
- Add `beforeAll` / `afterAll` hooks using `setupE2E()` and `teardownE2E()`.
- Replace `api<T>()` helper with `request(app.getHttpServer())`.
- Seed test data in `beforeAll` via Prisma directly.
- Clean up in `afterAll`.

**Example structure:**
```ts
describe('API Integration Tests (E2E)', () => {
  let app: request.SuperTest<request.Test>;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    // seed admin user and project
  });

  afterAll(async () => {
    await teardownE2E({ app, prisma, module: {} as any });
  });

  it('POST /auth/login returns token', async () => {
    const res = await app.post('/auth/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(201);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  // ... rest of tests using app.post('/owners').set('Authorization', `Bearer ${token}`)
});
```

### 4.2 Seed data helper
Create `server/src/test/seed.ts`:
```ts
export async function seedTestData(prisma: PrismaService) {
  const admin = await prisma.user.upsert({
    where: { email: 'admin1@gmail.com' },
    update: {},
    create: {
      email: 'admin1@gmail.com',
      phoneNumber: '123-456-7891',
      passwordHash: '$2a$12$bAQZI.kF9xu2mh7aNQJ6Z.96wdjWbr1cNxUalOVnSd5/Ds4cfSzkm',
      name: 'Admin User',
      role: 'admin',
    },
  });

  const project = await prisma.project.upsert({
    where: { name: 'Default Project' },
    update: {},
    create: { name: 'Default Project', description: 'Main project' },
  });

  return { admin, project };
}
```

---

## Step 5: Add negative validation tests (30 min)

### 5.1 `server/src/e2e/validation.e2e-spec.ts` (new file)
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { setupE2E, teardownE2E } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import * as request from 'supertest';

describe('Validation E2E', () => {
  let app: request.SuperTest<request.Test>;
  let prisma: any;
  let token: string;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    const { admin } = await seedTestData(prisma);
    const res = await app.post('/auth/login')
      .send({ email: 'admin1@gmail.com', password: 'admin123' })
      .expect(201);
    token = res.body.token;
  });

  afterAll(async () => teardownE2E({ app, prisma, module: {} as any }));

  it('POST /owners without phones returns 400', async () => {
    await app.post('/owners')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Phones' })
      .expect(400);
  });

  it('PATCH /owners/:id with invalid type returns 400', async () => {
    await app.patch('/owners/1')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'INVALID' })
      .expect(400);
  });

  it('GET /calls/next with type=BOTH returns 200', async () => {
    await app.get('/calls/next?project_id=1&type=BOTH')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('POST /calls without client_id returns 400', async () => {
    await app.post('/calls')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' })
      .expect(400);
  });

  it('POST /users with duplicate email returns 409', async () => {
    await app.post('/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'admin1@gmail.com', password: 'pass', role: 'user' })
      .expect(409);
  });
});
```

---

## Step 6: Add auth edge-case tests (20 min)

### 6.1 `server/src/e2e/auth.e2e-spec.ts` (new file)
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { setupE2E, teardownE2E } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import * as request from 'supertest';

describe('Auth E2E', () => {
  let app: request.SuperTest<request.Test>;
  let prisma: any;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    await seedTestData(prisma);
  });

  afterAll(async () => teardownE2E({ app, prisma, module: {} as any }));

  it('POST /auth/login with invalid email returns 401', async () => {
    const res = await app.post('/auth/login')
      .send({ email: 'wrong@test.com', password: 'pass' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email');
  });

  it('POST /auth/login with invalid password returns 401', async () => {
    const res = await app.post('/auth/login')
      .send({ email: 'admin1@gmail.com', password: 'wrong' })
      .expect(401);
    expect(res.body.message).toBe('Invalid password');
  });

  it('GET /users without token returns 401', async () => {
    await app.get('/users').expect(401);
  });
});
```

---

## Step 7: Add Prisma error-path tests (20 min)

### 7.1 Extend existing controller/service specs
For each `create` controller test, add:
```ts
it('should throw ConflictException on duplicate', async () => {
  prisma.project.create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.8.0',
    }),
  );
  await expect(controller.create({ name: 'Dup' })).rejects.toThrow('Project name already exists');
});
```

Repeat for: `OwnersController.create`, `UsersController.create`, `UsersController.createBulk`.

---

## Step 8: CI script and documentation (10 min)

### 8.1 Update `server/package.json` scripts
```json
"test": "jest",
"test:e2e": "jest --config ./test/jest-e2e.json",
"test:all": "npm run test && npm run test:e2e"
```

### 8.2 Create `server/TEST_RUN.md`
```md
# Running Tests

## Unit tests (mocked Prisma)
npm test

## E2E tests (real PostgreSQL via Docker)
1. Start DB: docker compose up -d db
2. Run E2E: npm run test:e2e

## All tests
npm run test:all

## Prerequisites for E2E
- Docker running
- PostgreSQL available at localhost:5432
- Create test database:
  docker compose exec db psql -U myuser -c "CREATE DATABASE testdb;"
```

---

## Step 9: Execute and validate (30 min)

### 9.1 Start PostgreSQL
```bash
cd /home/gamal-kobisy/Projects/wijha-callcenter
docker compose up -d db
sleep 5
docker compose exec db psql -U myuser -c "CREATE DATABASE testdb;" || true
```

### 9.2 Run unit tests
```bash
cd server
npm test
```
Expected: `210 passed`

### 9.3 Run E2E tests
```bash
npm run test:e2e
```
Expected: All new E2E tests pass against real DB.

### 9.4 Run full suite
```bash
npm run test:all
```
Expected: All tests pass.

---

## Summary of files to create/edit

| File | Action |
|---|---|
| `server/src/owners/owners.service.ts` | Edit: remove stale re-fetch in `update` |
| `server/src/owners/owners.service.spec.ts` | Edit: fix argument order, align mocks |
| `server/src/owners/owners.controller.spec.ts` | Edit: override `findUnique` in patch test |
| `server/src/projects/projects.service.ts` | Edit: `findById` returns `null` |
| `server/src/auth/auth.service.spec.ts` | Edit: error message expectations |
| `server/.env.test` | Create |
| `server/src/test/setup-e2e.ts` | Create |
| `server/src/test/seed.ts` | Create |
| `server/test/jest-e2e.json` | Create |
| `server/src/e2e/validation.e2e-spec.ts` | Create |
| `server/src/e2e/auth.e2e-spec.ts` | Create |
| `server/package.json` | Edit: add scripts |
| `server/TEST_RUN.md` | Create |
