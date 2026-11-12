import { envSchema } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
};

describe('API env schema', () => {
  it('allows the dev defaults outside production', () => {
    expect(envSchema.safeParse({ ...base, NODE_ENV: 'development' }).success).toBe(true);
  });

  it('refuses default or short JWT secrets in production', () => {
    const res = envSchema.safeParse({ ...base, NODE_ENV: 'production' });
    expect(res.success).toBe(false);
    const short = envSchema.safeParse({
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'short-secret',
      JWT_REFRESH_SECRET: 'x'.repeat(40),
    });
    expect(short.success).toBe(false);
  });

  it('accepts strong secrets in production', () => {
    const res = envSchema.safeParse({
      ...base,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
    });
    expect(res.success).toBe(true);
  });

  it('requires basic-auth credentials to enable Swagger in production', () => {
    const strong = { JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) };
    expect(
      envSchema.safeParse({ ...base, ...strong, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        ...base,
        ...strong,
        NODE_ENV: 'production',
        SWAGGER_ENABLED: 'true',
        SWAGGER_USER: 'docs',
        SWAGGER_PASSWORD: 'p',
      }).success,
    ).toBe(true);
  });
});
