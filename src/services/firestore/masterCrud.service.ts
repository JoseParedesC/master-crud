import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import type { MasterEntity } from "../../types/master";
import type {
  MasterCrudConfig,
  MasterFilters,
  MasterReference,
} from "../../components/master-crud/types";
import {
  DuplicateCodeError,
  ReferencedEntityError,
  toMasterError,
} from "../../errors/masterErrors";
import {
  buildCodeRegistryId,
  normalizeCode,
  resolveDeleteStrategy,
  type ReferenceCount,
} from "./deleteStrategy";

const CODE_REGISTRY_COLLECTION = "masterCodeRegistry";

interface CurrentUser {
  uid: string;
}

/**
 * Servicio genérico de acceso a Firestore para cualquier maestro. No
 * conoce "categorías" ni ningún dominio concreto: todo el comportamiento
 * específico viene de `MasterCrudConfig<T>`. Ningún componente visual
 * debe importar `firebase/firestore` directamente — todos pasan por aquí
 * (o por el hook `useMasterCrud`, que a su vez llama a este servicio).
 */
export class MasterCrudService<T extends MasterEntity> {
  constructor(
    private readonly db: Firestore,
    private readonly config: MasterCrudConfig<T>
  ) {}

  private col() {
    return collection(this.db, this.config.collection);
  }

  // ── Lectura ────────────────────────────────────────────────────────

  async list(filters: MasterFilters): Promise<T[]> {
    try {
      const constraints: QueryConstraint[] = [
        orderBy(this.config.nameField as string, "asc"),
        limit(this.config.pageSize ?? 200),
      ];

      if (filters.status !== "all") {
        constraints.unshift(where("active", "==", filters.status === "active"));
      }

      const snap = await getDocs(query(this.col(), ...constraints));
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

      // La búsqueda de texto libre se filtra en cliente porque Firestore
      // no soporta "contains" nativo sobre múltiples campos sin un motor
      // de búsqueda externo (Algolia/Typesense). Para colecciones de
      // maestros (decenas/cientos de filas) esto es aceptable; si crecen
      // mucho, se recomienda un índice de búsqueda externo.
      if (!filters.search.trim()) return all;
      const term = filters.search.trim().toLowerCase();
      return all.filter((row) =>
        this.config.searchableFields.some((field) =>
          String(row[field] ?? "").toLowerCase().includes(term)
        )
      );
    } catch (error) {
      throw toMasterError(error);
    }
  }

  async getById(id: string): Promise<T | null> {
    try {
      const snap = await getDoc(doc(this.db, this.config.collection, id));
      if (!snap.exists()) return null;
      return { id: snap.id, ...snap.data() } as T;
    } catch (error) {
      throw toMasterError(error);
    }
  }

  // ── Escritura ──────────────────────────────────────────────────────

  /**
   * Crea un maestro. Si `codeField` está configurado, la creación del
   * documento real y del documento de "registro de código" ocurre en la
   * misma transacción: si el código ya existe, la transacción falla con
   * DuplicateCodeError y NO se crea ningún documento a medias.
   */
  async create(input: Partial<T>, user: CurrentUser): Promise<T> {
    const code = this.config.codeField
      ? (input[this.config.codeField] as unknown as string)
      : undefined;

    try {
      const newDocRef = doc(this.col());

      const result = await runTransaction(this.db, async (tx) => {
        if (code && this.config.codeField) {
          const registryId = buildCodeRegistryId(this.config.collection, code);
          const registryRef = doc(this.db, CODE_REGISTRY_COLLECTION, registryId);
          const registrySnap = await tx.get(registryRef);
          if (registrySnap.exists()) {
            throw new DuplicateCodeError(code);
          }
          tx.set(registryRef, {
            collection: this.config.collection,
            code: normalizeCode(code),
            entityId: newDocRef.id,
          });
        }

        const payload = {
          ...input,
          active: input.active ?? true,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        };
        tx.set(newDocRef, payload);
        return payload;
      });

      return { id: newDocRef.id, ...result } as unknown as T;
    } catch (error) {
      throw toMasterError(error);
    }
  }

