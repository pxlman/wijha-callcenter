# Test Case Documentation — Call Center Broker API

**Base URL:** `http://localhost:3000/api/v1`
**Auth:** All endpoints except `POST /login`, `POST /register` require `Authorization: Bearer <jwt>`.
**Conventions:** Body validation uses `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`. Dates are ISO‑8601 (`IsDateString`). Egyptian phone numbers validated with `IsPhoneNumber('EG')` (format `+20xxxxxxxxx`).

Each row below is a self-contained test case with realistic JSON.

---

## 🔐 Auth Module

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| Valid Login | `POST /api/v1/login` (AuthService.login) | `{"email":"agent@wijha.com","password":"Password123"}` | `200` `{"token":"<jwt>","user":{"id":1,"email":"agent@wijha.com","name":"Ahmed","phone":"+201000000001","role":"user","has_profile_image":false}}` | — |
| Invalid Login - Wrong Password | `POST /api/v1/login` | `{"email":"agent@wijha.com","password":"WrongPass"}` | `401` | `UnauthorizedException: "Invalid password"` |
| Invalid Login - Unknown Email | `POST /api/v1/login` | `{"email":"ghost@wijha.com","password":"Password123"}` | `401` | `UnauthorizedException: "Invalid email"` |
| Login - Deleted Account | `POST /api/v1/login` | `{"email":"deleted@wijha.com","password":"Password123"}` | `401` | `UnauthorizedException: "Deleted account cannot log in (please contact support)"` |
| Register New User | `POST /api/v1/register` (AuthService.register) | `{"email":"newagent@wijha.com","password":"Password123","name":"New Agent","phone":"+201000000009","role":"user"}` | `201` `{"token":"<jwt>","user":{"id":3,"email":"newagent@wijha.com","name":"New Agent","phone":"+201000000009","role":"user","has_profile_image":false}}` | — |
| Register Duplicate Email | `POST /api/v1/register` | `{"email":"agent@wijha.com","password":"Password123"}` | `401` | `UnauthorizedException: "Email already in use"` |
| Logout Authenticated | `POST /api/v1/logout` (AuthService.logout) | _(none — Bearer token required)_ | `200` `{"message":"Logged out successfully"}` | — |
| Logout Without Token | `POST /api/v1/logout` | _(none)_ | `401` | `UnauthorizedException` (JWT guard) |
| Get Authenticated User | `GET /api/v1/me` (AuthService.getMe) | _(none — Bearer token required)_ | `200` `{"id":1,"email":"agent@wijha.com","role":"user","name":"Ahmed","phone":"+201000000001","has_profile_image":false}` | — |
| Get Me - Token Mismatch | `GET /api/v1/me` | _(stale/invalid JWT)_ | `401` or `null` | `UnauthorizedException` (token revocation) |

---

