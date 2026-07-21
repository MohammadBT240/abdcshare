import { LOOKUP_REGISTRY, LOOKUP_TYPES } from './reference.registry';

describe('lookup registry', () => {
  it('exposes the expected lookup types', () => {
    expect(LOOKUP_TYPES).toEqual(
      expect.arrayContaining(['titles', 'genders', 'states', 'lgas', 'wards', 'banks']),
    );
  });

  it('marks hierarchical lookups with a parent, flat ones without', () => {
    expect(LOOKUP_REGISTRY['titles']?.parent).toBeUndefined();
    expect(LOOKUP_REGISTRY['lgas']?.parent?.field).toBe('state');
    expect(LOOKUP_REGISTRY['wards']?.parent?.field).toBe('lga');
  });
});
