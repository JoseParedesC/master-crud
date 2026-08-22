import type { ZodType } from "zod";
import type { MasterEntity } from "../../types/master";

export type MasterFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "boolean"
  | "date"
  | "color";

export interface SelectOption {
  value: string;
  label: string;
}

export interface MasterFormField<T extends MasterEntity> {
  name: keyof T & string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  placeholder?: string;
  /** Requerido cuando type === "select" */
  options?: SelectOption[];
  /** Deshabilita el campo en modo edición (ej: código, una vez usado) */
  disabledOnEdit?: boolean;
  helperText?: string;
}

export interface MasterColumn<T extends MasterEntity> {
  field: keyof T & string;
  label: string;
  /** Formateo custom para la celda (ej: fechas, badges) */
  render?: (value: unknown, row: T) => string;
  sortable?: boolean;
}

export interface MasterReference {
  /** Colección donde puede existir la referencia, ej: "movements" */
  collection: string;
  /** Campo dentro de esa colección que apunta al id del maestro */
  field: string;
  /** Texto humano usado en los mensajes, ej: "movimientos" */
  description: string;
}

export interface MasterCrudConfig<T extends MasterEntity> {
  /** Nombre de la colección en Firestore, ej: "categories" */
  collection: string;

  title: string;
  singularTitle: string;

  /** Campo usado para la unicidad de código. Si se omite, no se valida unicidad. */
  codeField?: keyof T & string;

  nameField: keyof T & string;

  searchableFields: (keyof T & string)[];

  columns: MasterColumn<T>[];

  formFields: MasterFormField<T>[];

  references?: MasterReference[];

  /** Si es true, permite DELETE físico cuando no hay referencias. Default: false (solo desactivar). */
  allowDelete?: boolean;

  /** Si es true, muestra la acción de activar/desactivar. Default: true. */
  allowDeactivate?: boolean;

  validationSchema: ZodType<unknown>;

  /** Tamaño de página para la tabla. Default: 20. */
  pageSize?: number;
}

export type DeleteStrategy =
  | { kind: "blocked"; referencedBy: { description: string; count: number }[] }
  | { kind: "physical" }
  | { kind: "soft" };

export type MasterUiState =
  | "loading"
  | "empty"
  | "error"
  | "success"
  | "submitting"
  | "deleting"
  | "checkingReferences";

export interface MasterFilters {
  search: string;
  status: "all" | "active" | "inactive";
}

export const EMPTY_MASTER_FILTERS: MasterFilters = {
  search: "",
  status: "all",
};
