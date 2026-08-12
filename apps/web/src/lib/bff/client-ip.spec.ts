import { forwardedIpHeaders, getClientIp } from './client-ip';

function headers(init: Record<string, string>): { get(name: string): string | null } {
  const lower = new Map(Object.entries(init).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    get(name: string) {
      return lower.get(name.toLowerCase()) ?? null;
    },
  };
}

describe('getClientIp', () => {
  it('prefers x-real-ip over x-forwarded-for', () => {
    expect(
      getClientIp(
        headers({
          'x-real-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.1, 10.0.0.1',
        }),
      ),
    ).toBe('203.0.113.10');
  });

  it('uses the leftmost x-forwarded-for hop when x-real-ip is absent', () => {
    expect(getClientIp(headers({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' }))).toBe(
      '198.51.100.1',
    );
  });

  it('strips IPv4 :port suffixes', () => {
    expect(getClientIp(headers({ 'x-real-ip': '203.0.113.10:54321' }))).toBe('203.0.113.10');
  });

  it('returns null when no proxy headers are present', () => {
    expect(getClientIp(headers({}))).toBeNull();
  });
});

describe('forwardedIpHeaders', () => {
  it('returns X-Real-IP and X-Forwarded-For when an IP is known', () => {
    expect(forwardedIpHeaders(headers({ 'x-real-ip': '203.0.113.10' }))).toEqual({
      'X-Real-IP': '203.0.113.10',
      'X-Forwarded-For': '203.0.113.10',
    });
  });

  it('returns an empty object when no IP can be resolved', () => {
    expect(forwardedIpHeaders(headers({}))).toEqual({});
  });
});
