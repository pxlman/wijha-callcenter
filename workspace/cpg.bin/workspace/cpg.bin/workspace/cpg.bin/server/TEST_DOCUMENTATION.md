<div align="center">
  <h1>🧪 Test Suite Documentation</h1>
  <p>
    <img src="https://img.shields.io/badge/total-260_tests-blue?style=for-the-badge&logo=jest&labelColor=1a1a2e" alt="260 tests"/>
    <img src="https://img.shields.io/badge/status-all_passing-success?style=for-the-badge&logo=checkmarx&labelColor=1a1a2e" alt="all passing"/>
    <img src="https://img.shields.io/badge/spec_files-20-important?style=for-the-badge&logo=typescript&labelColor=1a1a2e" alt="20 spec files"/>
  </p>
  <p><em>⚠️ This document is deprecated. See <a href="TESTING.md">TESTING.md</a> for the current testing guide.</em></p>
</div>

---

## 📊 Summary

| Module | Spec File | Tests | Coverage |
|-------:|-----------|------:|:--------:|
| 🔐 | `auth.controller` | 4 | Login, logout, me |
| 🔐 | `auth.service` | 8 | Login, token validation |
| 📞 | `calls.controller` | 12 | CRUD, filtering, next-call |
| 📞 | `calls.service` | 24 | Submission, status, dispatch |
| 📝 | `logger.middleware` | 1 | Instantiation |
| 👤 | `owners.controller` | 11 | CRUD, pagination, assignment |
| 👤 | `owners.service` | 27 | CRUD, upsert, merge, dispatch |
| 📦 | `projects.controller` | 3 | List, find |
| 📦 | `projects.service` | 3 | List, find |
| ⏱️ | `sessions.controller` | 3 | List, create, heartbeat |
| ⏱️ | `sessions.service` | 11 | Filter, merge, beat |
| 👥 | `users.controller` | 15 | CRUD, profile image |
| 👥 | `users.service` | 22 | CRUD, bulk, stats, images |
| | **Total** | **260** | |

---

## 📋 Current Test Inventory

| Test Type | Files | Tests | Runner |
|-----------|-------|------:|--------|
| Unit | 16 `*.spec.ts` | 237 | `npm test` |
| Integration | 2 `*.integration.spec.ts` | 15 | `npm test` |
| E2E | 2 `*.e2e-spec.ts` | 8 | `npm run test:e2e` |
| **Total** | **20** | **260** | |

See `TESTING.md` for full documentation.

---

## 🔐 Auth Module

### `src/auth/auth.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T001 | **should be defined** | Controller instantiates correctly | `controller` defined |
| T002 | **should login with valid credentials** | Login returns token + user for valid email/password | Result has `token` and `user` with matching email |
| T003 | **should throw on invalid credentials** | User not found throws error | Call throws |
| T004 | **should return logout message** | Logout with valid user (token revocation fails) | Call throws |
| T005 | **should return authenticated user** | `getMe` maps user fields correctly | Response has id, email, role, name, phone, has_profile_image |

### `src/auth/auth.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T006 | **should be defined** | Service instantiates correctly | `service` defined |
| T007 | ✅ **login: valid credentials** | Returns token + user without passwordHash | Token present, user without `passwordHash` |
| T008 | ⚠️ **login: invalid email** | User not found | `UnauthorizedException('Invalid email or password')` |
| T009 | ⚠️ **login: invalid password** | bcrypt compare returns false | `UnauthorizedException('Invalid email or password')` |
| T010 | ✅ **validateUserWithToken: token matches** | Stored jwtToken matches | User object with id, email, role |
| T011 | ⚠️ **validateUserWithToken: token mismatch** | Stored jwtToken differs | `null` |
| T012 | ⚠️ **validateUserWithToken: token null** | User logged out (jwtToken = null) | `null` |
| T013 | ⚠️ **validateUserWithToken: invalid id** | User not found | `null` |

---

## 📞 Calls Module

