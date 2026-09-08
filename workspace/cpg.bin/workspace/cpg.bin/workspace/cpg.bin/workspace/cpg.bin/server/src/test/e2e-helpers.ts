import request from 'supertest';

/**
 * Logs in via the real HTTP endpoint and returns the JWT.
 * Reuses the seeded admin password ('admin123') or any created user.
 */
export async function login(
  app: ReturnType<typeof request>,
  email: string,
  password: string,
): Promise<string> {
  const res = await app
    .post('/api/v1/login')
    .send({ email, password })
    .expect(200);
  return res.body.token as string;
}
