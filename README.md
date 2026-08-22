# MasterCrud

Componente genérico y reutilizable para administrar maestros/configuraciones
(categorías, métodos de pago, tipos de movimiento, cuentas, etc.) sobre
React + TypeScript + Firebase Firestore, sin duplicar lógica de CRUD por
cada maestro.

**Antes de leer el código**, revisa [`ANALYSIS.md`](./ANALYSIS.md): ahí se
explican las limitaciones reales de Firestore (unicidad, integridad
referencial, transacciones, concurrencia, seguridad) y las decisiones de
arquitectura tomadas en consecuencia. El código de este módulo es
consecuencia directa de ese análisis, no al revés.

## Instalación (como paquete npm)

```bash
npm install @joseparedesc/master-crud
```

Requiere que tu proyecto ya tenga instalado (son `peerDependencies`, no se
duplican dentro del paquete):

```bash
npm install react react-dom firebase react-hook-form zod @hookform/resolvers
```

### 1. Configura Tailwind

Los componentes usan tokens de diseño propios (`bg-ink`, `text-slate`,
`bg-moss-light`, `rounded-xl2`, etc.) que no existen en Tailwind por
defecto. Agrega el preset incluido:

```js
// tailwind.config.js
module.exports = {
  presets: [require("@joseparedesc/master-crud/tailwind-preset")],
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    // Necesario: Tailwind no escanea node_modules por defecto.
    "./node_modules/@joseparedesc/master-crud/dist/**/*.js",
  ],
};
```

### 2. Copia las Firestore Security Rules e índices

`firestore.rules` y `firestore.indexes.json` se publican dentro del
paquete como referencia — cópialos (o fusiónalos) a los tuyos con
`firebase deploy --only firestore:rules,firestore:indexes`. No se aplican
automáticamente: son parte de tu proyecto de Firebase, no del paquete npm.

### 3. Úsalo

```tsx
import { MasterCrud, type MasterCrudConfig, type MasterEntity } from "@joseparedesc/master-crud";
import { z } from "zod";

interface Category extends MasterEntity {
  description?: string;
}

const categoryConfig: MasterCrudConfig<Category> = {
  collection: "categories",
  title: "Categorías",
  singularTitle: "Categoría",
  codeField: "code",
  nameField: "name",
  searchableFields: ["code", "name"],
  columns: [
    { field: "code", label: "Código" },
    { field: "name", label: "Nombre" },
    { field: "active", label: "Estado" },
  ],
  formFields: [
    { name: "code", label: "Código", type: "text", required: true, disabledOnEdit: true },
    { name: "name", label: "Nombre", type: "text", required: true },
  ],
  references: [{ collection: "movements", field: "categoryId", description: "movimientos" }],
  allowDelete: true,
  allowDeactivate: true,
  validationSchema: z.object({ code: z.string().min(1), name: z.string().min(1) }),
};

export function CategoryCrud({ db, user }) {
  return <MasterCrud db={db} config={categoryConfig} currentUser={user} />;
}
```

> **Next.js App Router:** el paquete ya incluye la directiva `"use client"`
> en su build, así que puedes importarlo directo en un Server Component
> padre sin marcar nada adicional (el componente en sí se hidrata como
> cliente).

## Desarrollo de este paquete

```bash
npm install
npm run test        # 20 tests unitarios, sin necesidad de Firestore Emulator
npm run typecheck
npm run build        # genera dist/ (ESM + CJS + .d.ts)
npm pack --dry-run   # revisa exactamente qué se publicaría
```

## Cómo agregar un maestro nuevo

1. Define la interfaz TypeScript extendiendo `MasterEntity`.
2. Define el schema Zod (ver `schemas/master.schema.ts` para el ejemplo de
   `Category`).
3. Define un `MasterCrudConfig<T>` (ver `config/category.config.ts`).
4. Úsalo así, sin escribir ningún CRUD propio:

```tsx
<MasterCrud db={db} config={myConfig} currentUser={user} />
```

El ejemplo completo de "Category" está en `src/examples/CategoryCrud.tsx`.

## Estructura

```text
src/
├── components/master-crud/   # UI genérica (tabla, formulario, diálogos, shell)
├── services/firestore/       # Acceso a Firestore + lógica de unicidad/referencias
├── hooks/useMasterCrud.ts    # Orquesta el servicio y expone estados de UI
├── schemas/                  # Zod: schema base + ejemplo Category
├── types/master.ts           # MasterEntity, AuditLog
├── errors/masterErrors.ts    # Errores de dominio (nunca se exponen errores crudos de Firebase)
├── config/category.config.ts # Ejemplo de configuración de un maestro
├── examples/CategoryCrud.tsx # Ejemplo de uso: config + <MasterCrud />, sin lógica propia
└── __tests__/                # Tests unitarios (function pura + servicio con Firestore fake)

functions/src/masterCrud.ts   # Stub de Cloud Function para borrado reforzado (ver ANALYSIS.md)
firestore.rules               # Reglas de seguridad
firestore.indexes.json        # Índices compuestos necesarios
```

## Puntos clave de la arquitectura

- **Ningún componente visual importa Firestore.** Todo pasa por
  `MasterCrudService` → `useMasterCrud` → componentes. Esto es lo que
  permite testear el 100% de la lógica de negocio sin un emulador (ver
  `__tests__/masterCrud.service.test.ts`, que usa un fake de Firestore en
  memoria en vez de mocks superficiales).
- **Unicidad de código:** colección `masterCodeRegistry` con IDs
  determinísticos (`{collection}__{code-en-minusculas}`), escrita en la
  misma transacción que el documento del maestro. Reforzada también en
  `firestore.rules` con `!exists(...)`, no solo en el cliente.
- **Eliminación:** `resolveDeleteStrategy` es una función pura que decide
  `blocked | physical | soft` a partir de los conteos de referencias — se
  testea sin ningún mock. El borrado físico real está bloqueado en las
  reglas de Firestore (`allow delete: if false`); en producción debe
  ejecutarse desde la Cloud Function callable descrita en
  `functions/src/masterCrud.ts` y en `ANALYSIS.md`.
- **Errores de dominio:** `MasterError` y sus subclases
  (`DuplicateCodeError`, `ReferencedEntityError`, `PermissionError`,
  `ValidationError`, `NotFoundError`). La UI nunca ve un código de error
  crudo de Firebase.
