import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('ABDC Share <no-reply@example.com>'),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  LOCAL_STORAGE_DIR: z.string().default('../api/storage'),
  STORAGE_UPLOAD_TTL: z.coerce.number().int().positive().default(900),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_OBJECT_PREFIX: z.string().default('abdcshare'),
  /** clamd for library virus scanning (S3, D24). Required in production. */
  CLAMD_HOST: z.string().optional(),
  CLAMD_PORT: z.coerce.number().int().positive().default(3310),
  LIBREOFFICE_BIN: z.string().optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && !env.CLAMD_HOST) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLAMD_HOST'],
      message: 'CLAMD_HOST is required in production — library uploads must be virus-scanned',
    });
  }
});
export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid worker environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  return parsed.data;
}
