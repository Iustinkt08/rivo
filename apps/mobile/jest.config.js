// Minimal Jest setup — scoped to PURE TypeScript utilities only (no React Native
// imports). UI components are verified with tsc + manual runs, not jest, so we
// avoid pulling in the heavy jest-expo/react-native transform stack here.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          module: 'CommonJS',
          target: 'ES2019',
          esModuleInterop: true,
          skipLibCheck: true,
          strict: true,
        },
      },
    ],
  },
};
