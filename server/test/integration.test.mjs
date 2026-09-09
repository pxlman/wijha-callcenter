#!/usr/bin/env node

/**
 * Standalone integration test script for the Call Center API.
 *
 * Requirements:
 *   - Server running at http://localhost:3000
 *   - Test data seeded: agent1@gmail.com / agent123, project id=1
 *
 * Uses built-in fetch (Node 18+). No external dependencies.
 * Self-cleaning: cleans up all created resources via DELETE endpoints.
 */

const BASE = process.env.API_URL || 'http://localhost:3000/api/v1';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

function assertEqual(actual, expected, label) {
  assert(actual === expected, `${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

function assertNotNull(value, label) {
  assert(value !== null && value !== undefined, label);
}

function assertNull(value, label) {
  assert(value === null || value === undefined, label);
}

async function api(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // response may be empty (204)
  }

  return { status: res.status, json, ok: res.ok };
}

// ── Login ────────────────────────────────────────────────────────────────────

let agentToken = null;
let adminToken = null;

async function loginTests() {
  console.log('\n=== Login ===');

  const agent = await api('POST', '/login', {
    body: { email: 'agent1@gmail.com', password: 'agent123' },
  });
  assertEqual(agent.status, 200, 'Agent login returns 200');
  assertNotNull(agent.json?.token, 'Agent receives JWT token');
  agentToken = agent.json?.token;

  const admin = await api('POST', '/login', {
    body: { email: 'admin1@gmail.com', password: 'admin123' },
  });
  assertEqual(admin.status, 200, 'Admin login returns 200');
  assertNotNull(admin.json?.token, 'Admin receives JWT token');
  adminToken = admin.json?.token;

  const bad = await api('POST', '/login', {
    body: { email: 'bad@gmail.com', password: 'wrong' },
  });
  assertEqual(bad.status, 401, 'Bad credentials returns 401');
}

// ── Sessions ─────────────────────────────────────────────────────────────────

let sessionFirstBeat = null;

async function sessionTests() {
  console.log('\n=== Sessions ===');

  // Heartbeat creates a new session
  const beat = await api('POST', '/sessions/active', { token: agentToken });
  assertEqual(beat.status, 200, 'Heartbeat returns 200');
  assertEqual(beat.json?.is_active, true, 'Session is active');
  sessionFirstBeat = beat.json?.first_beat;

  // List sessions
  const list = await api('GET', '/sessions', { token: agentToken });
  assertEqual(list.status, 200, 'List sessions returns 200');
  assert(Array.isArray(list.json), 'Sessions response is array');
  assert(list.json.length > 0, 'At least one session exists');

  // Delete session (admin only)
  const del = await api('DELETE', `/sessions/${beat.json.agent_id}/${encodeURIComponent(sessionFirstBeat)}`, { token: adminToken });
  assertEqual(del.status, 204, 'Delete session returns 204');

  // Verify deleted
  const list2 = await api('GET', '/sessions', { token: agentToken });
  const stillExists = list2.json?.some(
    (s) => s.agent_id === beat.json.agent_id && s.first_beat === sessionFirstBeat,
  );
  assert(!stillExists, 'Deleted session no longer in list');
}

// ── Calls ────────────────────────────────────────────────────────────────────

let callId = null;

async function callTests() {
  console.log('\n=== Calls ===');

  // Submit a call (no project)
  const submit = await api('POST', '/calls', {
    token: agentToken,
    body: {
      client_id: 1,
      status: 'answered',
      time: new Date().toISOString(),
      duration: 45,
    },
  });
  assertEqual(submit.status, 201, 'Submit call returns 201');
  assertNotNull(submit.json?.id, 'Created call has an id');
  callId = submit.json.id;

  // Fetch the created call
  const get = await api('GET', `/calls/${callId}`, { token: agentToken });
  assertEqual(get.status, 200, 'Get call returns 200');
  assertEqual(get.json?.status, 'answered', 'Call status matches');

  // List calls
  const list = await api('GET', '/calls', { token: agentToken });
  assertEqual(list.status, 200, 'List calls returns 200');
  assert(list.json?.data?.length > 0, 'Calls list is not empty');

  // Status counts
  const statuses = await api('GET', '/calls/statuses', { token: agentToken });
  assertEqual(statuses.status, 200, 'Statuses returns 200');
  assert(Array.isArray(statuses.json), 'Statuses response is array');

  // Delete call (admin only)
  const del = await api('DELETE', `/calls/${callId}`, { token: adminToken });
  assertEqual(del.status, 204, 'Delete call returns 204');

  // Verify deleted
  const get2 = await api('GET', `/calls/${callId}`, { token: agentToken });
  assertNull(get2.json, 'Deleted call returns null');
}

// ── Auth guards ──────────────────────────────────────────────────────────────

async function authGuardTests() {
  console.log('\n=== Auth Guards ===');

  const noToken = await api('GET', '/calls');
  assertEqual(noToken.status, 401, 'No token returns 401');

  const noTokenSessions = await api('GET', '/sessions');
  assertEqual(noTokenSessions.status, 401, 'No token sessions returns 401');
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\nIntegration tests against ${BASE}`);

  try {
    await loginTests();
    await authGuardTests();
    await sessionTests();
    await callTests();
  } catch (err) {
    failed++;
    console.error(`\n  FATAL  ${err.message}`);
    console.error(err.stack);
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
