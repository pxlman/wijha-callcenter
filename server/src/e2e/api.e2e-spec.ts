/**
 * E2E Flow Tests — full end-to-end user journeys.
 * Exercises complete business flows from dispatch to call submission.
 */

import { setupE2E, teardownE2E, TestApp } from '@/test/setup-e2e';
import { seedTestData } from '@/test/seed';
import { cleanupTestData } from '@/test/cleanup';
import { login } from '@/test/e2e-helpers';

describe('E2E Flows', () => {
  let app: TestApp['app'];
  let prisma: TestApp['prisma'];
  let testModule: TestApp['module'];
  let adminToken: string;
  let projectId: number;
  let adminId: number;
  let counter = 0;
  const phone = () => `+2012${(90000000 + counter++).toString().padStart(8, '0')}`;

  beforeAll(async () => {
    const ctx = await setupE2E();
    app = ctx.app;
    prisma = ctx.prisma;
    testModule = ctx.module;
    await seedTestData(prisma);
    adminToken = await login(app, 'admin1@gmail.com', 'admin123');
    const project = await prisma.project.findFirst({ where: { name: 'Default Project' } });
    if (!project) throw new Error('Seed data missing: Default Project not found');
    projectId = project.id;
    const admin = await prisma.user.findFirst({ where: { email: 'admin1@gmail.com' } });
    if (!admin) throw new Error('Seed data missing: admin user not found');
    adminId = admin.id;
  });

  afterAll(async () => {
    if (prisma) await cleanupTestData(prisma);
    await teardownE2E({ app, prisma, module: testModule });
  });

  it('GET /health returns DB status (200)', async () => {
    const res = await app.get('/api/v1/health').expect(200);
    expect(res.body).toHaveProperty('status', 'OK');
    expect(res.body).toHaveProperty('db_status');
  });

  it('Full call dispatch with type=OWNER filter', async () => {
    const ownerPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dispatch Owner', type: 'OWNER', project_id: projectId, phones: [{ phone: ownerPhone }] })
      .expect(201);

    const next = await app
      .get(`/api/v1/calls/next?project_id=${projectId}&type=OWNER`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(next.body).not.toBeNull();
    expect(next.body.owner.type).toBe('OWNER');

    await app
      .post('/api/v1/calls/calling')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ client_id: owner.body.id, project_id: projectId })
      .expect(200);

    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client_id: owner.body.id,
        status: 'completed',
        time: '2026-08-28T10:00:00Z',
        project_id: projectId,
        duration: 90,
      })
      .expect(201);
  });

  it('Full call dispatch with type=LEAD filter', async () => {
    const leadPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dispatch Lead', type: 'LEAD', project_id: projectId, phones: [{ phone: leadPhone }] })
      .expect(201);

    const next = await app
      .get(`/api/v1/calls/next?project_id=${projectId}&type=LEAD`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(next.body).not.toBeNull();
    expect(next.body.owner.type).toBe('LEAD');

    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client_id: owner.body.id,
        status: 'completed',
        time: '2026-08-28T10:00:00Z',
        project_id: projectId,
      })
      .expect(201);
  });

  it('Callback flow: submit callback + next_dial_at, verify scheduled', async () => {
    const callbackPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Callback Flow', project_id: projectId, phones: [{ phone: callbackPhone }] })
      .expect(201);

    const callbackTime = new Date(Date.now() + 86400000).toISOString();
    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client_id: owner.body.id,
        status: 'callback',
        time: '2026-08-28T10:00:00Z',
        project_id: projectId,
        next_dial_at: callbackTime,
      })
      .expect(201);

    const updated = await app
      .get(`/api/v1/owners/${owner.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(updated.body.next_dial_at).toBeDefined();
    expect(updated.body.projects[0].status).toBe('callback');
  });

  it('Not-interested flow: submit not_interested, verify removed from dispatch', async () => {
    const niPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'NI Flow', project_id: projectId, phones: [{ phone: niPhone }] })
      .expect(201);

    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client_id: owner.body.id,
        status: 'not_interested',
        time: '2026-08-28T10:00:00Z',
        project_id: projectId,
      })
      .expect(201);

    const updated = await app
      .get(`/api/v1/owners/${owner.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(updated.body.projects[0].status).toBe('not_interested');

    const next = await app
      .get(`/api/v1/calls/next?project_id=${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    if (next.body && next.body.owner) {
      expect(next.body.owner.id).not.toBe(owner.body.id);
    }
  });

  it('Agent self-service: login, view own calls, submit call, view stats', async () => {
    const agentRes = await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'self-service@wijha.com', password: 'Password123', name: 'Self Service', role: 'user' })
      .expect(201);
    const agentToken = await login(app, 'self-service@wijha.com', 'Password123');

    await app
      .get('/api/v1/calls')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    const ownerPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Agent Client', project_id: projectId, agent_id: agentRes.body.id, phones: [{ phone: ownerPhone }] })
      .expect(201);

    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        client_id: owner.body.id,
        status: 'completed',
        time: '2026-08-28T10:00:00Z',
        project_id: projectId,
      })
      .expect(201);

    const stats = await app
      .get(`/api/v1/users/${agentRes.body.id}/stats`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);
    expect(stats.body.total_calls).toBeGreaterThanOrEqual(1);
  });

  it('Admin lifecycle: create user -> project -> owner -> assign -> dispatch -> call -> stats -> deactivate', async () => {
    const userRes = await app
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'lifecycle@wijha.com', password: 'Password123', name: 'Lifecycle User', role: 'user' })
      .expect(201);
    const lifecycleUserId = userRes.body.id;
    const lifecycleToken = await login(app, 'lifecycle@wijha.com', 'Password123');

    const projectRes = await app
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Lifecycle Project' })
      .expect(201);
    const lifecycleProjectId = projectRes.body.id;

    const ownerPhone = phone();
    const owner = await app
      .post('/api/v1/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lifecycle Owner',
        project_id: lifecycleProjectId,
        agent_id: lifecycleUserId,
        phones: [{ phone: ownerPhone }],
      })
      .expect(201);

    await app
      .patch(`/api/v1/owners/${owner.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ agent_id: lifecycleUserId })
      .expect(200);

    const next = await app
      .get(`/api/v1/calls/next?project_id=${lifecycleProjectId}&assigned_only=true`)
      .set('Authorization', `Bearer ${lifecycleToken}`)
      .expect(200);

    await app
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${lifecycleToken}`)
      .send({
        client_id: owner.body.id,
        status: 'completed',
        time: '2026-08-28T10:00:00Z',
        project_id: lifecycleProjectId,
        duration: 60,
      })
      .expect(201);

    const stats = await app
      .get(`/api/v1/users/${lifecycleUserId}/stats`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(stats.body.total_calls).toBeGreaterThanOrEqual(1);

    const deactivated = await app
      .patch(`/api/v1/users/${lifecycleUserId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(deactivated.body.role).toBe('deactivated');
  });
});
