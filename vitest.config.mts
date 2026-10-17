import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest runs the pure TypeScript units (API client, session service, payload
 * validators). These modules have no React Native runtime dependency — secure
 * storage and `fetch` are mocked per test — so a plain Node environment is
 * enough and keeps the suite fast.
 *
 * `expo-constants` is aliased to a Node stub because the real package pulls in
 * React Native's Flow source, which the Node runner cannot parse.
 */
export default defineConfig({
  resolve: {
    alias: {
      'expo-constants': fileURLToPath(new URL('./test/stubs/expo-constants.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
