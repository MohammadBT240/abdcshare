import { bffApi } from '@/lib/bff/client';
import { validateAvatarFile } from '@/features/users/lib/upload-user-avatar';

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Upload the signed-in user's avatar via POST /api/users/me/avatar. */
export async function uploadMeAvatar(file: File): Promise<void> {
  const validationError = validateAvatarFile(file);
  if (validationError) throw new Error(validationError);

  const data = toBase64(await file.arrayBuffer());
  await bffApi('/api/users/me/avatar', {
    method: 'POST',
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      data,
    }),
  });
}
