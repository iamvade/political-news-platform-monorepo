import { defineConfig } from 'vitest/config';
import { testEnv } from './src/test/test-env.ts';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/global-setup.ts'],
    env: { ...testEnv },
    // Tests share one database; run files sequentially until per-file isolation is needed.
    fileParallelism: false,
  },
});