### `src/calls/calls.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T014 | **should be defined** | Controller instantiates correctly | `controller` defined |
| T015 | **GET /calls: returns all** | No filters → returns all records | 3 results |
| T016 | **GET /calls: filter by client_id** | Filter by `client_id: '1'` | 3 results |
| T017 | **GET /calls: filter by status** | Filter by `status: 'completed'` | 3 results |
| T018 | **GET /calls: filter by agent_id** | Filter by `agent_id: '1'` | 3 results |
| T019 | **POST /calls: submit** | Submit call with all fields | `client_id`, `agent_id`, `status` match input |
| T020 | **GET /calls/next: returns owner** | Next-owner with past calls | Owner with id 1, name, phones, 2 calls |
| T021 | **GET /calls/next: passes date** | Date param forwarded to service | Non-null result |
| T022 | **GET /calls/statuses** | Status aggregation | Array of `{ status, count }` |
| T023 | **GET /calls/statuses: from/to** | Date range filtering | Filtered results, correct count |
| T024 | **POST /calls/calling: notify** | Notify calling with client_id + project_id | Resolves to `undefined` |
| T025 | **POST /calls/calling: with number** | Notify calling with `client_number` | Resolves to `undefined` |
| T026 | **GET /calls/:callId: found** | Find by existing id | Non-null, status `'completed'` |
| T027 | **GET /calls/:callId: not found** | Find by non-existent id | `null` |

### `src/calls/calls.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T028 | **should be defined** | Service instantiates correctly | `service` defined |
| T029 | **findAll: returns all** | 2 records mocked | `data` length 2, `meta.total` 2, projects mapped |
| T030 | **findAll: filter by client_id** | 1 record with matching clientId | 1 result, `client_id` matches |
| T031 | **findAll: filter by status** | No matching records | 0 results |
| T032 | **findAll: filter by date range** | from/to dates applied | 1 result, verify `findMany` called with `{ gte, lte }` |
| T033 | **findAll: filter by agent_id** | agentId filter forwarded | 1 result, verify filter on `agentId: 2` |
| T034 | **findAll: filter by project_id** | Nested client projects filter | 1 result, verify `client.clientProjects.some.projectId` |
| T035 | **findById: found** | Existing record | Non-null, status `'completed'`, projects mapped |
| T036 | **findById: not found** | Non-existent id | `null` |
| T037 | **submit: creates record** | New call with all fields | `status` = 'busy', `agent_id` = 1, projects empty |
| T038 | **submit: optional fields** | No duration/notes | `duration` and `agent_notes` = `null` |
| T039 | **submit: updates ClientProject** | Status 'answered' | `clientProject.update` called with status 'answered' + date |
| T040 | **submit: sets nextDialAt NOW** | Non-callback status | `client.update` with `nextDialAt` date |
| T041 | **submit: sets nextDialAt callback** | Status 'callback' with time | `client.update` with specified callback time |
| T042 | ⚠️ **submit: not_interested → inactive** | Status 'not_interested' | `ownersService.update(1, { type: 'inactive' })` |
| T043 | ⚠️ **submit: contacted → inactive** | Status 'contacted' | `ownersService.update(1, { type: 'inactive' })` |
| T044 | ✅ **submit: other statuses unchanged** | Status 'busy' | `ownersService.update` NOT called |
| T045 | **getNextOwner: returns owner** | Owner found with past calls | Non-null, name 'John Doe', 1 call with projects |
| T046 | **getNextOwner: none available** | No matching owner | `null` |
| T047 | **getNextOwner: date filter** | Date forwarded to ownersService | Called with `{ projectId, date }` |
| T048 | **getStatusCounts: normalization** | Whitespace + case variations | Normalized `{ status, count }` array |
| T049 | **getStatusCounts: time range** | from/to date filter | Filtered, verify `groupBy` called with range |
| T050 | **getStatusCounts: empty** | No records | Empty array |
| T051 | **notifyCalling: resolves** | Basic call | Resolves to `undefined` |
| T052 | **notifyCalling: updates nextDialAt** | Client update | `client.update` with `nextDialAt` date |
| T053 | **notifyCalling: increments attempts** | ClientProject update | `lastDialedAt` + `attemptCount: { increment: 1 }` |
| T054 | **notifyCalling: client_number filter** | Number filter in where clause | Where includes `numbers.some.number` |

