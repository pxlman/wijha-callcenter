/**
 * E2E Test Data Cleanup
 *
 * Wipes all data created by E2E tests while preserving the seed fixtures
 * (admin user `admin1@gmail.com` and project `Default Project`) so the
 * suite stays idempotent across repeated / sequential runs.
 *
 * Deletion order respects foreign-key constraints:
 *   project_call_detail_record -> call_detail_record
 *   active_session -> user_session
 *   client_project -> numbers -> client_info -> client
 *   user (non-admin) -> project (non-default)
 */

import { PrismaService } from '@/prisma/prisma.service';

export async function cleanupTestData(prisma: PrismaService): Promise<void> {
  await prisma.projectCallDetailRecord.deleteMany({});
  await prisma.callDetailRecord.deleteMany({});
  await prisma.activeSession.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.clientProject.deleteMany({});
  await prisma.number.deleteMany({});
  await prisma.clientInfo.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({ where: { NOT: { email: 'admin1@gmail.com' } } });
  await prisma.project.deleteMany({ where: { NOT: { name: 'Default Project' } } });
}
