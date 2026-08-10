import { bffApi } from '@/lib/bff/client';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, validateFile } from '@/components/forms/file-validation';

export function validateAvatarFile(file: File): string | null {
  const err = validateFile(file, { allowedTypes: AVATAR_TYPES, maxBytes: AVATAR_MAX_BYTES });
  if (!err) return null;
  if (err.includes('Unsupported')) return 'Use a JPEG, PNG, or WebP image';
  return 'Image must be 2 MB or smaller';
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Uploads via the API (server writes to storage) to avoid browser→R2 CORS failures. */
export async function uploadUserAvatar(userId: string, file: File): Promise<void> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const data = toBase64(await file.arrayBuffer());
  await bffApi(`/api/users/${userId}/avatar`, {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      data,
    }),
  });
}
