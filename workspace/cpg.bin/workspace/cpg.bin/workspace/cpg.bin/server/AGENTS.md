# Agent Instructions: Call Center Broker API

## 🎯 Role & Objective
- **Primary Role**: Act as an expert NestJS/TypeScript developer.
- **Goal**: Build highly maintainable, type-safe, and performant REST API.

## 🛠️ Stack & Environment
- **Language**: TypeScript with ESM
- **Framework**: NestJS
- **Database**: PostgreSQL via Prisma and SQL if needed

## 📐 Coding Standards
- **Patterns**: Prefer clean code with well known patterns of NestJS with TS
- **Types**: Explicitly type all function inputs and outputs.
- **Imports**: Use absolute paths (`@/...`).
- **Errors**: Handle errors gracefully using custom error classes.

## 📝 Workflow Requirements
- **Before Coding**: Analyze existing code before suggesting changes.
- **Refactoring**: Never replace existing logic without a clear explanation.
- **Testing**: Write unit tests alongside every new feature.
- **Commit Style**: Use Conventional Commits if requested (`feat:`, `fix:`, `docs:`)
- **After Coding**: Make sure `api.yaml` is still matching the routing and types.

## 🚫 Constraints
- Do not add external libraries without asking first.
- Do not create any type without explaining what it provides.
- Do not use `any` types under any circumstance.

---

## 🗄️ Schema Design (3NF — Single Table Inheritance)

### Core Entity: `Client`
Replaces `Owner`, `Contact`, and `Lead` as a single table.

| Column | Type | Notes |
|---|---|---|
| `id` | `BigInt` PK auto | |
| `name` | `VarChar(50)?` | |
| `type` | `VarChar(10)` | `"OWNER"` \| `"LEAD"` \| `"BOTH"` |
| `next_dial_at` | `Timestamptz?` | Next scheduled call time |

### Client Info (key-value)
`client_info(id, client_id FK, key, value)` — arbitrary key-value metadata per client.

### Phone Numbers
`numbers(number PK unique, client_id FK)` — each number uniquely identifies one client.

### Projects & Pipeline Tracking
`project(id, name, description)` — unchanged.

`client_project(client_id FK, project_id FK, status, last_dialed_at, attempt_count)` — replaces `OwnerProject`. Tracks per-project pipeline status for any client.

- `status` defaults to `"dial"` — valid values: `dial`, `callback`, `not_answered`, `answered`, `busy`, `failed`, `not_interested`, `contacted`
- `lastDialedAt`, `attemptCount` live here (per-project), not on Client

### Call History
`call_detail_record(id, client_id FK?, agent_id FK?, status, time, duration, agent_notes)` — referenced to `Client` instead of `Owner`.

### Models NOT changed
- `Project`, `User`, `UserSession`, `ActiveSession`, `ProjectCallDetailRecord`

---

## 📡 Next-Call Dispatch

**Endpoint:** `GET /calls/next?project_id=`

**Query (raw SQL):**
```sql
SELECT c.id
FROM client c
JOIN client_project cp ON cp.client_id = c.id
WHERE cp.project_id = ${projectId}
  AND cp.status IN ('dial', 'callback', 'not_answered')
  AND (c.next_dial_at IS NULL OR c.next_dial_at <= NOW())
ORDER BY c.next_dial_at ASC NULLS FIRST
LIMIT 1
```

**Returns:** `{ owner: Client, calls: CallDetailRecord[] }` — the next client to call, with their past call history.

### Call Flow
1. `GET /calls/next?project_id=X` — get next client
2. `POST /calls/calling { client_id, project_id }` — notify server you're calling them (increments `attemptCount`, sets `lastDialedAt`)
3. `POST /calls { client_id, status, time, project_id }` — submit call outcome (updates `ClientProject.status`, sets `Client.nextDialAt`)

---

## 🔄 Key Renames (from Original)
| Old | New |
|---|---|
| `Owner` model | `Client` model (with `type` field) |
| `OwnerInfo` table | `ClientInfo` table |
| `OwnerProject` table | `ClientProject` table |
| `owner_id` FK | `client_id` FK |
| `nextDialAt` on Owner | `nextDialAt` on Client |
| `status`, `attemptCount`, `lastDialedAt` on Owner | Removed (tracked on `ClientProject`) |
