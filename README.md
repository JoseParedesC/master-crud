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

## Instalar y correr

```bash
npm install
npm run test        # 20 tests unitarios, sin necesidad de Firestore Emulator
npm run typecheck
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
