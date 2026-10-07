import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/server.ts', 'src/db/migrate.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  // @news/shared ships TypeScript source, so it must be bundled, not imported at runtime.
  deps: { alwaysBundle: [/^@news\//] },
});
