import { describe, expect, it } from "vitest";
import {
  buildCodeRegistryId,
  normalizeCode,
  resolveDeleteStrategy,
} from "../services/firestore/deleteStrategy";

describe("resolveDeleteStrategy", () => {
  it("bloquea la eliminación cuando hay referencias", () => {
    const result = resolveDeleteStrategy(
      [{ description: "movimientos", count: 15 }],
      true
    );
    expect(result.kind).toBe("blocked");
  });

  it("detecta referencias en múltiples colecciones", () => {
    const result = resolveDeleteStrategy(
      [
        { description: "movimientos", count: 3 },
        { description: "presupuestos", count: 2 },
      ],
      true
    );
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.referencedBy).toHaveLength(2);
    }
  });

  it("ignora colecciones con 0 referencias al decidir si está referenciado", () => {
    const result = resolveDeleteStrategy(
      [
        { description: "movimientos", count: 0 },
        { description: "presupuestos", count: 0 },
      ],
      true
    );
    expect(result.kind).toBe("physical");
  });

  it("permite eliminación física cuando no hay referencias y allowDelete=true", () => {
    const result = resolveDeleteStrategy([], true);
    expect(result.kind).toBe("physical");
  });

  it("aplica borrado lógico cuando no hay referencias pero allowDelete=false", () => {
    const result = resolveDeleteStrategy([], false);
    expect(result.kind).toBe("soft");
  });
});

describe("normalizeCode / buildCodeRegistryId", () => {
  it("normaliza a minúsculas y sin espacios", () => {
    expect(normalizeCode("ALIM")).toBe("alim");
    expect(normalizeCode("  Alim ")).toBe("alim");
    expect(normalizeCode("alim")).toBe("alim");
  });

  it("genera el mismo ID de registro sin importar mayúsculas/minúsculas", () => {
    const a = buildCodeRegistryId("categories", "ALIM");
    const b = buildCodeRegistryId("categories", "alim");
    const c = buildCodeRegistryId("categories", "Alim");
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toBe("categories__alim");
  });
});
