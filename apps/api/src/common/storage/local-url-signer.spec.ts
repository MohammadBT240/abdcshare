import path from 'node:path';
import { localScope, resolveUnderRoot, signLocal, verifyLocal } from './local-url-signer';

const SECRET = 'test-secret-0123456789abcdef0123456789';

describe('local storage URL signing', () => {
  it('accepts a fresh signature for the same scope', () => {
    const { exp, sig } = signLocal(SECRET, localScope.get('library/a/b.pdf'), 60);
    expect(verifyLocal(SECRET, localScope.get('library/a/b.pdf'), exp, sig)).toBe(true);
  });

  it('rejects another key, another method, or another secret', () => {
    const { exp, sig } = signLocal(SECRET, localScope.get('library/a/b.pdf'), 60);
    expect(verifyLocal(SECRET, localScope.get('library/a/c.pdf'), exp, sig)).toBe(false);
    expect(verifyLocal(SECRET, localScope.put('library/a/b.pdf'), exp, sig)).toBe(false);
    expect(verifyLocal('other-secret-0123456789abcdef012345', localScope.get('library/a/b.pdf'), exp, sig)).toBe(false);
  });

  it('rejects expired, missing or tampered signatures', () => {
    const now = Date.now();
    const { exp, sig } = signLocal(SECRET, localScope.get('k'), 60, now - 120_000);
    expect(verifyLocal(SECRET, localScope.get('k'), exp, sig, now)).toBe(false);
    expect(verifyLocal(SECRET, localScope.get('k'), undefined, undefined)).toBe(false);
    const fresh = signLocal(SECRET, localScope.get('k'), 60);
    expect(verifyLocal(SECRET, localScope.get('k'), fresh.exp + 1000, fresh.sig)).toBe(false);
  });

  it('binds part signatures to upload id, part number and key', () => {
    const { exp, sig } = signLocal(SECRET, localScope.part('u1', 1, 'k'), 60);
    expect(verifyLocal(SECRET, localScope.part('u1', 2, 'k'), exp, sig)).toBe(false);
    expect(verifyLocal(SECRET, localScope.part('u1', 1, 'k'), exp, sig)).toBe(true);
  });
});

describe('resolveUnderRoot', () => {
  const root = path.resolve('/tmp/storage-root');

  it('resolves normal keys inside the root', () => {
    expect(resolveUnderRoot(root, 'library/x/file.pdf')).toBe(path.join(root, 'library/x/file.pdf'));
  });

  it.each(['../etc/passwd', 'library/../../etc/passwd', '/etc/passwd', '', 'a\0b', '.'])(
    'refuses %p',
    (key) => {
      expect(resolveUnderRoot(root, key)).toBeNull();
    },
  );
});
