import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { CurrentUser, MasterCrudConfig, MasterEntity } from '../types';
import type { MasterCrudAdapter } from '../adapters/types';
import { useMasterCrud } from '../hooks/useMasterCrud';
import { MasterFiltersBar } from './MasterFiltersBar';
import { MasterTable } from './MasterTable';
import { MasterForm } from './MasterForm';
import { MasterModal } from './MasterModal';
import { DeleteConfirmation } from './DeleteConfirmation';
import { ReferenceWarning } from './ReferenceWarning';

export interface MasterCrudProps<T extends MasterEntity> {
  /**
   * Fuente de datos. Puede ser `createRestAdapter(...)`,
   * `createFirestoreAdapter(...)`, o cualquier objeto propio que cumpla
   * `MasterCrudAdapter<T>` — el componente no sabe (ni le importa) cuál es.
   */
  adapter: MasterCrudAdapter<T>;
  config: MasterCrudConfig<T>;
  currentUser: CurrentUser;
}

/**
 * Componente público único para administrar cualquier maestro. Ejemplo:
 *
 *   const adapter = createRestAdapter(config, { baseUrl: API_URL, getHeaders });
 *   <MasterCrud adapter={adapter} config={config} currentUser={user} />
 *
 * Todo lo demás (tabla, formulario, diálogos, llamadas de red) vive
 * encapsulado aquí, en el hook `useMasterCrud` y en el `adapter` — el
 * consumidor solo entrega configuración + adaptador.
 */
export function MasterCrud<T extends MasterEntity>({ adapter, config, currentUser }: MasterCrudProps<T>) {
  const {
    rows,
    filters,
    setFilters,
    uiState,
    isBusy,
    errorMessage,
    clearError,
    create,
    update,
    setActive,
    pendingDelete,
    blockedReferences,
    requestDelete,
    cancelDelete,
    confirmDelete,
  } = useMasterCrud({ adapter, currentUser });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<T | null>(null);

  function openCreate() {
    setEditingRow(null);
    setIsFormOpen(true);
  }

  function openEdit(row: T) {
    setEditingRow(row);
    setIsFormOpen(true);
  }

  function getUpdateValues(
    values: Record<string, unknown>,
    fields: MasterCrudConfig<T>['formFields'],
  ) {
    const disabledFields = new Set(
      fields
        .filter((field) => field.disabledOnEdit)
        .map((field) => field.name),
    );

    return Object.fromEntries(
      Object.entries(values).filter(
        ([key]) => !disabledFields.has(key as keyof T & string),
      ),
    );
  }

  async function handleSubmit(values: Record<string, unknown>) {
    if (editingRow) {
      const updateValues = getUpdateValues(values, config.formFields);

      const result = await update(
        editingRow.id,
        updateValues as Partial<T>,
      );

      if (result.ok) {
        setIsFormOpen(false);
        setEditingRow(null);
      }

      return;
    }

    const result = await create(values as Partial<T>);

    if (result.ok) {
      setIsFormOpen(false);
      setEditingRow(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{config.title}</h2>
          <p className="text-sm text-slate">Administra los registros de {config.title.toLowerCase()}.</p>
        </div>
        <button
          onClick={openCreate}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
        >
          <Plus size={15} />
          Nuevo
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between rounded-lg bg-clay-light px-4 py-3 text-sm text-clay">
          <span>{errorMessage}</span>
          <button onClick={clearError} className="text-xs underline">
            Cerrar
          </button>
        </div>
      )}

      <MasterFiltersBar filters={filters} onChange={setFilters} />

      {uiState === 'loading' && <p className="py-10 text-center text-sm text-slate">Cargando...</p>}

      {uiState === 'empty' && (
        <div className="rounded-xl2 border border-dashed border-line bg-mist/40 px-6 py-16 text-center">
          <p className="font-display text-lg font-medium text-ink">Todavía no hay {config.title.toLowerCase()}</p>
          <p className="mt-1 text-sm text-slate">Crea el primer registro con el botón &quot;Nuevo&quot;.</p>
        </div>
      )}

      {(uiState === 'success' || uiState === 'submitting' || uiState === 'deleting' || uiState === 'checkingReferences') && (
        <MasterTable
          rows={rows}
          config={config}
          isBusy={isBusy}
          onEdit={openEdit}
          onToggleActive={(row) => setActive(row, !row.active)}
          onDelete={requestDelete}
        />
      )}

      <MasterModal
        isOpen={isFormOpen}
        title={editingRow ? `Editar ${config.singularTitle}` : `Nuevo ${config.singularTitle}`}
        onClose={() => setIsFormOpen(false)}
      >
        <MasterForm
          fields={config.formFields}
          schema={config.validationSchema}
          initial={editingRow}
          isEditing={editingRow !== null}
          isSubmitting={uiState === 'submitting'}
          submitLabel={editingRow ? 'Guardar cambios' : 'Crear'}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
        />
      </MasterModal>

      <MasterModal
        isOpen={pendingDelete !== null}
        title={blockedReferences ? 'No se puede eliminar' : `Eliminar ${config.singularTitle}`}
        onClose={cancelDelete}
      >
        {pendingDelete &&
          (blockedReferences ? (
            <ReferenceWarning
              entityName={String(pendingDelete[config.nameField])}
              references={blockedReferences}
              onClose={cancelDelete}
            />
          ) : (
            <DeleteConfirmation
              entityName={String(pendingDelete[config.nameField])}
              isChecking={uiState === 'checkingReferences'}
              isDeleting={uiState === 'deleting'}
              onConfirm={confirmDelete}
              onCancel={cancelDelete}
            />
          ))}
      </MasterModal>
    </div>
  );
}
