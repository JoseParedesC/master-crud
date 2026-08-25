import type { CurrentUser, MasterEntity, MasterFilters, ReferenceCount } from '../types';

/**
 * Contrato que debe cumplir cualquier fuente de datos para que
 * `<MasterCrud />` / `useMasterCrud` puedan administrarla.
 *
 * El componente y el hook NUNCA hablan con Firestore, fetch, axios, etc.
 * directamente — solo conocen esta interfaz. Esto es lo que hace que el
 * paquete sea reutilizable en cualquier proyecto: cada proyecto trae su
 * propio adaptador (o usa uno de los incluidos) según cómo resuelva sus
 * rutas / persistencia.
 *
 * Adaptadores incluidos en este paquete:
 * - `createRestAdapter` (`@joseparedesc/master-crud`): habla con cualquier
 *   API REST, con resolución de rutas 100% configurable.
 * - `createFirestoreAdapter` (`@joseparedesc/master-crud/firestore`):
 *   mantiene el comportamiento original sobre Cloud Firestore.
 */
export interface MasterCrudAdapter<T extends MasterEntity> {
  list(filters: MasterFilters, user: CurrentUser): Promise<T[]>;
  getById(id: string, user: CurrentUser): Promise<T | null>;
  create(input: Partial<T>, user: CurrentUser): Promise<T>;
  update(id: string, changes: Partial<T>, user: CurrentUser): Promise<void>;
  setActive(id: string, active: boolean, user: CurrentUser): Promise<void>;
  /**
   * Opcional: cuenta referencias entrantes para mostrar una advertencia
   * ANTES de que el usuario confirme el borrado. Si el backend no expone
   * esa información de antemano, se puede omitir — `remove()` sigue
   * pudiendo rechazar el borrado (ver `ReferencedEntityError`), solo que
   * la UI no lo sabrá hasta que el usuario confirme.
   */
  countReferences?(entityId: string, user: CurrentUser): Promise<ReferenceCount[]>;
  /**
   * Punto de entrada de "eliminar". Debe implementar la regla de negocio:
   * si hay referencias, lanzar `ReferencedEntityError`; si no, borrar
   * físico o lógico según corresponda, y devolver `{ softDeleted }`.
   */
  remove(entity: T, user: CurrentUser): Promise<{ softDeleted: boolean }>;
}
