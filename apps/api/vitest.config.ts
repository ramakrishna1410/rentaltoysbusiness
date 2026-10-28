import { defineConfig } from 'vitest/config';

// Set before globalSetup and test workers start, so both see the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/rentaltoys_test';
process.env.JWT_SECRET = 'test-secret';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: './test/global-setup.ts',
    fileParallelism: false,
    testTimeout: 20000,
  },
});