---

## 📝 Logger Module

### `src/logger/logger.middleware.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T055 | **should be defined** | Middleware instantiates | Instance defined |

---

## 👤 Owners Module

### `src/owners/owners.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T056 | **should be defined** | Controller instantiates | `controller` defined |
| T057 | **GET /owners: paginated** | Empty filter → paginated response | 2 results, `meta.total` present |
| T058 | **GET /owners: filter by status** | `status: 'active'` filter | 2 results |
| T059 | **GET /owners: pagination params** | `limit=1, page=1` | 1 result, `meta.limit` = 1 |
| T060 | **POST /owners: create** | With phones + info + project | Name, 1 phone, 1 info item |
| T061 | **POST /owners: explicit type** | `type: 'LEAD'` | `type` = 'LEAD' |
| T062 | **POST /owners/bulk** | 2 entries | 2 results, matching names |
| T063 | **GET /owners/:ownerId: found** | Existing id | Non-null, name 'John Doe' |
| T064 | **GET /owners/:ownerId: not found** | Non-existent id | `null` |
| T065 | **PATCH /owners/:ownerId** | Update type to 'BOTH' | `type` = 'BOTH' |
| T066 | **POST /owners/:ownerId/projects** | Assign to project | Result has `id`, name 'John' |
| T067 | **GET /owners/statuses** | Raw query mocked | Array of `{ status, count }` |
| T068 | **DELETE /owners/:ownerId** | Delete existing owner | Resolves, `prisma.client.delete` called |

### `src/owners/owners.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T069 | **should be defined** | Service instantiates | `service` defined |
| T070 | **findAll: paginated** | 1 client | 1 result, `meta.total` = 1 |
| T071 | **findAll: type filter** | `type: 'OWNER'` | 0 results, `meta.total` = 0 |
| T072 | **findAll: type + project_id** | Combined filter | Where clause has both `type` and `clientProjects` |
| T073 | **findAll: project_id filter** | Project id filter | Where has `clientProjects.some.projectId` |
| T074 | **findById: with relations** | 2 numbers, 1 info | Name 'John Doe', 2 phones, 1 info |
| T075 | **findById: not found** | Non-existent | `null` |
| T076 | **create: with numbers + info** | Full create | Name, phones, info match input |
| T077 | ⚠️ **create: defaults type** | No type provided | `type` = 'OWNER' (default) |
| T078 | **create: explicit LEAD** | `type: 'LEAD'` | `type` = 'LEAD' |
| T079 | **create: explicit BOTH** | `type: 'BOTH'` | `type` = 'BOTH' |
| T080 | ⚠️ **create: duplicate phone (merge)** | Existing number → existing name kept | `client.create` NOT called, `client.update` called |
| T081 | ⚠️ **create: longer name wins** | New name longer → replace | Name = 'Much Longer Name' |
| T082 | ⚠️ **create: fills null name** | Existing name null → new name set | Name = 'New Name' |
| T083 | ⚠️ **create: adds new numbers/info** | Merge with additional data | 2 phones, 2 info items |
| T084 | **createBulk: multiple** | 2 entries | 2 results, matching names |
| T085 | ⚠️ **createBulk: duplicate in bulk** | Second entry shares phone | Merged, 2 phones |
| T086 | ⚠️ **createBulk: rollback on error** | Second creation fails | Error propagated |
| T087 | **createBulk: type field** | Mixed LEAD + default OWNER | Types match input |
| T088 | **assignToProject: success** | Valid owner + project | Result name 'John' |
| T089 | ⚠️ **assignToProject: owner not found** | Non-existent client | `NotFoundException('Client not found')` |
| T090 | ⚠️ **assignToProject: project not found** | Non-existent project | `NotFoundException('Project "NoProject" not found')` |
| T091 | **assignToProject: upsert defaults** | Default status/attemptCount | `upsert` with `status: 'dial'`, `attemptCount: 0` |
| T092 | **update: type field** | Change type to 'LEAD' | `type` = 'LEAD' |
| T093 | **update: next_dial_at** | Set future date | ISO date string, verify Prisma call |
| T094 | **update: clear next_dial_at** | Set to null | `next_dial_at` = null |
| T095 | ⚠️ **update: not found** | Non-existent id | `NotFoundException('Client not found')` |
| T096 | **remove: existing** | Delete by id | `prisma.client.delete` called |
| T097 | ⚠️ **remove: not found** | Non-existent id | `NotFoundException('Client not found')` |
| T098 | **getStatusCounts: results** | Raw query with counts | `[{ active: 5 }, { inactive: 3 }]` |
| T099 | **getStatusCounts: empty** | No owners | Empty array |
| T100 | **getNextOwner: found** | Raw query returns ID | Client with name 'John' |
| T101 | **getNextOwner: none** | No matching rows | `null` |

