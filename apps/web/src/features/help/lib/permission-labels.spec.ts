import { PERMISSIONS } from '@abdcshare/shared';
import { PERMISSION_GROUPS } from './permission-labels';

describe('PERMISSION_GROUPS', () => {
  it('labels every permission, and no row twice', () => {
    const rows = PERMISSION_GROUPS.flatMap((g) => g.items);
    expect([...new Set(rows.map((i) => i.permission))].sort()).toEqual([...PERMISSIONS].sort());
    const keys = rows.map((i) => [i.permission, ...(i.alsoNeeds ?? [])].join('+'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
