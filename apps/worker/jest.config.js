/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }] },
};