## 👤 Owners Module (`Client` entity)

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| Create Owner (full) | `POST /api/v1/owners` (OwnersService.create) | `{"name":"Mohamed Ali","project_id":1,"type":"OWNER","agent_id":1,"phones":[{"phone":"+201000000010"}],"info":[{"key":"city","value":"Cairo"}]}` | `201` `{"id":10,"name":"Mohamed Ali","type":"OWNER","agent_id":1,"phones":[{"phone":"+201000000010"}],"info":[{"key":"city","value":"Cairo"}],"projects":[{"project_id":1,"project_name":"Default Project","status":"dial","attempt_count":0,"last_dialed_at":null}]}` | — |
| Create Owner - Default Type | `POST /api/v1/owners` | `{"phones":[{"phone":"+201000000011"}]}` | `201` — `type` defaults to `"OWNER"` | — |
| Create Owner - Explicit LEAD | `POST /api/v1/owners` | `{"name":"Lead X","type":"LEAD","phones":[{"phone":"+201000000012"}]}` | `201` `type:"LEAD"` | — |
| Create Owner - Missing Phones | `POST /api/v1/owners` | `{"name":"NoPhone"}` | `400` | `BadRequestException` (phones `ArrayMinSize(1)`) |
| Create Owner - Invalid Phone | `POST /api/v1/owners` | `{"phones":[{"phone":"12345"}]}` | `400` | `BadRequestException` (`IsPhoneNumber('EG')`) |
| Create Owner - Merge Duplicate Phone | `POST /api/v1/owners` (existing `+201000000010`) | `{"name":"Mohamed Ali (Longer)","type":"BOTH","phones":[{"phone":"+201000000010"}]}` | `201` — existing client kept, name replaced by longer value, no new client row | — |
| Bulk Create Owners | `POST /api/v1/owners/bulk` (OwnersService.createBulk) | `{"owners":[{"name":"A","phones":[{"phone":"+201000000013"}]},{"name":"B","phones":[{"phone":"+201000000014"}]}]}` | `201` array of 2 owner objects | — |
| Bulk Create - Empty Array | `POST /api/v1/owners/bulk` | `{"owners":[]}` | `400` | `BadRequestException` (`ArrayNotEmpty`) |
| List Owners (paginated) | `GET /api/v1/owners?page=1&limit=20` (OwnersService.findAll) | _(query)_ | `200` `{"data":[...],"meta":{"total":12,"page":1,"limit":20}}` | — |
| List Owners - Filter Type | `GET /api/v1/owners?type=LEAD` | _(query)_ | `200` owners with `type:"LEAD"` | — |
| List Owners - Filter Status | `GET /api/v1/owners?status=dial` | _(query)_ | `200` owners in `dial` project status | — |
| List Owners - Limit Cap | `GET /api/v1/owners?limit=999` | _(query)_ | `200` `meta.limit` capped to `100` | — |
| Get Owner By Id | `GET /api/v1/owners/10` (OwnersService.findById) | _(path `ownerId=10`)_ | `200` owner object with `phones`,`info`,`projects` | — |
| Get Owner - Not Found | `GET /api/v1/owners/999999` | _(path)_ | `200` `null` | — |
| Update Owner | `PATCH /api/v1/owners/10` (OwnersService.update) | `{"type":"BOTH","name":"Updated Name"}` | `200` updated owner (`type:"BOTH"`) | — |
| Update Owner - Not Found | `PATCH /api/v1/owners/999999` | `{"name":"X"}` | `404` | `NotFoundException: "Client not found"` |
| Update Owner - Clear next_dial_at | `PATCH /api/v1/owners/10` | `{"next_dial_at":null}` | `200` `next_dial_at:null` | — |
| Assign To Project | `POST /api/v1/owners/10/projects` (OwnersService.assignToProject) | `{"project_name":"Default Project"}` | `200` owner with new project assignment | — |
| Assign Project - Owner Not Found | `POST /api/v1/owners/999999/projects` | `{"project_name":"Default Project"}` | `404` | `NotFoundException: "Client not found"` |
| Assign Project - Project Not Found | `POST /api/v1/owners/10/projects` | `{"project_name":"NoProject"}` | `404` | `NotFoundException: "Project \"NoProject\" not found"` |
| Owner Statuses | `GET /api/v1/owners/statuses` (OwnersService.getStatusCounts) | _(none)_ | `200` `[{"status":"dial","count":5},{"status":"answered","count":3}]` | — |
| Delete Owner | `DELETE /api/v1/owners/10` (OwnersService.remove) | _(path)_ | `204` No Content | — |
| Delete Owner - Not Found | `DELETE /api/v1/owners/999999` | _(path)_ | `404` | `NotFoundException: "Client not found"` |

---

