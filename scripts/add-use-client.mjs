// tsup/esbuild descartan una directiva "use client" insertada como banner
// al empaquetar (ver aviso "Module level directives cause errors when
// bundled"). La agregamos manualmente después del build, que es el
// enfoque estándar en librerías de componentes para Next.js App Router.
import { readFileSync, writeFileSync } from "node:fs";

const files = ["dist/index.js", "dist/index.cjs"];

for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (content.startsWith('"use client"')) continue;
  writeFileSync(file, `"use client";\n${content}`);
}

console.log("✓ \"use client\" agregado a:", files.join(", "));
