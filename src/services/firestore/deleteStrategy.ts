export interface ReferenceCount {
  description: string;
  count: number;
}

import type { DeleteStrategy } from "../../components/master-crud/types";

/**
 * Decide qué operación ejecutar al "eliminar" un maestro, dado si tiene
 * referencias y si la configuración permite borrado físico.
 * Es una función pura: no toca Firestore, así que se testea sin mocks.
 *
 *   ¿Tiene referencias?
 *          │
 *          ├── Sí  → blocked
 *          │
 *          └── No
 *               ├── allowDelete = true  → physical
 *               └── allowDelete = false → soft
 */
export function resolveDeleteStrategy(
  referenceCounts: ReferenceCount[],
  allowDelete: boolean
): DeleteStrategy {
  const referencedBy = referenceCounts.filter((r) => r.count > 0);

  if (referencedBy.length > 0) {
    return { kind: "blocked", referencedBy };
  }

  return allowDelete ? { kind: "physical" } : { kind: "soft" };
}

/** Normaliza un código para usarlo como parte del ID del registro de unicidad */
export function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export function buildCodeRegistryId(collection: string, code: string): string {
  return `${collection}__${normalizeCode(code)}`;
}
