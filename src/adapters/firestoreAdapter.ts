import type {
  Firestore,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import {
  collection,
  doc,
  orderBy,
  limit,
  where,
  getDocs,
  query,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  getCountFromServer,
  Timestamp,
} from 'firebase/firestore';
import type { CurrentUser, MasterCrudConfig, MasterEntity, MasterFilters, ReferenceCount } from '../types';
import { DuplicateCodeError, ReferencedEntityError, toMasterError } from '../errors/masterErrors';
import type { MasterCrudAdapter } from './types';

const CODE_REGISTRY_COLLECTION = 'masterCodeRegistry';
const USERS_COLLECTION = 'users';

export function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

export function buildCodeRegistryId(collectionName: string, code: string): string {
  return `${collectionName}__${normalizeCode(code)}`;
}

export function resolveDeleteStrategy(referenceCounts: ReferenceCount[], allowDelete: boolean) {
  const referencedBy = referenceCounts.filter((r) => r.count > 0);
  if (referencedBy.length > 0) return { kind: 'blocked' as const, referencedBy };
  return allowDelete ? { kind: 'physical' as const } : { kind: 'soft' as const };
}

function toIsoDate(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return new Date().toISOString();
}

function fromFirestoreDoc<T extends MasterEntity>(id: string, data: DocumentData): T {
  return {
    id,
    ...data,
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
  } as T;
}

/**
 * Crea un adaptador que reproduce exactamente el comportamiento original
 * de `MasterCrudService` sobre Cloud Firestore (registro de códigos único
 * vía transacción, borrado lógico/físico según referencias, etc.).
 *
 * Vive en un entry point aparte (`@joseparedesc/master-crud/firestore`)
 * para que los proyectos que NO usan Firebase no necesiten instalarlo.
 */
export function createFirestoreAdapter<T extends MasterEntity>(
  db: Firestore,
  config: MasterCrudConfig<T>,
): MasterCrudAdapter<T> {
  function col(uid: string) {
    return collection(db, USERS_COLLECTION, uid, config.collection);
  }
  function registryDoc(uid: string, registryId: string) {
    return doc(db, USERS_COLLECTION, uid, CODE_REGISTRY_COLLECTION, registryId);
  }
  function referenceCol(uid: string, collectionName: string) {
    return collection(db, USERS_COLLECTION, uid, collectionName);
  }

  const adapter: MasterCrudAdapter<T> = {
    async list(filters: MasterFilters, user: CurrentUser) {
      try {
        const constraints: QueryConstraint[] = [
          orderBy(config.nameField, 'asc'),
          limit(config.pageSize ?? 200),
        ];
        if (filters.status !== 'all') {
          constraints.unshift(where('active', '==', filters.status === 'active'));
        }
        const snap = await getDocs(query(col(user.uid), ...constraints));
        const all = snap.docs.map((d) => fromFirestoreDoc<T>(d.id, d.data()));
        if (!filters.search.trim()) return all;
        const term = filters.search.trim().toLowerCase();
        return all.filter((row) =>
          config.searchableFields.some((field) => String(row[field] ?? '').toLowerCase().includes(term)),
        );
      } catch (error) {
        throw toMasterError(error);
      }
    },

    async getById(id: string, user: CurrentUser) {
      try {
        const snap = await getDoc(doc(db, USERS_COLLECTION, user.uid, config.collection, id));
        if (!snap.exists()) return null;
        return fromFirestoreDoc<T>(snap.id, snap.data());
      } catch (error) {
        throw toMasterError(error);
      }
    },

    async create(input: Partial<T>, user: CurrentUser) {
      const code = config.codeField ? (input as Record<string, unknown>)[config.codeField] : undefined;
      try {
        const newDocRef = doc(col(user.uid));
        const result = await runTransaction(db, async (tx) => {
          if (code && config.codeField) {
            const registryId = buildCodeRegistryId(config.collection, String(code));
            const registryRef = registryDoc(user.uid, registryId);
            const registrySnap = await tx.get(registryRef);
            if (registrySnap.exists()) {
              throw new DuplicateCodeError(String(code));
            }
            tx.set(registryRef, {
              collection: config.collection,
              code: normalizeCode(String(code)),
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
        return fromFirestoreDoc<T>(newDocRef.id, result as DocumentData);
      } catch (error) {
        throw toMasterError(error);
      }
    },

    async update(id: string, changes: Partial<T>, user: CurrentUser) {
      const { createdAt: _createdAt, createdBy: _createdBy, ...safeChanges } = changes as Record<string, unknown>;
      const nextCode =
        config.codeField && config.codeField in safeChanges
          ? (safeChanges[config.codeField] as string)
          : undefined;

      try {
        await runTransaction(db, async (tx) => {
          const entityRef = doc(db, USERS_COLLECTION, user.uid, config.collection, id);
          const currentSnap = await tx.get(entityRef);
          if (!currentSnap.exists()) {
            throw new Error('not-found');
          }
          const current = currentSnap.data();

          if (nextCode && config.codeField) {
            const currentCode = current[config.codeField];
            if (normalizeCode(currentCode) !== normalizeCode(nextCode)) {
              const newRegistryId = buildCodeRegistryId(config.collection, nextCode);
              const newRegistryRef = registryDoc(user.uid, newRegistryId);
              const newRegistrySnap = await tx.get(newRegistryRef);
              if (newRegistrySnap.exists()) {
                throw new DuplicateCodeError(nextCode);
              }
              const oldRegistryId = buildCodeRegistryId(config.collection, currentCode);
              tx.delete(registryDoc(user.uid, oldRegistryId));
              tx.set(newRegistryRef, {
                collection: config.collection,
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
    },

    async setActive(id: string, active: boolean, user: CurrentUser) {
      try {
        await updateDoc(doc(db, USERS_COLLECTION, user.uid, config.collection, id), {
          active,
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        });
      } catch (error) {
        throw toMasterError(error);
      }
    },

    async countReferences(entityId: string, user: CurrentUser) {
      const references = config.references ?? [];
      try {
        return await Promise.all(
          references.map(async (ref) => {
            const q = query(referenceCol(user.uid, ref.collection), where(ref.field, '==', entityId));
            const snap = await getCountFromServer(q);
            return { description: ref.description, count: snap.data().count };
          }),
        );
      } catch (error) {
        throw toMasterError(error);
      }
    },

    async remove(entity: T, user: CurrentUser) {
      try {
        const referenceCounts = await adapter.countReferences!(entity.id, user);
        const strategy = resolveDeleteStrategy(referenceCounts, config.allowDelete ?? false);

        if (strategy.kind === 'blocked') {
          throw new ReferencedEntityError(String(entity[config.nameField]), strategy.referencedBy);
        }
        if (strategy.kind === 'soft') {
          await adapter.setActive(entity.id, false, user);
          return { softDeleted: true };
        }

        await runTransaction(db, async (tx) => {
          const entityRef = doc(db, USERS_COLLECTION, user.uid, config.collection, entity.id);
          if (config.codeField) {
            const registryId = buildCodeRegistryId(config.collection, String(entity[config.codeField]));
            tx.delete(registryDoc(user.uid, registryId));
          }
          tx.delete(entityRef);
        });
        return { softDeleted: false };
      } catch (error) {
        throw toMasterError(error);
      }
    },
  };

  return adapter;
}
