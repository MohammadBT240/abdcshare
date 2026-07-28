import { buildStorageKey, slugifyFileName } from './storage-key.util';

describe('storage-key.util', () => {
  it('slugifyFileName keeps extension and sanitises base', () => {
    expect(slugifyFileName('Bank Statement Q1.pdf')).toBe('Bank-Statement-Q1.pdf');
    expect(slugifyFileName('***')).toBe('-');
  });

  it('buildStorageKey nests under keyPrefix without object prefix', () => {
    const key = buildStorageKey('documents/eng-1', 'report.pdf');
    expect(key).toMatch(/^documents\/eng-1\/[0-9a-f-]+-report\.pdf$/);
  });

  it('buildStorageKey prepends object prefix for R2', () => {
    const key = buildStorageKey('avatars', 'photo.png', 'abdcshare');
    expect(key).toMatch(/^abdcshare\/avatars\/[0-9a-f-]+-photo\.png$/);
  });
});
