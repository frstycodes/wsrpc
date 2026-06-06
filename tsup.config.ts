import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    server: 'src/__exports/server/index.ts',
    client: 'src/__exports/client/index.ts',
    'server/internal': 'src/__exports/server/internal.ts',
    'client/internal': 'src/__exports/client/internal.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
})
