import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CreateOwnerDto } from './dto/create-owner.dto';
import type { UpdateOwnerDto } from './dto/update-owner.dto';
import type { OwnerResponseDto } from './dto/owner-response.dto';
import type { StatusCountDto } from '@/calls/dto/status-count.dto';

type ClientWithRelations = {
  id: bigint;
  name?: string | null;
  type?: string | null;
  nextDialAt?: Date | null;
  agentId?: number | null;
  numbers: { number: string }[];
  clientInfo?: { key: string; value: string }[];
  clientProjects?: { projectId: number; status: string | null; attemptCount: number | null; lastDialedAt: Date | null; project: { id: number; name: string } }[];
};

function toOwnerResponse(client: ClientWithRelations): OwnerResponseDto {
  return {
    id: Number(client.id),
    name: client.name ?? undefined,
    type: client.type ?? undefined,
    next_dial_at: client.nextDialAt?.toISOString() ?? null,
    agent_id: client.agentId ?? undefined,
    phones: client.numbers.map(n => ({ phone: n.number })),
    info: client.clientInfo?.map(i => ({ key: i.key, value: i.value })),
    projects: client.clientProjects?.map(cp => ({
      project_id: cp.projectId,
      project_name: cp.project.name,
      status: cp.status ?? undefined,
      attempt_count: cp.attemptCount ?? 0,
      last_dialed_at: cp.lastDialedAt?.toISOString() ?? null,
    })),
  };
}

