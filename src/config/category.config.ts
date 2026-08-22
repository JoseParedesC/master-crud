import type { MasterCrudConfig } from "../components/master-crud/types";
import type { MasterEntity } from "../types/master";
import { categorySchema } from "../schemas/master.schema";

export interface Category extends MasterEntity {
  description?: string;
  color?: string;
}

export const categoryConfig: MasterCrudConfig<Category> = {
  collection: "categories",

  title: "Categorías",
  singularTitle: "Categoría",

  codeField: "code",
  nameField: "name",

  searchableFields: ["code", "name", "description"],

  columns: [
    { field: "code", label: "Código", sortable: true },
    { field: "name", label: "Nombre", sortable: true },
    { field: "active", label: "Estado" },
    { field: "createdAt", label: "Creado", sortable: true },
    { field: "updatedAt", label: "Actualizado", sortable: true },
  ],

  formFields: [
    {
      name: "code",
      label: "Código",
      type: "text",
      required: true,
      placeholder: "Ej: ALIM",
      disabledOnEdit: true,
      helperText: "No se puede modificar después de creado.",
    },
    {
      name: "name",
      label: "Nombre",
      type: "text",
      required: true,
      placeholder: "Ej: Alimentación",
    },
    {
      name: "description",
      label: "Descripción",
      type: "textarea",
      placeholder: "Opcional",
    },
    {
      name: "color",
      label: "Color",
      type: "text",
      placeholder: "#1F6D5A",
    },
  ],

  references: [
    {
      collection: "movements",
      field: "categoryId",
      description: "movimientos",
    },
    {
      collection: "budgets",
      field: "categoryId",
      description: "presupuestos",
    },
  ],

  allowDelete: true,
  allowDeactivate: true,

  validationSchema: categorySchema,
};
