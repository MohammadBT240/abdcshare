import type { StoragePort } from './storage.port';

/** Presign a user avatar object key, or null when missing. */
export async function presignAvatar(
  storage: StoragePort,
  avatarPath: string | null | undefined,
): Promise<string | null> {
  if (!avatarPath) return null;
  return storage.presignDownload(avatarPath);
}
