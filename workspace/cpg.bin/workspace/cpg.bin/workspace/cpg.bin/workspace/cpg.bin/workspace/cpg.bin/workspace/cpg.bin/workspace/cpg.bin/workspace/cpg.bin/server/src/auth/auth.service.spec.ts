import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { mockUser } from '@/prisma/mock-data';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwtService: JwtService;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('mock-token') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should return token and user for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent', name: 'Agent Smith', phoneNumber: '123-456-7890' }));
      jest.spyOn(jwtService, 'sign').mockReturnValue('mock-token');
      (bcrypt.compare as jest.Mock).mockResolvedValue(true as never);

      const result = await service.login('agent', 'agent123');
      expect(result).toHaveProperty('token', 'mock-token');
      expect(result.user).toMatchObject({
        id: 1,
        email: 'agent',
        name: 'Agent Smith',
        role: 'user',
      });
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login('nonexistent', 'password')).rejects.toThrow(
        'Invalid email',
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent' }));
      (bcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      await expect(service.login('agent', 'wrongpassword')).rejects.toThrow(
        'Invalid password',
      );
    });
  });

  describe('validateUserWithToken', () => {
    it('should return user when token matches stored jwtToken', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent', jwtToken: 'valid-token' }));

      const result = await service.validateUserWithToken(1, 'valid-token');
      expect(result).toEqual({ id: 1, email: 'agent', role: 'user' });
    });

    it('should return null when token does not match stored jwtToken', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent', jwtToken: 'other-token' }));

      const result = await service.validateUserWithToken(1, 'wrong-token');
      expect(result).toBeNull();
    });

    it('should return null when stored jwtToken is null (logged out)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ email: 'agent', jwtToken: null }));

      const result = await service.validateUserWithToken(1, 'any-token');
      expect(result).toBeNull();
    });

    it('should return null for invalid user id', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUserWithToken(999, 'any-token');
      expect(result).toBeNull();
    });
  });
});
