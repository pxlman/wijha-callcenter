import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SessionsService } from './sessions.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUserSession } from '@/prisma/mock-data';

describe('SessionsService', () => {
  let service: SessionsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SessionsService>(SessionsService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    const userUser = { id: 1, email: 'agent', role: 'user' as const };
    const adminUser = { id: 2, email: 'admin', role: 'admin' as const };

    it('regular user sees only own sessions', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 1 }),
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T10:00:00Z'), duration: 3600 }),
      ]);
      prisma.activeSession.findMany.mockResolvedValue([
        { agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z') },
      ]);

      const result = await service.findAll({}, userUser);
      expect(result).toHaveLength(2);
      expect(result[0].is_active).toBe(true);
      expect(result[0].duration).toBe(1800);
      expect(result[1].is_active).toBe(false);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentId: 1 }),
        }),
      );
    });

    it('admin can filter by user_id', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 5 }),
      ]);
      prisma.activeSession.findMany.mockResolvedValue([]);

      await service.findAll({ user_id: '5' }, adminUser);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ agentId: 5 }),
        }),
      );
    });

    it('admin can filter by from/to on first_beat', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);
      prisma.activeSession.findMany.mockResolvedValue([]);

      await service.findAll({ from: '2024-06-01T00:00:00Z', to: '2024-06-02T00:00:00Z' }, adminUser);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firstBeat: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('admin can filter by time (between first_beat and last_beat)', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T08:00:00Z'), lastBeat: new Date('2024-06-01T10:00:00Z') }),
      ]);
      prisma.activeSession.findMany.mockResolvedValue([]);

      const result = await service.findAll({ time: '2024-06-01T09:00:00Z' }, adminUser);
      expect(result).toHaveLength(1);
      expect(prisma.userSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            firstBeat: expect.objectContaining({ lte: expect.any(Date) }),
            lastBeat: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a new session when no overlap', async () => {
      prisma.userSession.findMany.mockResolvedValue([]);
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:30:00Z'), duration: 1800 }),
      );

      const result = await service.create(
        { first_beat: '2024-06-01T09:00:00Z', last_beat: '2024-06-01T09:30:00Z' },
        1,
      );

      expect(result.agent_id).toBe(1);
      expect(result.first_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T09:30:00.000Z');
      expect(result.is_active).toBe(false);
      expect(result.duration).toBe(1800);
    });

    it('should merge overlapping sessions into one', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T10:00:00Z'), duration: 3600 }),
      ]);
      prisma.activeSession.findUnique.mockResolvedValue(null);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T08:30:00Z'), lastBeat: new Date('2024-06-01T11:00:00Z'), duration: 9000 }),
      );

      const result = await service.create(
        { first_beat: '2024-06-01T08:30:00Z', last_beat: '2024-06-01T11:00:00Z' },
        1,
      );

      expect(result.first_beat).toBe('2024-06-01T08:30:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T11:00:00.000Z');
      expect(result.is_active).toBe(false);
      expect(result.duration).toBe(9000);
    });

    it('should merge and update active_session if active session was merged', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T10:00:00Z'), duration: 3600 }),
      ]);
      prisma.activeSession.findUnique.mockResolvedValue(
        { agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z') },
      );
      prisma.userSession.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T08:30:00Z'), lastBeat: new Date('2024-06-01T11:00:00Z'), duration: 9000 }),
      );
      prisma.activeSession.upsert.mockResolvedValue(
        { agentId: 1, firstBeat: new Date('2024-06-01T08:30:00Z') },
      );

      const result = await service.create(
        { first_beat: '2024-06-01T08:30:00Z', last_beat: '2024-06-01T11:00:00Z' },
        1,
      );

      expect(result.is_active).toBe(true);
      expect(prisma.activeSession.upsert).toHaveBeenCalled();
    });

    it('should merge multiple overlapping sessions', async () => {
      prisma.userSession.findMany.mockResolvedValue([
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T10:00:00Z'), duration: 3600 }),
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T10:30:00Z'), lastBeat: new Date('2024-06-01T11:30:00Z'), duration: 3600 }),
      ]);
      prisma.activeSession.findUnique.mockResolvedValue(null);
      prisma.userSession.deleteMany.mockResolvedValue({ count: 2 });
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T08:00:00Z'), lastBeat: new Date('2024-06-01T12:00:00Z'), duration: 14400 }),
      );

      const result = await service.create(
        { first_beat: '2024-06-01T08:00:00Z', last_beat: '2024-06-01T12:00:00Z' },
        1,
      );

      expect(result.first_beat).toBe('2024-06-01T08:00:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T12:00:00.000Z');
      expect(result.is_active).toBe(false);
      expect(result.duration).toBe(14400);
    });
  });

  describe('beat', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should create new session when no recent session exists', async () => {
      jest.setSystemTime(new Date('2024-06-01T09:00:00Z'));
      prisma.userSession.findFirst.mockResolvedValue(null);
      prisma.activeSession.upsert.mockResolvedValue(
        { agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z') },
      );
      prisma.userSession.create.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:00:00Z'), duration: 0 }),
      );

      const result = await service.beat(1);

      expect(result.agent_id).toBe(1);
      expect(result.first_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.is_active).toBe(true);
      expect(result.duration).toBe(0);
      expect(prisma.activeSession.upsert).toHaveBeenCalled();
    });

    it('should update last_beat and duration when a recent session exists', async () => {
      jest.setSystemTime(new Date('2024-06-01T09:03:00Z'));
      prisma.userSession.findFirst.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:00:00Z'), duration: 0 }),
      );
      prisma.userSession.update.mockResolvedValue(
        mockUserSession({ agentId: 1, firstBeat: new Date('2024-06-01T09:00:00Z'), lastBeat: new Date('2024-06-01T09:03:00Z'), duration: 180 }),
      );

      const result = await service.beat(1);

      expect(result.first_beat).toBe('2024-06-01T09:00:00.000Z');
      expect(result.last_beat).toBe('2024-06-01T09:03:00.000Z');
      expect(result.is_active).toBe(true);
      expect(result.duration).toBe(180);
    });

    it('should not touch activeSession when extending existing session', async () => {
      jest.setSystemTime(new Date('2024-06-01T09:03:00Z'));
      prisma.userSession.findFirst.mockResolvedValue(
        mockUserSession({ agentId: 1 }),
      );
      prisma.userSession.update.mockResolvedValue(
        mockUserSession({ agentId: 1, lastBeat: new Date('2024-06-01T09:03:00Z') }),
      );

      await service.beat(1);

      expect(prisma.activeSession.upsert).not.toHaveBeenCalled();
      expect(prisma.activeSession.create).not.toHaveBeenCalled();
    });
  });
});