---

## 📦 Projects Module

### `src/projects/projects.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T102 | **should be defined** | Controller instantiates | `controller` defined |
| T103 | **GET /projects: all** | Returns all projects | 1 result, name 'Default Project' |
| T104 | **GET /projects/:id: found** | Existing project | Non-null, name 'Default Project' |
| T105 | **GET /projects/:id: not found** | Non-existent project | `null` |

### `src/projects/projects.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T106 | **should be defined** | Service instantiates | `service` defined |
| T107 | **findAll: all** | 1 project | Name 'Default Project' |
| T108 | **findById: found** | Existing project | Non-null, name 'Test' |
| T109 | **findById: not found** | Non-existent | `null` |

---

## ⏱️ Sessions Module

### `src/sessions/sessions.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T110 | **should be defined** | Controller instantiates | `controller` defined |
| T111 | **GET /sessions: current user** | Filter by current user | 2 results, each with `is_active` and `duration` |
| T112 | **POST /sessions: create** | Create with timestamps | `agent_id` = 1, `is_active` = false, `duration` = 1800 |
| T113 | **POST /sessions/active: heartbeat** | Active session with fake timers | `is_active` = true, `duration` = 0 |

### `src/sessions/sessions.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T114 | **should be defined** | Service instantiates | `service` defined |
| T115 | **findAll: regular user** | Only own sessions | 2 results, `is_active` computed, filter on `agentId` |
| T116 | **findAll: admin filter by user_id** | Admin can filter others | Prisma filter on `agentId: 5` |
| T117 | **findAll: admin filter by date** | from/to on first_beat | Prisma date range filter |
| T118 | **findAll: admin filter by time** | BETWEEN first_beat AND last_beat | Prisma `firstBeat <= time` and `lastBeat >= time` |
| T119 | **create: no overlap** | New isolated session | Timestamps match, `is_active` = false, duration 1800 |
| T120 | **create: merge overlapping** | 1 overlapping session | Merged, extended first/last beat, cumulative duration |
| T121 | **create: merge active session** | Overlap with active | `is_active` = true, `activeSession.upsert` called |
| T122 | **create: merge multiple** | 2 overlapping sessions | Earliest first_beat, latest last_beat, cumulative duration |
| T123 | **beat: new session** | No recent session | New, `is_active` = true, duration 0, `upsert` called |
| T124 | **beat: extend existing** | Recent session exists | `last_beat` updated, duration recalculated |
| T125 | **beat: no activeSession touch** | Extending extension | `upsert` NOT called, `create` NOT called |

---

## 👥 Users Module