## 📦 Projects Module

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| List Projects | `GET /api/v1/projects` (ProjectsService.findAll) | _(none)_ | `200` `[{"id":1,"name":"Default Project","description":null}]` | — |
| Create Project | `POST /api/v1/projects` (ProjectsService.create) | `{"name":"Summer Campaign","description":"Q3 outreach"}` | `201` `{"id":2,"name":"Summer Campaign","description":"Q3 outreach"}` | — |
| Create Project - Duplicate Name | `POST /api/v1/projects` | `{"name":"Default Project"}` | `409` | `ConflictException: "Project name already exists"` |
| Create Project - Missing Name | `POST /api/v1/projects` | `{"description":"no name"}` | `400` | `BadRequestException` (`@IsNotEmpty` name) |
| Get Project By Id | `GET /api/v1/projects/1` (ProjectsService.findById) | _(path)_ | `200` `{"id":1,"name":"Default Project","description":null}` | — |
| Get Project - Not Found | `GET /api/v1/projects/999999` | _(path)_ | `200` `null` | — |
| Update Project | `PATCH /api/v1/projects/2` (ProjectsService.update) | `{"name":"Renamed Campaign"}` | `200` updated project | — |
| Update Project - Not Found | `PATCH /api/v1/projects/999999` | `{"name":"X"}` | `404` | `NotFoundException: "Project not found"` |
| Update Project - Duplicate Name | `PATCH /api/v1/projects/2` | `{"name":"Default Project"}` | `409` | `ConflictException: "Project name already exists"` |
| Delete Project (admin) | `DELETE /api/v1/projects/2` (ProjectsService.remove) | _(path)_ | `204` No Content | — |
| Delete Project - Not Found | `DELETE /api/v1/projects/999999` | _(path)_ | `404` | `NotFoundException: "Project not found"` |
| Delete Project - Non-Admin | `DELETE /api/v1/projects/1` | _(path)_ | `403` | `ForbiddenException` (RolesGuard `@Roles('admin')`) |

---

## 📞 Calls Module

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| List Calls (all) | `GET /api/v1/calls` (CallsService.findAll) | _(none)_ | `200` `{"data":[...],"meta":{"total":3,"page":1,"limit":20}}` | — |
| List Calls - Filter client_id | `GET /api/v1/calls?client_id=1` | _(query)_ | `200` calls where `client_id:1` | — |
| List Calls - Filter status | `GET /api/v1/calls?status=completed` | _(query)_ | `200` calls with `status:"completed"` | — |
| List Calls - Filter project_id | `GET /api/v1/calls?project_id=1` | _(query)_ | `200` calls linked to client in project 1 | — |
| List Calls - Date Range | `GET /api/v1/calls?from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z` | _(query)_ | `200` calls within range | — |
| Submit Call (full) | `POST /api/v1/calls` (CallsService.submit) | `{"client_id":1,"status":"completed","time":"2026-08-28T10:00:00Z","project_id":1,"duration":120,"agent_notes":"Left voicemail"}` | `201` `{"id":1,"client_id":1,"agent_id":1,"status":"completed","time":"2026-08-28T10:00:00.000Z","duration":120,"agent_notes":"Left voicemail","projects":[]}` | — |
| Submit Call - Project Not Found | `POST /api/v1/calls` | `{"client_id":1,"status":"busy","time":"2026-08-28T10:00:00Z","project_id":9999}` | `400` | `BadRequestException: "Project 9999 not found"` |
| Submit Call - Invalid Time | `POST /api/v1/calls` | `{"client_id":1,"status":"busy","time":"not-a-date"}` | `400` | `BadRequestException` (`IsDateString`) |
| Submit Call - Missing Required | `POST /api/v1/calls` | `{"status":"busy"}` | `400` | `BadRequestException` (client_id, time required) |
| Submit Call - not_interested → inactive | `POST /api/v1/calls` | `{"client_id":1,"status":"not_interested","time":"2026-08-28T10:00:00Z"}` | `201` — also sets owner `type:"inactive"` | — |
| Get Next Call | `GET /api/v1/calls/next?project_id=1` (CallsService.getNextOwner) | _(query)_ | `200` `{"owner":{...},"calls":[...]}` | — |
| Get Next Call - None Available | `GET /api/v1/calls/next?project_id=9999` | _(query)_ | `200` `null` | — |
| Get Next Call - assigned_only | `GET /api/v1/calls/next?assigned_only=true&project_id=1` | _(query)_ | `200` next owner restricted to current agent | — |
| Get Next Call - Type Filter | `GET /api/v1/calls/next?project_id=1&type=LEAD` | _(query)_ | `200` next LEAD owner | — |
| Call Statuses | `GET /api/v1/calls/statuses` (CallsService.getStatusCounts) | _(none)_ | `200` `[{"status":"completed","count":2},{"status":"busy","count":1}]` | — |
| Call Statuses - Date Range | `GET /api/v1/calls/statuses?from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z` | _(query)_ | `200` filtered counts | — |
| Notify Calling | `POST /api/v1/calls/calling` (CallsService.notifyCalling) | `{"client_id":1,"project_id":1}` | `200` (no body) — increments attempt_count, sets lastDialedAt | — |
| Notify Calling - With Number | `POST /api/v1/calls/calling` | `{"client_id":1,"client_number":"+201000000010"}` | `200` (no body) | — |
| Get Call By Id | `GET /api/v1/calls/1` (CallsService.findById) | _(path `callId=1`)_ | `200` call object | — |
| Get Call - Not Found | `GET /api/v1/calls/999999` | _(path)_ | `200` `null` | — |

