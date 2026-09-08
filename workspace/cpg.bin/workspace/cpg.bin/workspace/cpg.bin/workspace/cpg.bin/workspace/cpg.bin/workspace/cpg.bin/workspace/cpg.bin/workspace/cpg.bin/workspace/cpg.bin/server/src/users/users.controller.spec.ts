import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionsService } from '@/sessions/sessions.service';
import { mockUser } from '@/prisma/mock-data';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let prisma: DeepMockProxy<PrismaService>;
  let sessionsService: DeepMockProxy<SessionsService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    sessionsService = mockDeep<SessionsService>();
    sessionsService.findAll.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
    prisma.activeSession.findMany.mockResolvedValue([{ agentId: 1, firstBeat: new Date() }]);
    prisma.activeSession.findUnique.mockResolvedValue({ agentId: 1, firstBeat: new Date() });
    prisma.user.findMany.mockResolvedValue([
      mockUser({ id: 1, email: 'agent', name: 'Agent Smith', phoneNumber: '123-456-7890' }),
      mockUser({ id: 2, email: 'admin', name: 'Admin User', role: 'admin', phoneNumber: '' }),
    ]);
    prisma.user.findUnique.mockResolvedValue(
      mockUser({ id: 1, email: 'agent', name: 'Agent Smith', phoneNumber: '123-456-7890' }),
    );
    prisma.user.create.mockResolvedValue(mockUser({ id: 3, email: 'test@test.com', name: 'Test', phoneNumber: '555-0000' }));
    prisma.user.update.mockResolvedValue(mockUser({ id: 1, email: 'agent', name: 'Updated' }));
    prisma.callDetailRecord.count.mockResolvedValue(0);
    prisma.callDetailRecord.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionsService, useValue: sessionsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /users', () => {
    it('should return all users', async () => {
      const result = await controller.findAll({});
      expect(result).toHaveLength(2);
      expect(result[0].is_online).toBe(true);
      expect(result[1].is_online).toBe(false);
    });

    it('should filter by role', async () => {
      prisma.user.findMany.mockResolvedValue([
        mockUser({ id: 2, email: 'admin', name: 'Admin User', role: 'admin', phoneNumber: '' }),
      ]);
      const result = await controller.findAll({ role: 'admin' });
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('admin');
      expect(result[0].is_online).toBe(false);
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const result = await controller.create({
        email: 'test@test.com',
        password: 'password123',
        name: 'Test',
        phone: '555-0000',
        role: 'user',
      });
      expect(result.id).toBe(3);
      expect(result.email).toBe('test@test.com');
      expect(result.is_online).toBe(false);
    });

    it('should throw ConflictException for duplicate email', async () => {
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      await expect(
        controller.create({
          email: 'test@test.com',
          password: 'password123',
          name: 'Test',
          phone: '555-0000',
          role: 'user',
        }),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('POST /users/bulk', () => {
    it('should create multiple users', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.create
        .mockResolvedValueOnce(
          mockUser({ id: 3, email: 'alice@test.com', name: 'Alice' }),
        )
        .mockResolvedValueOnce(
          mockUser({ id: 4, email: 'bob@test.com', name: 'Bob' }),
        );

      const result = await controller.createBulk({
        users: [
          { email: 'alice@test.com', password: 'pass123', name: 'Alice', role: 'user' },
          { email: 'bob@test.com', password: 'pass456', name: 'Bob', role: 'user' },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('alice@test.com');
      expect(result[0].is_online).toBe(false);
      expect(result[1].email).toBe('bob@test.com');
      expect(result[1].is_online).toBe(false);
    });

    it('should throw UnauthorizedException when any email is duplicate', async () => {
      prisma.user.findMany.mockResolvedValue([
        { email: 'alice@test.com' } as any,
      ]);

      await expect(
        controller.createBulk({
          users: [
            { email: 'alice@test.com', password: 'pass123', name: 'Alice', role: 'user' },
            { email: 'bob@test.com', password: 'pass456', name: 'Bob', role: 'user' },
          ],
        }),
      ).rejects.toThrow('Duplicate emails: alice@test.com');
    });
  });

  describe('GET /users/:userId', () => {
    it('should return user by id', async () => {
      const result = await controller.findOne(1);
      expect(result).not.toBeNull();
      expect(result!.email).toBe('agent');
      expect(result!.is_online).toBe(true);
    });

    it('should return null for non-existent', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await controller.findOne(999);
      expect(result).toBeNull();
    });
  });

  describe('PATCH /users/:userId', () => {
    it('should let admin update a user', async () => {
      const result = await controller.update(
        1,
        { name: 'Updated' },
        { id: 2, email: 'admin', role: 'admin' },
      );
      expect(result.name).toBe('Updated');
      expect(result.is_online).toBe(false);
    });

    it('should let a user update their own profile', async () => {
      const result = await controller.update(
        1,
        { name: 'Self Updated', phone: '555-1111' },
        { id: 1, email: 'agent', role: 'user' },
      );
      expect(result.name).toBe('Updated');
    });

    it('should forbid a non-admin updating another user', async () => {
      await expect(
        controller.update(
          2,
          { name: 'Hacked' },
          { id: 1, email: 'agent', role: 'user' },
        ),
      ).rejects.toThrow('You can only update your own profile');
    });
  });

  describe('DELETE /users/:userId', () => {
    it('should deactivate user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.user.update.mockResolvedValue(mockUser({ role: 'deactivated' }));
      const result = await controller.remove(1);
      expect(result.role).toBe('deactivated');
      expect(result.is_online).toBe(false);
    });
  });

  describe('GET /users/:userId/stats', () => {
    it('should return user stats', async () => {
      const result = await controller.getStats(1);
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('total_calls');
    });
  });

  describe('POST /users/:userId/profile-image', () => {
    it('should upload a profile image', async () => {
      const buffer = Buffer.from('fake-image-data');
      const file = { buffer, mimetype: 'image/jpeg' } as any;
      const currentUser = { id: 1, role: 'user', email: 'agent' } as any;

      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.user.update.mockResolvedValue(mockUser({ profileImage: buffer, profileMime: 'image/jpeg' }));
      prisma.activeSession.findUnique.mockResolvedValue(null);

      const result = await controller.uploadProfileImage(1, file, currentUser);
      expect(result.has_profile_image).toBe(true);
    });

    it('should throw ForbiddenException when wrong user', async () => {
      const file = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' } as any;
      const currentUser = { id: 2, role: 'user', email: 'other' } as any;

      await expect(
        controller.uploadProfileImage(1, file, currentUser),
      ).rejects.toThrow('You can only update your own profile image');
    });

    it('should throw BadRequestException when no file provided', async () => {
      const currentUser = { id: 1, role: 'user', email: 'agent' } as any;

      await expect(
        controller.uploadProfileImage(1, null as any, currentUser),
      ).rejects.toThrow('No file provided');
    });
  });

  describe('GET /users/:userId/profile-image', () => {
    it('should return the profile image binary', async () => {
      const buffer = Buffer.from('fake-image-data');
      prisma.user.findUnique.mockResolvedValue({ profileImage: buffer, profileMime: 'image/jpeg' } as any);

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as any;

      await controller.getProfileImage(1, mockRes);
      expect(mockRes.set).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockRes.send).toHaveBeenCalledWith(buffer);
    });

    it('should return 404 when user has no image', async () => {
      prisma.user.findUnique.mockResolvedValue({ profileImage: null, profileMime: null } as any);

      const mockRes = {
        set: jest.fn(),
        send: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as any;

      await controller.getProfileImage(1, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });

  describe('DELETE /users/:userId/profile-image', () => {
    it('should delete the profile image', async () => {
      const currentUser = { id: 1, role: 'user', email: 'agent' } as any;

      prisma.user.findUnique.mockResolvedValue(mockUser({ profileImage: Buffer.from('x'), profileMime: 'image/jpeg' }));
      prisma.user.update.mockResolvedValue(mockUser({ profileImage: null, profileMime: null }));
      prisma.activeSession.findUnique.mockResolvedValue(null);

      const result = await controller.deleteProfileImage(1, currentUser);
      expect(result.has_profile_image).toBe(false);
    });

    it('should throw ForbiddenException when wrong user', async () => {
      const currentUser = { id: 2, role: 'user', email: 'other' } as any;

      await expect(
        controller.deleteProfileImage(1, currentUser),
      ).rejects.toThrow('You can only delete your own profile image');
    });
  });
});
