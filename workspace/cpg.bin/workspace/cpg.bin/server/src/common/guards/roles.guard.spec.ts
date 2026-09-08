/**
 * RolesGuard Unit Tests
 *
 * Tests the RolesGuard authorization guard in complete isolation — no NestJS
 * application context, no real controllers. The guard is instantiated directly
 * with a mock Reflector, and ExecutionContext objects are manually constructed.
 *
 * The guard's logic:
 *   1. Reads @Roles() metadata from the route handler or controller class
 *   2. If no roles are defined → returns true (allows access)
 *   3. If roles are defined → checks if the authenticated user's role is in the list
 *      - Match → returns true (allows access)
 *      - No match → returns false (NestJS translates to 403 Forbidden)
 *
 * Test coverage:
 *   - Allow when no @Roles() decorator present
 *   - Allow when user has the required role
 *   - Deny when user lacks the required role
 *   - Allow when user has one of multiple required roles
 *   - Deny when user role is not among multiple required roles
 *   - Handle missing user object (throws TypeError)
 */

import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    // Create a mock Reflector that can be configured per-test via getAllAndOverride
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    // Instantiate the guard directly (no DI container)
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  /**
   * Helper: builds a mock ExecutionContext with a given user object.
   * The user's `role` property is what RolesGuard checks against.
   *
   * @param user - The user object to attach to the request, or undefined
   * @returns A mock ExecutionContext compatible with RolesGuard.canActivate()
   */
  function buildContext(user: { role?: string } | undefined): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  /**
   * Input: Reflector returns undefined (no @Roles() metadata), user has role 'user'
   * Expected: guard.canActivate() returns true — access allowed because no roles required
   */
  it('should allow when no @Roles() decorator is present', () => {
    const ctx = buildContext({ role: 'user' });
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  /**
   * Input: Reflector returns ['admin'], user has role 'admin'
   * Expected: guard.canActivate() returns true — user's role matches the required role
   */
  it('should allow when user has the required role', () => {
    const ctx = buildContext({ role: 'admin' });
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  /**
   * Input: Reflector returns ['admin'], user has role 'user'
   * Expected: guard.canActivate() returns false — user's role does not match,
   *   NestJS will respond with 403 Forbidden
   */
  it('should deny when user lacks required role', () => {
    const ctx = buildContext({ role: 'user' });
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  /**
   * Input: Reflector returns ['admin', 'manager'], user has role 'manager'
   * Expected: guard.canActivate() returns true — user has one of the allowed multi-roles
   */
  it('should allow when user has one of multiple required roles', () => {
    const ctx = buildContext({ role: 'manager' });
    reflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  /**
   * Input: Reflector returns ['admin', 'manager'], user has role 'user'
   * Expected: guard.canActivate() returns false — user's role is not in the allowed list
   */
  it('should deny when requiredRoles is a non-empty array and user role is not in it', () => {
    const ctx = buildContext({ role: 'user' });
    reflector.getAllAndOverride.mockReturnValue(['admin', 'manager']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  /**
   * Input: Reflector returns ['admin'], request has no user object (unauthenticated)
   * Expected: guard.canActivate() throws TypeError — accessing user.role on undefined
   *   In practice, JwtAuthGuard runs first and would reject the request with 401
   *   before RolesGuard is reached, so this is a defensive test
   */
  it('should handle missing user object gracefully', () => {
    const ctx = buildContext(undefined);
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(ctx)).toThrow();
  });
});
