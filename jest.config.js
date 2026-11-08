module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',

  rootDir: '.',

  roots: ['<rootDir>/src', '<rootDir>/test'],

  testMatch: [
    '**/?(*.)+(spec|test).ts'
  ],

  testTimeout: 30000,
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/test/jest.setup.ts'],

  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
        allowJs: true,
      },
    ],
  },
  moduleNameMapper: {
    '^@/test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  forceExit: true,
  detectOpenHandles: true,
  // Allows ts-jest to transform ESM-only NestJS 11 packages in node_modules
  // transformIgnorePatterns: ['node_modules/(?!(@nestjs|uuid|other-esm-deps))/']
  // CRITICAL FIX: Only transform @nestjs packages, leave uuid and others to native CJS loading
  // transformIgnorePatterns: ['node_modules/(?!(@nestjs))'],
  transformIgnorePatterns: ['node_modules/'],
};