@Injectable()
export class OwnersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    project_id?: number,
    type?: string,
    status?: string,
    page = 1,
    limit = 20,
    agent_id?: number
  ): Promise<{ data: OwnerResponseDto[]; meta: { total: number; page: number; limit: number } }> {
    const where: {
      type?: string;
      agentId?: number;
      clientProjects?: { some: { projectId?: number; status?: string } };
    } = {};
    if (type) where.type = type;
    if (agent_id) where.agentId = agent_id;
    if (project_id) where.clientProjects = { some: { projectId: project_id } };
    if (status) {
      // Filter by ClientProject.status; merge with any existing clientProjects clause
      const existingClause = where.clientProjects?.some ?? {};
      where.clientProjects = { some: { ...existingClause, status } };
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: { numbers: true, clientInfo: true, clientProjects: { include: { project: true } } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients.map(toOwnerResponse),
      meta: { total, page, limit },
    };
  }

  async findById(id: number): Promise<OwnerResponseDto | null> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { numbers: true, clientInfo: true, clientProjects: { include: { project: true } } },
    });
    if (!client) return null;
    return toOwnerResponse(client);
  }

  async create(dto: CreateOwnerDto): Promise<OwnerResponseDto> {
    try {
      return await this.upsertOwner(this.prisma, dto);
    } catch (error) {
      throw error;
    }
  }

  async createBulk(dtos: CreateOwnerDto[]): Promise<OwnerResponseDto[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const results: OwnerResponseDto[] = [];
        for (const dto of dtos) {
          results.push(await this.upsertOwner(tx, dto));
        }
        return results;
      });
    } catch (error) {
      throw error;
    }
  }

  private async upsertOwner(client: Pick<PrismaService, 'number' | 'client' | 'clientInfo' | 'clientProject'>, dto: CreateOwnerDto): Promise<OwnerResponseDto> {
    try {
      const phoneNumbers = dto.phones.map(n => n.phone);
      const existingNumber = await client.number.findFirst({
        where: { number: { in: phoneNumbers } },
        include: { client: { include: { numbers: true, clientInfo: true } } },
      });

      if (existingNumber) {
        const existingClient = existingNumber.client;
        const existingPhoneValues = existingClient.numbers.map((n: { number: string }) => n.number);
        const newNumbers = phoneNumbers.filter(n => !existingPhoneValues.includes(n));
        const existingInfoKeys = (existingClient.clientInfo ?? []).map((i: { key: string }) => i.key);
        const newInfo = (dto.info ?? []).filter(
          i => i.key != null && i.value != null && !existingInfoKeys.includes(i.key!),
        );

        const mergedName =
          dto.name !== undefined
            ? !existingClient.name || dto.name.length > existingClient.name.length
              ? dto.name
              : undefined
            : undefined;

        const updated = await client.client.update({
          where: { id: existingClient.id },
          data: {
            ...(mergedName !== undefined ? { name: mergedName } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.agent_id !== undefined ? { agentId: dto.agent_id } : {}),
            ...(newNumbers.length > 0
              ? { numbers: { create: newNumbers.map(n => ({ number: n })) } }
              : {}),
            ...(newInfo.length > 0
              ? {
                  clientInfo: {
                    create: newInfo.map(i => ({ key: i.key!, value: i.value! })),
                  },
                }
              : {}),
            ...(dto.project_id
              ? {
                  clientProjects: {
                    upsert: {
                      where: {
                        clientId_projectId: {
                          clientId: existingClient.id,
                          projectId: dto.project_id,
                        },
                      },
                      create: { projectId: dto.project_id, status: 'dial', attemptCount: 0 },
                      update: {},
                    },
                  },
                }
              : {}),
          },
          include: { numbers: true, clientInfo: true },
        });

        return toOwnerResponse(updated);
      }

      const created = await client.client.create({
        data: {
          name: dto.name,
          type: dto.type ?? 'OWNER',
          agentId: dto.agent_id ?? null,
          numbers: {
            create: dto.phones.map(n => ({ number: n.phone })),
          },
          clientInfo: dto.info?.length
            ? {
                create: dto.info
                  .filter(i => i.key != null && i.value != null)
                  .map(i => ({ key: i.key!, value: i.value! })),
              }
            : undefined,
          clientProjects: dto.project_id
            ? { create: { projectId: dto.project_id, status: 'dial', attemptCount: 0 } }
            : undefined,
        },
        include: { numbers: true, clientInfo: true },
      });

      return toOwnerResponse(created);
    } catch (error) {
      throw error;
    }
  }

  async update(id: number, dto: UpdateOwnerDto): Promise<OwnerResponseDto> {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      include: { numbers: true },
    });
    if (!existing) {
      throw new NotFoundException('Client not found');
    }

    const existingPhoneValues = (existing.numbers ?? []).map(n => n.number);
    const newPhoneValues = dto.phones?.map(p => p.phone) ?? null;
    const phonesToRemove = newPhoneValues
      ? existingPhoneValues.filter(p => !newPhoneValues.includes(p))
      : [];
    const phonesToCreate = newPhoneValues
      ? newPhoneValues.filter(p => !existingPhoneValues.includes(p)).map(p => ({ number: p }))
      : [];

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.agent_id !== undefined ? { agentId: dto.agent_id } : {}),
        ...(dto.next_dial_at !== undefined ? { nextDialAt: dto.next_dial_at ? new Date(dto.next_dial_at).toISOString() : null } : {}),
        ...(phonesToRemove.length > 0 || phonesToCreate.length > 0
          ? {
              numbers: {
                ...(phonesToRemove.length > 0 ? { deleteMany: { number: { in: phonesToRemove } } } : {}),
                ...(phonesToCreate.length > 0 ? { create: phonesToCreate } : {}),
              },
            }
          : {}),
      },
      include: { numbers: true, clientInfo: true },
    });

    if (dto.info !== undefined) {
      await this.prisma.clientInfo.deleteMany({ where: { clientId: id } });
      if (dto.info.length > 0) {
        await this.prisma.clientInfo.createMany({
          data: dto.info
            .filter(i => i.key != null && i.value != null)
            .map(i => ({ clientId: id, key: i.key!, value: i.value! })),
        });
      }
      return toOwnerResponse({
        ...client,
        clientInfo: dto.info
          .filter(i => i.key != null && i.value != null)
          .map(i => ({ key: i.key!, value: i.value! })),
      });
    }

    return toOwnerResponse(client);
  }

  async getNextOwner(args: { projectId?: number, date?: Date, agentId?: number, type?: 'OWNER' | 'LEAD' | 'BOTH' }): Promise<OwnerResponseDto | null> {
    const { projectId, agentId, type } = args;

    const effectiveProjectId = projectId && projectId !== 0 ? projectId : undefined;

    const projectClause = effectiveProjectId !== undefined && effectiveProjectId !== null
      ? Prisma.sql`AND cp.project_id = ${effectiveProjectId}`
      : Prisma.empty;

    const agentClause = agentId !== undefined && agentId !== null
      ? Prisma.sql`AND c.agent_id = ${agentId}`
      : Prisma.empty;

    const typeClause = type !== undefined && type !== null
      ? Prisma.sql`AND c.type = ${type}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>`
      SELECT c.id
      FROM client c
      LEFT JOIN client_project cp ON cp.client_id = c.id
      WHERE (cp.status IN ('dial', 'callback', 'not_answered') OR cp.status IS NULL)
        AND (c.next_dial_at IS NULL OR c.next_dial_at <= NOW())
        ${projectClause}
        ${agentClause}
        ${typeClause}
      ORDER BY c.next_dial_at ASC NULLS FIRST
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    const client = await this.prisma.client.findUnique({
      where: { id: rows[0].id },
      include: { numbers: true, clientInfo: true },
    });

    if (!client) return null;
    return toOwnerResponse(client);
  }

  async getStatusCounts(): Promise<StatusCountDto[]> {
    return this.prisma.$queryRaw<StatusCountDto[]>`
      SELECT LOWER(TRIM(status)) as status, COUNT(*)::int as count
      FROM client_project
      WHERE status IS NOT NULL
      GROUP BY LOWER(TRIM(status))
      ORDER BY status
    `;
  }

  async assignToProject(clientId: number, projectName: string): Promise<OwnerResponseDto> {
    try {
      const existingClient = await this.prisma.client.findUnique({ where: { id: clientId } });
      if (!existingClient) throw new NotFoundException('Client not found');

      const project = await this.prisma.project.findFirst({ where: { name: projectName } });
      if (!project) throw new NotFoundException(`Project "${projectName}" not found`);

      await this.prisma.clientProject.upsert({
        where: { clientId_projectId: { clientId, projectId: project.id } },
        create: { clientId, projectId: project.id, status: 'dial', attemptCount: 0 },
        update: {},
      });

      const updated = await this.prisma.client.findUnique({
        where: { id: clientId },
        include: { numbers: true, clientInfo: true },
      });
      if (!updated) {
        throw new NotFoundException('Client not found');
      }
      return toOwnerResponse(updated);
    } catch (error) {
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const existing = await this.prisma.client.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Client not found');
    }

    await this.prisma.number.deleteMany({ where: { clientId: id } });
    await this.prisma.clientInfo.deleteMany({ where: { clientId: id } });
    await this.prisma.clientProject.deleteMany({ where: { clientId: id } });
    await this.prisma.callDetailRecord.deleteMany({ where: { clientId: id } });
    await this.prisma.client.delete({ where: { id } });
  }
}
