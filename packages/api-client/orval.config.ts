import { defineConfig } from 'orval';

/**
 * @see `docs/architecture/openapi-and-api-client.md` for workflow (export, regen, CI).
 * Generated functions use relative URLs, so each frontend app can choose its API origin.
 */
export default defineConfig({
  enotTea: {
    input: { target: './spec/openapi.json' },
    output: {
      mode: 'single',
      target: './src/generated/api.ts',
      client: 'fetch',
      clean: true,
    },
  },
});
