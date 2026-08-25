import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    firestore: 'src/adapters/firestore.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'firebase', 'firebase/firestore'],
  banner: { js: '"use client";' },
});
