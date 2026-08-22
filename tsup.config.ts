import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  minify: false,
  // Nunca empaquetar React/Firebase/etc. dentro del bundle: deben venir
  // del proyecto que consume el paquete (ver peerDependencies).
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "firebase/firestore",
    "react-hook-form",
    "@hookform/resolvers",
    "@hookform/resolvers/zod",
    "zod",
  ],
});
