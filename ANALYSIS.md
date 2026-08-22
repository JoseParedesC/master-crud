# Análisis: limitaciones de Firestore aplicadas a `MasterCrud`

Antes de escribir código, esto es lo que Firestore **no** garantiza de forma
nativa, y la decisión de arquitectura que se tomó para cada caso.

## 1. Unicidad de campos (código único)

**Limitación:** Firestore no tiene `UNIQUE` a nivel de campo. Solo el ID de
documento es único dentro de una colección. Dos escrituras concurrentes con
el mismo `code` en campos normales pueden pasar ambas si solo se valida con
una lectura previa (`query where code == X`) y luego un `set` — hay una
ventana de carrera entre leer y escribir.

**Decisión:** colección espejo `masterCodeRegistry`, con el documento cuyo
**ID** es `{collection}__{code-en-minusculas}` (ej. `categories__alim`).
Esto convierte la unicidad en "unicidad de ID de documento", que Firestore
sí garantiza atómicamente:

- Al crear, se hace un `runTransaction` que primero intenta `get()` sobre
  ese ID de registro. Si existe, se aborta con `DuplicateCodeError` **antes**
  de tocar la colección real.
- Firestore Security Rules refuerzan esto en el servidor:
  `allow create: if !exists(/databases/$(db)/documents/masterCodeRegistry/$(regId))`.
  Así la unicidad no depende solo del cliente — un cliente malicioso que
  ignore la transacción igual será rechazado por las reglas.
- La comparación case-insensitive se logra normalizando el código a
  minúsculas para construir el ID del registro (`ALIM`, `alim`, `Alim` →
  mismo ID `alim`).

**Residual:** si se necesita normalizar acentos/espacios de forma más
estricta, se debe extender la función `normalizeCode()` — está aislada en
un solo lugar para eso.

## 2. Claves foráneas / integridad referencial

**Limitación:** Firestore no tiene FKs. Nada impide, a nivel de base de
datos, insertar un `movement.categoryId` que apunte a una categoría
eliminada, ni impide eliminar una categoría que está siendo usada.

**Decisión:** la comprobación de referencias (`references` en la config) se
implementa como consultas explícitas (`where(field, '==', entityId)
limit(1)`) contra cada colección declarada, ejecutadas **antes** de borrar.
Se usa `limit(1)` por colección: para decidir "bloquear o no" basta con
saber si existe al menos una referencia, no cuántas — la cifra exacta
("15 movimientos") se obtiene con `count()` (agregación del lado del
servidor, no descarga documentos) solo para el mensaje al usuario.

**Residual — esto es lo importante:** esta comprobación es de
"mejor esfuerzo" hecha desde el cliente. Entre el momento en que se
comprueba "no hay referencias" y el momento en que se ejecuta el `delete`,
otro usuario podría crear una referencia nueva. Firestore no ofrece
transacciones que abarquen "leer resultados de una query en una colección A
+ escribir en colección B" con la misma garantía que una FK en SQL.

**Mitigación recomendada (no implementada como obligatoria, sí como
diseño):** exponer la eliminación real como una **Cloud Function callable**
(`deleteMasterEntity`) que corre con Admin SDK, repite la comprobación de
referencias justo antes de borrar, y es la única vía con permiso real de
`delete` en las reglas de Firestore (el cliente nunca borra directo). Se
incluye el stub de esa función en `functions/src/masterCrud.ts`. Esto no
elimina 100% la ventana de carrera (nada en un sistema NoSQL distribuido lo
hace sin locks pesados), pero la reduce a milisegundos en vez de al tiempo
que tarda un usuario en confirmar un modal, y centraliza la regla en un
solo lugar auditable.

## 3. Transacciones

**Limitación:** las transacciones de Firestore están acotadas (hasta 500
documentos, y no pueden mezclar lecturas después de escrituras dentro de la
misma transacción). Además, no pueden ejecutar agregaciones (`count()`)
dentro de una transacción en todos los SDKs/versiones.

**Decisión:** se usa transacción únicamente donde de verdad se necesita
atomicidad dura: crear/actualizar el par (entidad + registro de código). La
comprobación de referencias, al ser de mejor esfuerzo por el punto 2, se
hace **fuera** de transacción, con queries normales.

## 4. Concurrencia

**Limitación:** dos usuarios editando el mismo maestro al mismo tiempo
pueden pisarse cambios (last-write-wins es el comportamiento por defecto de
`updateDoc`).

**Decisión:** las operaciones de edición que tocan el código (campo
sensible) van dentro de `runTransaction`, así que si dos usuarios cambian el
código simultáneamente, uno de los dos obtiene `DuplicateCodeError` o un
reintento en vez de una corrupción silenciosa. Para campos no sensibles se
acepta last-write-wins (es el trade-off estándar y razonable para
maestros de baja frecuencia de edición).

## 5. Eliminación

**Limitación:** ya cubierta en el punto 2 — Firestore no impide borrar un
documento referenciado por otros.

**Decisión:** el flujo `¿tiene referencias? → si sí, bloquear; si no,
allowDelete ? físico : lógico` se implementa como una función pura
(`resolveDeleteStrategy`), fácil de testear sin mockear Firestore, y el
servicio la usa antes de decidir qué operación ejecutar.

## 6. Seguridad

**Limitación:** las Firestore Security Rules no pueden ejecutar
agregaciones ni queries arbitrarias contra otra colección para decidir
permisos (por ejemplo, "solo permite el delete si no hay documentos en
`movements` con `categoryId == resource.id`" **no** es expresable de forma
eficiente ni segura en reglas — como mucho se podría hacer un `exists()`
sobre un documento puntual, no un "no existen N documentos que cumplan X").

**Decisión y limitación explícita:** por esta razón, en `firestore.rules`
se **deniega** el `delete` directo desde el cliente sobre las colecciones
maestras (`allow delete: if false`) y toda eliminación real debe pasar por
la Cloud Function callable mencionada en el punto 2, que sí puede correr la
comprobación completa con Admin SDK antes de borrar. El cliente solo puede
hacer `update` (incluyendo desactivar, `active: false`) directamente, nunca
`delete`, salvo a través de esa función.

Lo que las reglas sí garantizan directamente:
- Solo usuarios autenticados leen/escriben.
- `createdBy`/`createdAt` no pueden cambiar después de creados
  (`request.resource.data.createdAt == resource.data.createdAt`).
- `updatedAt`/`updatedBy` deben cambiar en cada `update`.
- La unicidad de código vía `masterCodeRegistry` (punto 1).

## Resumen de qué es 100% garantizable vs. qué requiere backend

| Requisito | ¿Garantizable solo con reglas + cliente? |
|---|---|
| Código único (case-insensitive) | Sí, con el patrón de registro por ID |
| No modificar `createdAt`/`createdBy` | Sí, con reglas |
| Bloquear eliminación con referencias | Parcial — mejor esfuerzo desde cliente; garantía dura requiere Cloud Function |
| Bloqueo de `delete` directo | Sí, denegando en reglas y forzando Cloud Function |
| Auditoría completa e inmutable | Parcial — reglas pueden exigir que se cree un doc en `auditLogs` junto con cada escritura, pero garantizar que *siempre* se cree requiere Cloud Function (`onWrite` trigger) como red de seguridad |
