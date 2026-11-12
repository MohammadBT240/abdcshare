import { PERMISSIONS } from '@abdcshare/shared';
import { PERMISSION_GROUPS } from './permission-labels';

describe('PERMISSION_GROUPS', () => {
  it('labels every permission exactly once', () => {
    const labelled = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.permission));
    expect([...labelled].sort()).toEqual([...PERMISSIONS].sort());
    expect(new Set(labelled).size).toBe(labelled.length);
  });
});