---

## ⏱️ Sessions Module

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| List Sessions (current user) | `GET /api/v1/sessions` (SessionsService.findAll) | _(none — Bearer token)_ | `200` `[{"agent_id":1,"first_beat":"2026-08-28T08:00:00.000Z","last_beat":"2026-08-28T09:00:00.000Z","is_active":true,"duration":3600}]` | — |
| List Sessions - Admin Filter User | `GET /api/v1/sessions?user_id=5` | _(query, admin only)_ | `200` sessions for agent 5 | — |
| List Sessions - Date Range | `GET /api/v1/sessions?from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z` | _(query)_ | `200` sessions in range | — |
| Create Session (no overlap) | `POST /api/v1/sessions` (SessionsService.create) | `{"first_beat":"2026-08-28T08:00:00Z","last_beat":"2026-08-28T09:00:00Z"}` | `201` `{"agent_id":1,"first_beat":"2026-08-28T08:00:00.000Z","last_beat":"2026-08-28T09:00:00.000Z","is_active":false,"duration":3600}` | — |
| Create Session - Merge Overlap | `POST /api/v1/sessions` (overlaps existing) | `{"first_beat":"2026-08-28T08:30:00Z","last_beat":"2026-08-28T09:30:00Z"}` | `201` merged session (earliest first_beat, latest last_beat, summed duration) | — |
| Create Session - Invalid Dates | `POST /api/v1/sessions` | `{"first_beat":"nope","last_beat":"also-nope"}` | `400` | `BadRequestException` (`IsDateString`) |
| Heartbeat (active) | `POST /api/v1/sessions/active` (SessionsService.beat) | _(none — Bearer token)_ | `200` `{"agent_id":1,"first_beat":"...","last_beat":"...","is_active":true,"duration":0}` | — |

---

## 👥 Users Module

