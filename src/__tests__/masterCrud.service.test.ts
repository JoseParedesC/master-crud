import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", async () => import("./testUtils/firestoreMock"));

import { store } from "./testUtils/firestoreMock";
import { MasterCrudService } from "../services/firestore/masterCrud.service";
import {
  DuplicateCodeError,
  ReferencedEntityError,
  PermissionError,
  MasterError,
} from "../errors/masterErrors";
import type { MasterEntity } from "../types/master";
import type { MasterCrudConfig } from "../components/master-crud/types";

interface TestCategory extends MasterEntity {
  description?: string;
}

const config: MasterCrudConfig<TestCategory> = {
  collection: "categories",
  title: "Categorías",
  singularTitle: "Categoría",
  codeField: "code",
  nameField: "name",
  searchableFields: ["code", "name"],
  columns: [],
  formFields: [],
  references: [
    { collection: "movements", field: "categoryId", description: "movimientos" },
    { collection: "budgets", field: "categoryId", description: "presupuestos" },
  ],
  allowDelete: true,
  allowDeactivate: true,
  validationSchema: {} as never,
};

const configNoDelete: MasterCrudConfig<TestCategory> = {
  ...config,
  allowDelete: false,
};

const user = { uid: "user-1" };
// db no se usa realmente (el mock ignora el primer argumento)
const db = {} as never;

describe("MasterCrudService", () => {
  beforeEach(() => {
    store.reset();
  });

  it("crea un maestro nuevo", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );
    expect(created.id).toBeDefined();
    expect(created).toMatchObject({ code: "ALIM", name: "Alimentación", active: true });
    expect(created.createdBy).toBe("user-1");
  });

  it("rechaza un código duplicado", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    await service.create({ code: "ALIM", name: "Alimentación" } as Partial<TestCategory>, user);

    await expect(
      service.create({ code: "ALIM", name: "Comida" } as Partial<TestCategory>, user)
    ).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it("rechaza un código duplicado ignorando mayúsculas/minúsculas", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    await service.create({ code: "ALIM", name: "Alimentación" } as Partial<TestCategory>, user);

    await expect(
      service.create({ code: "alim", name: "Comida" } as Partial<TestCategory>, user)
    ).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it("edita un maestro manteniendo createdAt y createdBy", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );
    const originalCreatedAt = created.createdAt;

    await service.update(created.id, { name: "Alimentación y bebidas" } as Partial<TestCategory>, {
      uid: "user-2",
    });

    const stored = store.get("categories", created.id);
    expect(stored?.data.createdAt).toBe(originalCreatedAt);
    expect(stored?.data.createdBy).toBe("user-1");
  });

  it("actualiza updatedAt y updatedBy durante la edición", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );

    await service.update(created.id, { name: "Alimentación y bebidas" } as Partial<TestCategory>, {
      uid: "user-2",
    });

    const stored = store.get("categories", created.id);
    expect(stored?.data.updatedBy).toBe("user-2");
    expect(stored?.data.name).toBe("Alimentación y bebidas");
  });

  it("no permite cambiar el código a uno ya usado por otro registro", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    await service.create({ code: "ALIM", name: "Alimentación" } as Partial<TestCategory>, user);
    const transporte = await service.create(
      { code: "TRAN", name: "Transporte" } as Partial<TestCategory>,
      user
    );

    await expect(
      service.update(transporte.id, { code: "ALIM" } as Partial<TestCategory>, user)
    ).rejects.toBeInstanceOf(DuplicateCodeError);
  });

  it("elimina un maestro sin referencias (borrado físico si allowDelete=true)", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );

    const result = await service.remove(created, user);
    expect(result.softDeleted).toBe(false);
    expect(store.get("categories", created.id)).toBeNull();
    // el registro de código también debe liberarse
    expect(store.get("masterCodeRegistry", "categories__alim")).toBeNull();
  });

  it("rechaza la eliminación cuando existen referencias", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );
    store.seed("movements", "mov-1", { categoryId: created.id });

    await expect(service.remove(created, user)).rejects.toBeInstanceOf(
      ReferencedEntityError
    );
    // no debe haberse borrado
    expect(store.get("categories", created.id)).not.toBeNull();
  });

  it("detecta referencias en múltiples colecciones", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );
    store.seed("movements", "mov-1", { categoryId: created.id });
    store.seed("budgets", "bud-1", { categoryId: created.id });

    const counts = await service.countReferences(created.id);
    expect(counts.find((c) => c.description === "movimientos")?.count).toBe(1);
    expect(counts.find((c) => c.description === "presupuestos")?.count).toBe(1);
  });

  it("desactiva un maestro cuando no se permite borrado físico", async () => {
    const service = new MasterCrudService<TestCategory>(db, configNoDelete);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );

    const result = await service.remove(created, user);
    expect(result.softDeleted).toBe(true);
    const stored = store.get("categories", created.id);
    expect(stored?.data.active).toBe(false);
  });

  it("reactiva un maestro desactivado", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );
    await service.setActive(created.id, false, user);
    await service.setActive(created.id, true, user);

    const stored = store.get("categories", created.id);
    expect(stored?.data.active).toBe(true);
  });

  it("traduce un error de permisos de Firestore a PermissionError", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    const created = await service.create(
      { code: "ALIM", name: "Alimentación" } as Partial<TestCategory>,
      user
    );

    const originalCountReferences = service.countReferences.bind(service);
    service.countReferences = vi.fn().mockRejectedValue({ code: "permission-denied" });

    await expect(service.remove(created, user)).rejects.toBeInstanceOf(PermissionError);

    service.countReferences = originalCountReferences;
  });

  it("traduce un error genérico de Firestore a MasterError sin exponer detalles internos", async () => {
    const service = new MasterCrudService<TestCategory>(db, config);
    service.countReferences = vi.fn().mockRejectedValue(new Error("internal firestore boom"));

    await expect(
      service.remove(
        { id: "x", code: "X", name: "X", active: true } as unknown as TestCategory,
        user
      )
    ).rejects.toMatchObject({ name: expect.stringMatching(/MasterError|ReferencedEntityError/) });

    // el mensaje mostrado al usuario nunca debe incluir el texto interno
    try {
      await service.remove(
        { id: "y", code: "Y", name: "Y", active: true } as unknown as TestCategory,
        user
      );
    } catch (error) {
      expect(error).toBeInstanceOf(MasterError);
      expect((error as Error).message).not.toContain("internal firestore boom");
    }
  });
});
