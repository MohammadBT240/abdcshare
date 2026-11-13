import { test, expect } from '@playwright/test';
import { apiAs, pageAs } from '../support/fixtures';
import { bff, createItem, destroyItem, unique } from '../support/library';

test('background jobs: a failed outbox row shows up, and a re-drive after the fix runs it (audited)', async ({
  browser,
  playwright,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const audit = await apiAs(playwright, 'audit', baseURL!);
  const pa = await apiAs(playwright, 'pa', baseURL!);
  const sa = await apiAs(playwright, 'sa', baseURL!);
  // Staff can't see the jobs page.
  expect((await audit.get(bff('admin/jobs'))).status()).toBe(403);

  // Make an export fail for real: request a ZIP, then make its only file view-only before the
  // worker builds it (the publisher drains every 10 s, so the PATCH always wins).
  const item = await createItem(audit, { title: unique('E2E ops item') });
  const col = await (await audit.post(bff('library/collections'), { data: { title: unique('E2E ops collection'), type: 'Other' } })).json();
  await audit.post(bff(`library/collections/${col.id}/items`), { data: { itemIds: [item.id] } });
  const tax = await apiAs(playwright, 'tax', baseURL!);
  expect((await tax.post(bff(`library/collections/${col.id}/export`))).status()).toBe(202);
  await audit.patch(bff(`library/items/${item.id}`), { data: { downloadable: false } });

  type Overview = { outbox: { failedRows: { id: string; eventType: string; lastError: string }[] }; failedJobs: { id: string }[] };
  let rowId = '';
  await expect
    .poll(
      async () => {
        const o = (await (await pa.get(bff('admin/jobs'))).json()) as Overview;
        const row = o.outbox.failedRows.find((r) => r.eventType === 'library.collection_export_requested' && r.lastError === 'No files to export');
        // Final failure = BullMQ gave up on the job (jobId = outbox id).
        if (row && o.failedJobs.some((j) => j.id === row.id)) rowId = row.id;
        return rowId;
      },
      { timeout: 120_000, intervals: [3000] },
    )
    .not.toBe('');

  // Fix the cause, then re-drive from the page.
  await audit.patch(bff(`library/items/${item.id}`), { data: { downloadable: true } });
  const { context, page } = await pageAs(browser, 'pa');
  await page.goto('/admin/jobs');
  const row = page.getByTestId('failed-outbox').locator('li').filter({ hasText: 'No files to export' }).first();
  await expect(row).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-jobs.png', fullPage: true });
  await row.getByRole('button', { name: 'Re-drive' }).click();
  await expect(page.getByText('Re-queued')).toBeVisible();

  // It runs and the tax user gets the ZIP notification.
  await expect
    .poll(
      async () => {
        const n = await (await tax.get(bff('notifications?page=1&pageSize=20'))).json();
        return n.data.some((x: { type: string; entityId: string }) => x.type === 'library.export_ready' && x.entityId === col.id);
      },
      { timeout: 60_000, intervals: [2000] },
    )
    .toBe(true);
  const after = (await (await pa.get(bff('admin/jobs'))).json()) as Overview;
  expect(after.outbox.failedRows.some((r) => r.id === rowId)).toBe(false);

  // The re-drive is in the activity log.
  const log = (await (await pa.get(bff(`audit?page=1&pageSize=20`))).json()) as {
    data: { action: string; entityId: string | null; actorName: string }[];
  };
  expect(log.data).toContainEqual(
    expect.objectContaining({ action: 'POST /api/admin/jobs/outbox/:id/redrive', entityId: rowId, actorName: 'Pat Platform' }),
  );

  await sa.post(bff(`library/collections/${col.id}/archive`));
  await sa.delete(bff(`library/collections/${col.id}`));
  await destroyItem(sa, item.id);
  await context.close();
  for (const a of [audit, pa, sa, tax]) await a.dispose();
});
