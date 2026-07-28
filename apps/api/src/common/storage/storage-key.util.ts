import { randomUUID } from 'node:crypto';

/** Filename → safe object-key segment. */
export function slugifyFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80);
  const ext = dot > 0 ? name.slice(dot).replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 12) : '';
  return `${base || 'file'}${ext}`;
}

/** Build a stable object key under an optional bucket prefix. */
export function buildStorageKey(
  keyPrefix: string,
  fileName: string,
  objectPrefix?: string,
): string {
  const folder = keyPrefix.replace(/\/+$/, '');
  const slug = `${randomUUID()}-${slugifyFileName(fileName)}`;
  if (objectPrefix) {
    const prefix = objectPrefix.replace(/\/+$/, '');
    return `${prefix}/${folder}/${slug}`;
  }
  return `${folder}/${slug}`;
}
