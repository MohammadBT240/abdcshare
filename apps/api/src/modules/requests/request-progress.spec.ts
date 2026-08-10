import { computeRequestProgressPercent } from '@abdcshare/shared';

describe('computeRequestProgressPercent', () => {
  it('ignores done status and uses accepted / expected only', () => {
    expect(computeRequestProgressPercent(5, 0, 'Closed')).toBe(0);
    expect(computeRequestProgressPercent(5, 0, 'Complete')).toBe(0);
    expect(computeRequestProgressPercent(5, 0, 'Accepted')).toBe(0);
    expect(computeRequestProgressPercent(4, 1, 'Accepted')).toBe(25);
  });

  it('computes accepted / expected capped at 100', () => {
    expect(computeRequestProgressPercent(4, 1, 'Open')).toBe(25);
    expect(computeRequestProgressPercent(4, 4, 'Open')).toBe(100);
    expect(computeRequestProgressPercent(4, 6, 'Open')).toBe(100);
  });

  it('treats missing expected as 1', () => {
    expect(computeRequestProgressPercent(0, 0, 'Open')).toBe(0);
    expect(computeRequestProgressPercent(0, 1, 'Open')).toBe(100);
  });
});
