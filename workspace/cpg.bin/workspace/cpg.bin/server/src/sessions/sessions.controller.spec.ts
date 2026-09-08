import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUserSession } from '@/prisma/mock-data';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

describe('SessionsController', () => {
  let controller: SessionsController;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.userSession.findMany.mockResolvedValue([
      mockUserSession({ agentId: 1 }),
      mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T10:00:00Z'), duration: 3600 }),
    ]);
    prisma.activeSession.findMany.mockResolvedValue([
      { agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z') },
    ]);
    prisma.userSession.create.mockResolvedValue(
      mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:30:00Z'), duration: 1800 }),
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /sessions', () => {
    it('should return sessions for the current user', async () => {
      const user = { id: 1, email: 'agent', role: 'user' as const };
      const result = await controller.findAll({}, user);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('is_active');
      expect(result[0]).toHaveProperty('duration');
    });
  });

  describe('POST /sessions', () => {
    it('should create a session', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);
      const user = { id: 1, email: 'agent', role: 'user' as const };
      const result = await controller.create(
        { first_beat: '2024-06-01T09:00:00Z', last_beat: '2024-06-01T09:30:00Z' },
        user,
      );
      expect(result.agent_id).toBe(1);
      expect(result.first_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.is_active).toBe(false);
      expect(result.duration).toBe(1800);
    });
  });

  describe('POST /sessions/active', () => {
    it('should return the heartbeated session', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-06-01T09:00:00Z'));

      prisma.userSession.findFirst.mockResolvedValue(null);
      prisma.activeSession.upsert.mockResolvedValue(
        { agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z') },
      );
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:00:00Z'), duration: 0 }),
      );

      const user = { id: 1, email: 'agent', role: 'user' as const };
      const result = await controller.active(user);
      expect(result.agent_id).toBe(1);
      expect(result.first_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.is_active).toBe(true);
      expect(result.duration).toBe(0);

      jest.useRealTimers();
    });
  });
});
