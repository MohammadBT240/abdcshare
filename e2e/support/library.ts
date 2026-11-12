import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRequestContext } from '@playwright/test';

export const FILES = path.join(__dirname, '..', 'fixtures', 'files');

export const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  png: 'image/png',
  csv: 'text/csv',
};

async function ok<T>(res: Awaited<ReturnType<APIRequestContext['get']>>, what: string): Promise<T> {
  if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`);
  return (res.status() === 204 ? undefined : await res.json()) as T;
}

/** BFF proxy path for an API path (`/library/items` → `/api/bff/proxy/library/items`). */
export const bff = (p: string) => `/api/bff/proxy/${p.replace(/^\/+/, '')}`;

export async function departmentId(api: APIRequestContext, name: string): Promise<number> {
  const res = await ok<{ data: { id: number; name: string }[] }>(await api.get(bff('departments?page=1&pageSize=100')), 'departments');
  const d = res.data.find((x) => x.name === name);
  if (!d) throw new Error(`No department ${name}`);
  return d.id;
}

export async function categoryId(api: APIRequestContext, slug: string): Promise<string> {
  const res = await ok<{ data: { id: string; slug: string }[] }>(await api.get(bff('library/categories?page=1&pageSize=100')), 'categories');
  const c = res.data.find((x) => x.slug === slug);
  if (!c) throw new Error(`No category ${slug}`);
  return c.id;
}

export interface CreatedItem {
  id: string;
  title: string;
}

/** Create + upload + confirm a library item through the same endpoints the browser uses. */
export async function createItem(
  api: APIRequestContext,
  opts: {
    title: string;
    categorySlug?: string;
    file?: string;
    visibility?: 'Firm' | 'Departments';
    departmentIds?: number[];
    tags?: string[];
    extra?: Record<string, unknown>;
  },
): Promise<CreatedItem> {
  const file = opts.file ?? 'sample.pdf';
  const ext = file.split('.').pop()!;
  const draft = await ok<{ id: string }>(
    await api.post(bff('library/items'), {
      data: {
        title: opts.title,
        categoryId: await categoryId(api, opts.categorySlug ?? 'reports'),
        visibility: opts.visibility ?? 'Firm',
        departmentIds: opts.departmentIds ?? [],
        tags: opts.tags ?? [],
        declaration: true,
        ...(opts.extra ?? {}),
      },
    }),
    'create draft',
  );
  const body = await readFile(path.join(FILES, file));
  const fileName = `${opts.title.replace(/[^a-z0-9]+/gi, '-')}.${ext}`;
  const presign = await ok<{ storageKey: string; uploadUrl: string; headers: Record<string, string> }>(
    await api.post(bff(`library/items/${draft.id}/files/presign`), { data: { fileName, contentType: MIME[ext] } }),
    'presign',
  );
  await ok(await api.put(presign.uploadUrl, { data: body, headers: presign.headers }), 'upload PUT');
  await ok(
    await api.post(bff(`library/items/${draft.id}/files`), {
      data: { storageKey: presign.storageKey, fileName, mimeType: MIME[ext], sizeBytes: body.length, declaration: true },
    }),
    'confirm',
  );
  return { id: draft.id, title: opts.title };
}

/** Archive (if needed) and delete as a curator — test clean-up. */
export async function destroyItem(curator: APIRequestContext, id: string): Promise<void> {
  await curator.post(bff(`library/items/${id}/archive`));
  await curator.delete(bff(`library/items/${id}`));
}

export const unique = (label: string) => `${label} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