| Test Scenario Name | Target Function/Endpoint | Real Input JSON | Expected Output | Expected Exception |
|---|---|---|---|---|
| List Users (admin) | `GET /api/v1/users` (UsersService.findAll) | _(none — admin)_ | `200` `[{"id":1,"email":"agent@wijha.com","name":"Ahmed","phone":"+201000000001","role":"user","has_profile_image":false,"is_online":true}]` | — |
| List Users - Filter Role | `GET /api/v1/users?role=admin` | _(query)_ | `200` admin users only | — |
| List Users - Filter Online | `GET /api/v1/users?online=true` | _(query)_ | `200` online users only | — |
| List Users - Non-Admin | `GET /api/v1/users` | _(none — user)_ | `403` | `ForbiddenException` (RolesGuard) |
| Create User | `POST /api/v1/users` (UsersService.create) | `{"email":"rep@wijha.com","password":"Password123","name":"Rep","phone":"+201000000020","role":"user"}` | `201` `{"id":4,"email":"rep@wijha.com","name":"Rep","phone":"+201000000020","role":"user","has_profile_image":false,"is_online":false}` | — |
| Create User - Duplicate Email | `POST /api/v1/users` | `{"email":"agent@wijha.com","password":"Password123","role":"user"}` | `409` | `ConflictException: "Email already exists"` |
| Create User - Weak Password | `POST /api/v1/users` | `{"email":"x@wijha.com","password":"123","role":"user"}` | `400` | `BadRequestException` (`MinLength(6)`) |
| Create User - Invalid Email | `POST /api/v1/users` | `{"email":"notanemail","password":"Password123","role":"user"}` | `400` | `BadRequestException` (`IsEmail`) |
| Create User - Missing Role | `POST /api/v1/users` | `{"email":"x@wijha.com","password":"Password123"}` | `400` | `BadRequestException` (role required) |
| Bulk Create Users | `POST /api/v1/users/bulk` (UsersService.createBulk) | `{"users":[{"email":"a@wijha.com","password":"Password123","role":"user"},{"email":"b@wijha.com","password":"Password123","role":"user"}]}` | `201` array of 2 users | — |
| Bulk Create - Duplicate Email | `POST /api/v1/users/bulk` | `{"users":[{"email":"agent@wijha.com","password":"Password123","role":"user"}]}` | `409` | `ConflictException: "Duplicate emails: agent@wijha.com"` |
| Get User By Id | `GET /api/v1/users/1` (UsersService.findById) | _(path)_ | `200` user object (with `is_online`) | — |
| Get User - Not Found | `GET /api/v1/users/999999` | _(path)_ | `200` `null` | — |
| Update Own Profile | `PATCH /api/v1/users/1` (UsersService.update) | `{"name":"Updated Name","phone":"+201000000099"}` | `200` updated user | — |
| Update User - Forbidden (other) | `PATCH /api/v1/users/2` (as user 1) | `{"name":"Hack"}` | `403` | `ForbiddenException: "You can only update your own profile"` |
| Update User - Not Found | `PATCH /api/v1/users/999999` | `{"name":"X"}` | `404` | `NotFoundException: "User not found"` |
| Deactivate User (admin) | `PATCH /api/v1/users/4/deactivate` (UsersService.deactivate) | _(path)_ | `200` `{"role":"deactivated","is_online":false,...}` | — |
| Deactivate - Not Found | `PATCH /api/v1/users/999999/deactivate` | _(path)_ | `404` | `NotFoundException: "User not found"` |
| Upload Profile Image | `POST /api/v1/users/1/profile-image` (multipart `profile_image`) | _(multipart file: JPEG/PNG/GIF/WEBP ≤5MB)_ | `200` `{"has_profile_image":true,...}` | — |
| Upload Image - Forbidden (other) | `POST /api/v1/users/2/profile-image` (as user 1) | _(file)_ | `403` | `ForbiddenException: "You can only update your own profile image"` |
| Upload Image - No File | `POST /api/v1/users/1/profile-image` | _(no file)_ | `400` | `BadRequestException: "No file provided"` |
| Upload Image - Wrong Type | `POST /api/v1/users/1/profile-image` | _(file: text/plain)_ | `400` | `BadRequestException: "Only jpeg, png, gif, webp allowed"` |
| Delete Profile Image | `DELETE /api/v1/users/1/profile-image` (UsersService.deleteProfileImage) | _(path)_ | `200` `{"has_profile_image":false,...}` | — |
| Delete Image - Forbidden (other) | `DELETE /api/v1/users/2/profile-image` (as user 1) | _(path)_ | `403` | `ForbiddenException: "You can only delete your own profile image"` |
| Get Profile Image | `GET /api/v1/users/1/profile-image` (UsersService.getProfileImage) | _(path)_ | `200` `Content-Type: image/jpeg` + binary body | — |
| Get Profile Image - 404 | `GET /api/v1/users/999999/profile-image` | _(path)_ | `404` (empty body) | — |
| Get Profile Image - No Image | `GET /api/v1/users/1/profile-image` | _(path, no stored image)_ | `404` (empty body) | — |
| User Stats | `GET /api/v1/users/1/stats?from=2026-08-01T00:00:00Z&to=2026-08-31T23:59:59Z` (UsersService.getStats) | _(query)_ | `200` `{"total_calls":2,"answered":1,"no_answer":1,"busy":0,"failed":0,"callback":0,"avg_duration_seconds":60,"total_session_time_seconds":3600}` | — |
| User Stats - Not Found | `GET /api/v1/users/999999/stats` | _(path)_ | `200` `null` | — |

---

### Notes
- `GET` endpoints that return `null` (owner/call/project/user not found) do **not** throw — they return `200` with `null` body. Exceptions are reserved for mutation paths and guard/role violations.
- All `400` validation errors come from `class-validator` via the global `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Role-protected routes (`@Roles('admin')`) return `403` for non-admin callers before the handler runs.
- Phone numbers must match Egyptian format (`+20` prefix) for owner creation; user phone is free-form.
