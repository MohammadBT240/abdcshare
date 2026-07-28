import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(4000),
  API_GLOBAL_PREFIX: z.string().default('api'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(8).default('change-me-access'),
  JWT_REFRESH_SECRET: z.string().min(8).default('change-me-refresh'),
  JWT_ACCESS_TTL: z.coerce.number().int().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().default(1209600),
  PASSWORD_RESET_TTL: z.coerce.number().int().default(3600),

  // Object storage. `local` is a dependency-free dev fallback; `r2` uses the S3
  // SDK (requires @aws-sdk/client-s3 + s3-request-presigner + R2_* below).
  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  STORAGE_PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  STORAGE_UPLOAD_TTL: z.coerce.number().int().default(900),
  LOCAL_STORAGE_DIR: z.string().default('./storage'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_OBJECT_PREFIX: z.string().default('abdcshare'),
}).superRefine((data, ctx) => {
  if (data.STORAGE_DRIVER !== 'r2') return;
  const required = [
    ['R2_ENDPOINT', data.R2_ENDPOINT],
    ['R2_ACCESS_KEY_ID', data.R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', data.R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET', data.R2_BUCKET],
  ] as const;
  for (const [field, value] of required) {
    if (!value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${field} is required when STORAGE_DRIVER=r2`,
        path: [field],
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

/** Fail-fast env validation used by ConfigModule. */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Environment validation failed');
  }
  return parsed.data;
}
