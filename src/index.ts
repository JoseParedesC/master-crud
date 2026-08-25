// Tipos base
export type {
  MasterEntity,
  MasterEntityInput,
  MasterFieldType,
  SelectOption,
  MasterFormField,
  MasterColumn,
  MasterReference,
  MasterCrudConfig,
  DeleteStrategy,
  MasterUiState,
  MasterFilters,
  CurrentUser,
  ReferenceCount,
} from './types';
export { EMPTY_MASTER_FILTERS } from './types';

// Errores
export {
  MasterError,
  DuplicateCodeError,
  ReferencedEntityError,
  PermissionError,
  ValidationError,
  NotFoundError,
  toMasterError,
} from './errors/masterErrors';

// Contrato del adaptador (lo que hace al paquete reutilizable)
export type { MasterCrudAdapter } from './adapters/types';

// Adaptador REST genérico (no depende de ningún backend concreto)
export { createRestAdapter, defaultResolveRoute } from './adapters/restAdapter';
export type { RestAdapterOptions, ResolveRouteParams, RestAction } from './adapters/restAdapter';

// Hook
export { useMasterCrud } from './hooks/useMasterCrud';
export type { UseMasterCrudOptions } from './hooks/useMasterCrud';

// Componentes
export { MasterCrud } from './components/MasterCrud';
export type { MasterCrudProps } from './components/MasterCrud';
export { MasterTable } from './components/MasterTable';
export { MasterForm } from './components/MasterForm';
export { MasterFiltersBar } from './components/MasterFiltersBar';
export { MasterModal } from './components/MasterModal';
export { DeleteConfirmation } from './components/DeleteConfirmation';
export { ReferenceWarning } from './components/ReferenceWarning';

// Schema base
export { baseMasterSchema } from './schemas/baseMasterSchema';

// NOTA: `createFirestoreAdapter` NO se exporta desde aquí para no forzar
// `firebase` como dependencia de quien no lo use. Está en el entry point
// separado: `@joseparedesc/master-crud/firestore`.
