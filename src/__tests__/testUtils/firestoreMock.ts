/**
 * Fake mínimo de `firebase/firestore`, en memoria, que reproduce solo las
 * funciones que usa `MasterCrudService`. Suficiente para testear la LÓGICA
 * DE NEGOCIO (unicidad, referencias, auditoría) de forma rápida y
 * determinista — no reemplaza al Firestore Emulator para tests de
 * integración reales.
 *
 * Se usa así en un archivo de test:
 *
 *   vi.mock("firebase/firestore", async () => import("./testUtils/firestoreMock"));
 *   import { store } from "./testUtils/firestoreMock";
 *   beforeEach(() => store.reset());
 */

interface StoredDoc {
  id: string;
  data: Record<string, unknown>;
}

type WhereConstraint = { kind: "where"; field: string; op: string; value: unknown };
type OrderConstraint = { kind: "orderBy"; field: string; direction: string };
type LimitConstraint = { kind: "limit"; value: number };
type Constraint = WhereConstraint | OrderConstraint | LimitConstraint;

class FakeStore {
  collections = new Map<string, Map<string, Record<string, unknown>>>();
  private counter = 0;

  private getCollection(path: string) {
    if (!this.collections.has(path)) this.collections.set(path, new Map());
    return this.collections.get(path)!;
  }

  reset() {
    this.collections.clear();
    this.counter = 0;
  }

  seed(path: string, id: string, data: Record<string, unknown>) {
    this.getCollection(path).set(id, data);
  }

  get(path: string, id: string): StoredDoc | null {
    const data = this.getCollection(path).get(id);
    return data ? { id, data } : null;
  }

  set(path: string, id: string, data: Record<string, unknown>) {
    this.getCollection(path).set(id, data);
  }

  update(path: string, id: string, changes: Record<string, unknown>) {
    const current = this.getCollection(path).get(id) ?? {};
    this.getCollection(path).set(id, { ...current, ...changes });
  }

  delete(path: string, id: string) {
    this.getCollection(path).delete(id);
  }

  newId(path: string) {
    this.counter += 1;
    return `${path}-auto-${this.counter}`;
  }

  queryAll(path: string, constraints: Constraint[]): StoredDoc[] {
    let docs = Array.from(this.getCollection(path).entries()).map(
      ([id, data]) => ({ id, data })
    );

    for (const c of constraints) {
      if (c.kind === "where") {
        docs = docs.filter((d) => d.data[c.field] === c.value);
      }
    }
    for (const c of constraints) {
      if (c.kind === "orderBy") {
        docs = [...docs].sort((a, b) => {
          const av = String(a.data[c.field] ?? "");
          const bv = String(b.data[c.field] ?? "");
          return c.direction === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
        });
      }
    }
    for (const c of constraints) {
      if (c.kind === "limit") {
        docs = docs.slice(0, c.value);
      }
    }
    return docs;
  }
}

export const store = new FakeStore();

function joinPath(parts: unknown[]) {
  return parts.filter((part) => typeof part === "string").join("/");
}

export function collection(_db: unknown, ...pathParts: unknown[]) {
  return { __type: "collection", path: joinPath(pathParts) };
}

export function doc(...args: unknown[]) {
  if (args.length === 1) {
    const collRef = args[0] as { path: string };
    return { __type: "doc", path: collRef.path, id: store.newId(collRef.path) };
  }
  const pathParts = args.slice(1);
  const id = pathParts.pop() as string;
  return { __type: "doc", path: joinPath(pathParts), id };
}

export function where(field: string, op: string, value: unknown): WhereConstraint {
  return { kind: "where", field, op, value };
}
export function orderBy(field: string, direction = "asc"): OrderConstraint {
  return { kind: "orderBy", field, direction };
}
export function limit(value: number): LimitConstraint {
  return { kind: "limit", value };
}

export function query(collRef: { path: string }, ...constraints: Constraint[]) {
  return { __type: "query", path: collRef.path, constraints };
}

export async function getDoc(ref: { path: string; id: string }) {
  const found = store.get(ref.path, ref.id);
  return {
    exists: () => found !== null,
    data: () => found?.data,
    id: ref.id,
  };
}

export async function getDocs(q: { path: string; constraints?: Constraint[] }) {
  const docs = store.queryAll(q.path, q.constraints ?? []);
  return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })) };
}

export async function getCountFromServer(q: { path: string; constraints?: Constraint[] }) {
  const docs = store.queryAll(q.path, q.constraints ?? []);
  return { data: () => ({ count: docs.length }) };
}

export async function updateDoc(
  ref: { path: string; id: string },
  changes: Record<string, unknown>
) {
  store.update(ref.path, ref.id, changes);
}

export function serverTimestamp() {
  return { __serverTimestamp: true, toDate: () => new Date() };
}

export async function runTransaction(
  _db: unknown,
  updateFn: (tx: {
    get: (ref: { path: string; id: string }) => Promise<{
      exists: () => boolean;
      data: () => Record<string, unknown> | undefined;
    }>;
    set: (ref: { path: string; id: string }, data: Record<string, unknown>) => void;
    update: (ref: { path: string; id: string }, changes: Record<string, unknown>) => void;
    delete: (ref: { path: string; id: string }) => void;
  }) => unknown
) {
  const tx = {
    get: async (ref: { path: string; id: string }) => {
      const found = store.get(ref.path, ref.id);
      return { exists: () => found !== null, data: () => found?.data };
    },
    set: (ref: { path: string; id: string }, data: Record<string, unknown>) => {
      store.set(ref.path, ref.id, data);
    },
    update: (ref: { path: string; id: string }, changes: Record<string, unknown>) => {
      store.update(ref.path, ref.id, changes);
    },
    delete: (ref: { path: string; id: string }) => {
      store.delete(ref.path, ref.id);
    },
  };
  return updateFn(tx);
}
