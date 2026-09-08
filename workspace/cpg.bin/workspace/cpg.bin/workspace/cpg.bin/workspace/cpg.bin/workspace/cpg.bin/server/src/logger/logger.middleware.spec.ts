/**
 * LoggerMiddleware Unit Tests
 *
 * Tests the LoggerMiddleware which logs incoming HTTP requests.
 * The middleware:
 *   1. Logs the HTTP method and URL (e.g., "[GET] /api/v1/owners")
 *   2. Logs the request body if it's non-empty
 *   3. Logs query parameters if present
 *   4. Logs route params if more than 1 param is present
 *   5. Registers a 'finish' listener on the response to log response time
 *   6. Calls next() to pass control to the next handler
 *
 * Key fix from original: the middleware now uses proper Express Request/Response
 * types (no `any`) and safely handles undefined body (common for GET requests).
 *
 * Test coverage:
 *   - Logs method + URL on every request
 *   - Logs body when present and non-empty
 *   - Skips body logging when undefined or empty
 *   - Logs query params when present
 *   - Skips query logging when empty
 *   - Logs params when more than 1 param present
 *   - Skips params logging when 0 or 1 params
 *   - Registers response 'finish' listener for response time logging
 *   - Calls next() exactly once
 *   - Handles GET requests with undefined body without crashing
 */

import { LoggerMiddleware } from './logger.middleware';
import type { Request, Response } from 'express';

/**
 * Helper: creates a mock Express Request with sensible defaults.
 * Override any field via the `overrides` parameter.
 *
 * @param overrides - Partial Request properties to override defaults
 * @returns A complete mock Request object
 */
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/api/v1/test',
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as Request;
}

/**
 * Helper: creates a mock Express Response with a working `on()` method
 * for event listener registration (needed for response 'finish' event).
 *
 * @param overrides - Partial Response properties to override defaults
 * @returns A complete mock Response object
 */
function createMockResponse(overrides: Partial<Response> = {}): Response {
  return {
    on: jest.fn().mockReturnThis(),
    ...overrides,
  } as unknown as Response;
}

describe('LoggerMiddleware', () => {
  let middleware: LoggerMiddleware;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new LoggerMiddleware();
    // Spy on console.log to prevent output noise and verify calls
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  /**
   * Input: GET request to /api/v1/owners with empty body/query/params
   * Expected: console.log called with '[GET] /api/v1/owners', next() called
   */
  it('should log method and URL', () => {
    const req = createMockRequest({ method: 'GET', originalUrl: '/api/v1/owners' });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('[GET] /api/v1/owners');
    expect(next).toHaveBeenCalled();
  });

  /**
   * Input: POST request with body containing name and phones
   * Expected: console.log called with 'Body:' and the body object
   */
  it('should log body when present and non-empty', () => {
    const req = createMockRequest({
      method: 'POST',
      originalUrl: '/api/v1/owners',
      body: { name: 'Test Owner', phones: [{ phone: '+201012345678' }] },
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('Body:', { name: 'Test Owner', phones: [{ phone: '+201012345678' }] });
  });

  /**
   * Input: request with body = undefined (typical for GET requests)
   * Expected: does NOT crash, does NOT log 'Body:' line
   */
  it('should not log body when undefined', () => {
    const req = createMockRequest({
      method: 'GET',
      originalUrl: '/api/v1/owners',
      body: undefined,
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).not.toHaveBeenCalledWith('Body:', undefined);
  });

  /**
   * Input: POST request with empty body object {}
   * Expected: does NOT log 'Body:' line (empty body skipped)
   */
  it('should not log body when empty', () => {
    const req = createMockRequest({
      method: 'POST',
      originalUrl: '/api/v1/owners',
      body: {},
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).not.toHaveBeenCalledWith('Body:');
  });

  /**
   * Input: GET request with query params { type: 'LEAD', page: '1' }
   * Expected: console.log called with 'Query:' and the query object
   */
  it('should log query params when present', () => {
    const req = createMockRequest({
      method: 'GET',
      originalUrl: '/api/v1/owners?type=LEAD',
      query: { type: 'LEAD', page: '1' },
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('Query:', { type: 'LEAD', page: '1' });
  });

  /**
   * Input: request with empty query object {}
   * Expected: does NOT log 'Query:' line
   */
  it('should not log query when empty', () => {
    const req = createMockRequest({ query: {} });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).not.toHaveBeenCalledWith('Query:');
  });

  /**
   * Input: request with 2 route params { ownerId: '1', projectId: '2' }
   * Expected: console.log called with 'Params:' and the params object
   * (params logging only triggers when more than 1 param is present)
   */
  it('should log params when more than 1 param present', () => {
    const req = createMockRequest({
      method: 'PATCH',
      originalUrl: '/api/v1/owners/1/projects/2',
      params: { ownerId: '1', projectId: '2' },
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('Params:', { ownerId: '1', projectId: '2' });
  });

  /**
   * Input: request with 1 route param { id: '1' }
   * Expected: does NOT log 'Params:' line (requires more than 1 param)
   */
  it('should not log params when 0 or 1 param present', () => {
    const req = createMockRequest({ params: { id: '1' } });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).not.toHaveBeenCalledWith('Params:');
  });

  /**
   * Input: any request
   * Expected: res.on('finish', callback) is called — registers response time logging
   */
  it('should log response time on finish', () => {
    const req = createMockRequest({ method: 'GET', originalUrl: '/api/v1/projects' });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  /**
   * Input: any request
   * Expected: next() called exactly once — passes control to next middleware/handler
   */
  it('should call next() exactly once', () => {
    const req = createMockRequest();
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  /**
   * Input: GET request with undefined body (common for GET requests) and query params
   * Expected: logs method+URL and Query, does NOT crash on undefined body,
   *   calls next()
   */
  it('should handle request with no body (GET requests)', () => {
    const req = createMockRequest({
      method: 'GET',
      originalUrl: '/api/v1/users',
      body: undefined,
      query: { role: 'admin' },
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith('[GET] /api/v1/users');
    expect(consoleSpy).toHaveBeenCalledWith('Query:', { role: 'admin' });
    expect(next).toHaveBeenCalled();
  });
});
