/**
 * JwtStrategy Unit Tests
 *
 * Tests the JwtStrategy (passport-jwt) validate() method in isolation.
 * The strategy is responsible for:
 *   1. Extracting the JWT from the Authorization header ("Bearer <token>")
 *   2. Decoding the payload (id, email, role)
 *   3. Calling AuthService.validateUserWithToken() to check the token against
 *      the stored jwtToken in the database
 *   4. Returning the authenticated user if valid, or throwing UnauthorizedException
 *
 * The strategy uses ConfigService to read JWT_SECRET, and AuthService for token
 * validation. Both are mocked in these tests.
 *
 * Test coverage:
 *   - Validate and return user when token is valid
 *   - Throw UnauthorizedException when token is revoked (stored token differs)
 *   - Throw UnauthorizedException when user is not found
 *   - Use empty string when no Authorization header present
 */

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { AuthService } from '@/auth/auth.service';
import { mockUser } from '@/prisma/mock-data';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let authService: { validateUserWithToken: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    // Mock AuthService — only validateUserWithToken is used by the strategy
    authService = {
      validateUserWithToken: jest.fn(),
    };

    // Mock ConfigService — returns 'test-secret' for JWT_SECRET
    configService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  /**
   * Input:
   *   - Request with Authorization: "Bearer valid-token"
   *   - JWT payload: { id: 1, email: 'agent', role: 'user' }
   *   - AuthService.validateUserWithToken returns mockUser (valid, jwtToken matches)
   * Expected:
   *   - validate() returns { id: 1, email: 'agent', role: 'user' }
   *   - validateUserWithToken called with (1, 'valid-token')
   */
  it('should validate and return user when token is valid', async () => {
    authService.validateUserWithToken.mockResolvedValue(
      mockUser({ email: 'agent', role: 'user', jwtToken: 'valid-token' }),
    );

    const result = await strategy.validate(
      { headers: { authorization: 'Bearer valid-token' } } as never,
      { id: 1, email: 'agent', role: 'user' },
    );

    expect(result).toEqual({ id: 1, email: 'agent', role: 'user' });
    expect(authService.validateUserWithToken).toHaveBeenCalledWith(1, 'valid-token');
  });

  /**
   * Input:
   *   - Request with Authorization: "Bearer revoked-token"
   *   - JWT payload: { id: 1, email: 'agent', role: 'user' }
   *   - AuthService.validateUserWithToken returns null (token doesn't match stored)
   * Expected:
   *   - validate() throws UnauthorizedException with message 'Token revoked'
   *   - validateUserWithToken called with (1, 'revoked-token')
   */
  it('should throw UnauthorizedException when token is revoked', async () => {
    authService.validateUserWithToken.mockResolvedValue(null);

    await expect(
      strategy.validate(
        { headers: { authorization: 'Bearer revoked-token' } } as never,
        { id: 1, email: 'agent', role: 'user' },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(authService.validateUserWithToken).toHaveBeenCalledWith(1, 'revoked-token');
  });

  /**
   * Input:
   *   - Request with Authorization: "Bearer any-token"
   *   - JWT payload: { id: 999, email: 'ghost', role: 'user' }
   *   - AuthService.validateUserWithToken returns null (user not found)
   * Expected:
   *   - validate() throws UnauthorizedException with message 'Token revoked'
   */
  it('should throw UnauthorizedException when user not found', async () => {
    authService.validateUserWithToken.mockResolvedValue(null);

    await expect(
      strategy.validate(
        { headers: { authorization: 'Bearer any-token' } } as never,
        { id: 999, email: 'ghost', role: 'user' },
      ),
    ).rejects.toThrow('Token revoked');
  });

  /**
   * Input:
   *   - Request with no Authorization header (headers: {})
   *   - JWT payload: { id: 1, email: 'agent', role: 'user' }
   *   - AuthService.validateUserWithToken returns null
   * Expected:
   *   - validate() throws UnauthorizedException
   *   - validateUserWithToken called with (1, '') — empty string extracted from missing header
   */
  it('should use empty string when no Authorization header', async () => {
    authService.validateUserWithToken.mockResolvedValue(null);

    await expect(
      strategy.validate(
        { headers: {} } as never,
        { id: 1, email: 'agent', role: 'user' },
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(authService.validateUserWithToken).toHaveBeenCalledWith(1, '');
  });
});
