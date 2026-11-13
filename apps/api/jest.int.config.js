/**
 * Postgres integration tests (`*.int-spec.ts`). Need a migrated database at DATABASE_URL
 * (e.g. the local dev / e2e database). Run: `pnpm --filter api test:int`.
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.int-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
  testTimeout: 30000,
};