### `src/users/users.controller.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T126 | **should be defined** | Controller instantiates | `controller` defined |
| T127 | **GET /users: all** | No filters | 2 results, first `is_online` = true, second false |
| T128 | **GET /users: filter by role** | `role: 'admin'` | 1 result, role 'admin' |
| T129 | **POST /users: create** | New user | `id` = 3, email matches, `is_online` = false |
| T130 | **POST /users/bulk** | 2 users | 2 results, emails match, `is_online` = false |
| T131 | **GET /users/:id: found** | Existing user | Non-null, email 'agent', `is_online` = true |
| T132 | **GET /users/:id: not found** | Non-existent | `null` |
| T133 | **PATCH /users/:id** | Update name | `name` = 'Updated' |
| T134 | **DELETE /users/:id: deactivate** | Deactivate user | `role` = 'deactivated', `is_online` = false |
| T135 | **GET /users/:id/stats** | Call + session stats | Non-null, `total_calls` present |
| T136 | **POST /users/:id/profile-image: upload** | Upload image | `has_profile_image` = true |
| T137 | ⚠️ **POST profile-image: forbidden user** | Mismatched user ids | `ForbiddenException` |
| T138 | ⚠️ **POST profile-image: no file** | Null file | `BadRequestException('No file provided')` |
| T139 | **GET /users/:id/profile-image: binary** | Return image | Response `set` + `send` called |
| T140 | **GET /users/:id/profile-image: 404** | No image | `status(404)` + `end()` called |
| T141 | **DELETE /users/:id/profile-image: delete** | Delete image | `has_profile_image` = false |
| T142 | ⚠️ **DELETE profile-image: forbidden user** | Mismatched user ids | `ForbiddenException` |

### `src/users/users.service.spec.ts`

| # | Test | What It Verifies | Expected |
|:-:|------|-----------------|----------|
| T143 | **should be defined** | Service instantiates | `service` defined |
| T144 | **findAll: no role filter** | 2 users, 1 online | First `is_online` = true, second false |
| T145 | **findAll: role filter** | 1 admin user | Role 'admin', `is_online` = false |
| T146 | **findAll: online=true** | Filter online | 1 result, `is_online` = true |
| T147 | **findAll: online=false** | Filter offline | 1 result, `is_online` = false |
| T148 | **findById: found** | With active session | Email 'agent', `is_online` = true |
| T149 | **findById: not found** | No user | `null` |
| T150 | **create: new user** | With all fields | `id` = 3, email matches, `is_online` = false |
| T151 | ⚠️ **create: duplicate email** | Prisma P2002 error | `ConflictException('Email already exists')` |
| T152 | **createBulk: multiple** | 2 users | 2 results, emails match, `is_online` = false |
| T153 | ⚠️ **createBulk: duplicate email** | Pre-existing email | `ConflictException('Duplicate emails: ...')` |
| T154 | ⚠️ **createBulk: no partial create** | Error → no users created | Error thrown, `prisma.user.create` NOT called |
| T155 | **update: fields** | Update name | `name` = 'Updated Name' |
| T156 | ⚠️ **update: not found** | No user | `NotFoundException('User not found')` |
| T157 | **deactivate: success** | Deactivate existing | `role` = 'deactivated', passwordHash set, `is_online` = false |
| T158 | ⚠️ **deactivate: not found** | No user | `NotFoundException('User not found')` |
| T159 | **getStats: results** | Calls + sessions aggregated | `total_calls: 2`, `answered: 1`, `no_answer: 1`, `avg_duration_seconds: 60`, `total_session_time_seconds: 3600` |
| T160 | **getStats: not found** | No user | `null` |
| T161 | **uploadProfileImage: success** | Upload binary | `has_profile_image` = true |
| T162 | ⚠️ **uploadProfileImage: not found** | No user | `NotFoundException('User not found')` |
| T163 | **getProfileImage: found** | Image + mime returned | `data` and `mime` properties |
| T164 | **getProfileImage: no image** | Null profile data | `null` |
| T165 | **getProfileImage: missing mime** | Image data but null mime | `null` |
| T166 | **deleteProfileImage: success** | Delete image | `has_profile_image` = false |
| T167 | ⚠️ **deleteProfileImage: not found** | No user | `NotFoundException('User not found')` |

---

<div align="center">
  <sub>Last updated: 2026-08-28 — 260 tests, all passing. See TESTING.md for current guide.</sub>
</div>