  /**
   * Actualiza un maestro. Si el código cambia, se re-valida unicidad
   * (liberando el registro anterior y reservando el nuevo) dentro de la
   * misma transacción. `createdAt`/`createdBy` nunca se tocan aquí ni se
   * aceptan en el payload.
   */
  async update(
    id: string,
    changes: Partial<T>,
    user: CurrentUser
  ): Promise<void> {
    const { createdAt: _createdAt, createdBy: _createdBy, ...safeChanges } =
      changes as Record<string, unknown>;

    const nextCode =
      this.config.codeField && this.config.codeField in safeChanges
        ? (safeChanges[this.config.codeField as string] as string)
        : undefined;

    try {
      await runTransaction(this.db, async (tx) => {
        const entityRef = doc(this.db, this.config.collection, id);
        const currentSnap = await tx.get(entityRef);
        if (!currentSnap.exists()) {
          throw new Error("not-found");
        }
        const current = currentSnap.data() as T;

        if (nextCode && this.config.codeField) {
          const currentCode = current[this.config.codeField] as unknown as string;
          if (normalizeCode(currentCode) !== normalizeCode(nextCode)) {
            const newRegistryId = buildCodeRegistryId(
              this.config.collection,
              nextCode
            );
            const newRegistryRef = doc(
              this.db,
              CODE_REGISTRY_COLLECTION,
              newRegistryId
            );
            const newRegistrySnap = await tx.get(newRegistryRef);
            if (newRegistrySnap.exists()) {
              throw new DuplicateCodeError(nextCode);
            }

            const oldRegistryId = buildCodeRegistryId(
              this.config.collection,
              currentCode
            );
            tx.delete(doc(this.db, CODE_REGISTRY_COLLECTION, oldRegistryId));
            tx.set(newRegistryRef, {
              collection: this.config.collection,
              code: normalizeCode(nextCode),
              entityId: id,
            });
          }
        }

        tx.update(entityRef, {
          ...safeChanges,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      });
    } catch (error) {
      throw toMasterError(error);
    }
  }

  async setActive(id: string, active: boolean, user: CurrentUser): Promise<void> {
    try {
      await updateDoc(doc(this.db, this.config.collection, id), {
        active,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      });
    } catch (error) {
      throw toMasterError(error);
    }
  }

  // ── Referencias / eliminación ──────────────────────────────────────

  /**
   * Cuenta, por cada referencia declarada en la config, cuántos documentos
   * apuntan a este maestro. Usa `getCountFromServer` (agregación) para no
   * descargar documentos completos solo para saber si existen.
   */
  async countReferences(entityId: string): Promise<ReferenceCount[]> {
    const references: MasterReference[] = this.config.references ?? [];
    try {
      const results = await Promise.all(
        references.map(async (ref) => {
          const q = query(
            collection(this.db, ref.collection),
            where(ref.field, "==", entityId)
          );
          const snap = await getCountFromServer(q);
          return { description: ref.description, count: snap.data().count };
        })
      );
      return results;
    } catch (error) {
      throw toMasterError(error);
    }
  }

  /**
   * Punto de entrada de "eliminar" desde la UI. Aplica la regla:
   * referencias -> bloquear; sin referencias -> físico o lógico según
   * `allowDelete`. Ver ANALYSIS.md sobre por qué esta comprobación es de
   * mejor esfuerzo y por qué en producción se recomienda mover el borrado
   * físico real a una Cloud Function callable.
   */
  async remove(entity: T, user: CurrentUser): Promise<{ softDeleted: boolean }> {
    try {
      const referenceCounts = await this.countReferences(entity.id);
      const strategy = resolveDeleteStrategy(
        referenceCounts,
        this.config.allowDelete ?? false
      );

      if (strategy.kind === "blocked") {
        throw new ReferencedEntityError(
          String(entity[this.config.nameField]),
          strategy.referencedBy
        );
      }

      if (strategy.kind === "soft") {
        await this.setActive(entity.id, false, user);
        return { softDeleted: true };
      }

      // Física: liberar también el registro de código, si aplica.
      await runTransaction(this.db, async (tx) => {
        const entityRef = doc(this.db, this.config.collection, entity.id);
        if (this.config.codeField) {
          const code = entity[this.config.codeField] as unknown as string;
          const registryId = buildCodeRegistryId(this.config.collection, code);
          tx.delete(doc(this.db, CODE_REGISTRY_COLLECTION, registryId));
        }
        tx.delete(entityRef);
      });
      return { softDeleted: false };
    } catch (error) {
      throw toMasterError(error);
    }
  }
}
