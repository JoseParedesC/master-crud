// ── Componente principal ──────────────────────────────────────────────
export { MasterCrud } from "./components/master-crud/MasterCrud";

// Sub-componentes exportados por si alguien quiere componer su propia UI
export { MasterTable } from "./components/master-crud/MasterTable";
export { MasterForm } from "./components/master-crud/MasterForm";
export { MasterFiltersBar } from "./components/master-crud/MasterFilters";
export { MasterModal } from "./components/master-crud/MasterModal";
export { DeleteConfirmation } from "./components/master-crud/DeleteConfirmation";
export { ReferenceWarning } from "./components/master-crud/ReferenceWarning";

// ── Hook ────────────────────────────────────────────────────────────
export { useMasterCrud } from "./hooks/useMasterCrud";

// ── Servicio (para quien necesite lógica sin la UI) ────────────────
export { MasterCrudService } from "./services/firestore/masterCrud.service";
export {
  resolveDeleteStrategy,
  normalizeCode,
  buildCodeRegistryId,
} from "./services/firestore/deleteStrategy";
export type { ReferenceCount } from "./services/firestore/deleteStrategy";

// ── Schemas base (útiles como punto de partida) ────────────────────
export { baseMasterSchema } from "./schemas/master.schema";

// ── Errores de dominio ──────────────────────────────────────────────
export {
  MasterError,
  DuplicateCodeError,
  ReferencedEntityError,
  PermissionError,
  ValidationError,
  NotFoundError,
  toMasterError,
} from "./errors/masterErrors";

// ── Tipos ───────────────────────────────────────────────────────────
export type { MasterEntity, MasterEntityInput, AuditLog } from "./types/master";
export type {
  MasterCrudConfig,
  MasterColumn,
  MasterFormField,
  MasterFieldType,
  MasterReference,
  MasterFilters,
  MasterUiState,
  DeleteStrategy,
  SelectOption,
} from "./components/master-crud/types";
export { EMPTY_MASTER_FILTERS } from "./components/master-crud/types";
