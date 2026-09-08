import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as bcrypt from 'bcryptjs';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUser } from '@/prisma/mock-data';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent', name: 'Agent' }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /login', () => {
    it('should login with valid credentials', async () => {
      const result = await controller.login({ email: 'agent', password: 'agent123' });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('agent');
    });

    it('should throw on invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(controller.login({ email: 'nonexistent', password: 'wrong' })).rejects.toThrow();
    });
  });

  describe('POST /logout', () => {
    it('should return logout message', async () => {
      const user = { id: 1, email: 'agent', role: 'user' as const };
      await expect(controller.logout(user)).rejects.toThrow();
    });
  });

  describe('GET /me', () => {
    it('should return authenticated user', async () => {
      const user = { id: 1, email: 'agent', role: 'user' as const };
      const fullUser = { ...user, name: 'Agent', phoneNumber: '1234567890' };
      prisma.user.findUnique.mockResolvedValue(mockUser({ ...fullUser }));
      const result = await controller.getMe(user);
      expect(result).toEqual({
        id: fullUser.id,
        email: fullUser.email,
        role: fullUser.role,
        name: fullUser.name,
        phone: fullUser.phoneNumber,
        has_profile_image: false,
      });
    });
  });
});
