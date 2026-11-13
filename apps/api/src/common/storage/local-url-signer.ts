import { createHmac, timingSafeEqual } from 'node:crypto';
import path from 'node:path';

/**
 * Signs and verifies the dev-only local storage URLs so they behave like R2 presigned URLs:
 * scoped to one object + method, and expiring. Without this the `/api/storage/local` routes
 * (which are `@Public`) would let anyone read or write any key.
 */
export interface LocalSignature {
  exp: number;
  sig: string;
}

function digest(secret: string, scope: string, exp: number): string {
  return createHmac('sha256', secret).update(`${scope}\n${exp}`).digest('base64url');
}

export function signLocal(secret: string, scope: string, ttlSeconds: number, now = Date.now()): LocalSignature {
  const exp = Math.floor(now / 1000) + Math.max(1, ttlSeconds);
  return { exp, sig: digest(secret, scope, exp) };
}

export function verifyLocal(
  secret: string,
  scope: string,
  exp: string | number | undefined,
  sig: string | undefined,
  now = Date.now(),
): boolean {
  const expNum = Number(exp);
  if (!sig || !Number.isFinite(expNum) || expNum < Math.floor(now / 1000)) return false;
  const expected = Buffer.from(digest(secret, scope, expNum));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Scope strings — one per URL kind so a GET signature can't be replayed as a PUT. */
export const localScope = {
  get: (key: string) => `GET:${key}`,
  put: (key: string) => `PUT:${key}`,
  part: (uploadId: string, partNumber: number, key: string) => `PART:${uploadId}:${partNumber}:${key}`,
};

/**
 * Resolve a storage key under the storage root, refusing anything that escapes it
 * (`..`, absolute paths, encoded traversal). Returns null when unsafe.
 */
export function resolveUnderRoot(root: string, key: string): string | null {
  if (!key || key.includes('\0')) return null;
  const base = path.resolve(root);
  const full = path.resolve(base, key);
  return full.startsWith(base + path.sep) ? full : null;
}
