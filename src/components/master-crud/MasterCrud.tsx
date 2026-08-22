import { useState } from "react";
import type { Firestore } from "firebase/firestore";
import { Plus } from "lucide-react";
import type { MasterEntity } from "../../types/master";
import type { MasterCrudConfig } from "./types";
import { useMasterCrud } from "../../hooks/useMasterCrud";
import { MasterFiltersBar } from "./MasterFilters";
import { MasterTable } from "./MasterTable";
import { MasterForm } from "./MasterForm";
import { MasterModal } from "./MasterModal";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { ReferenceWarning } from "./ReferenceWarning";

interface CurrentUser {
  uid: string;
}

interface MasterCrudProps<T extends MasterEntity> {
  db: Firestore;
  config: MasterCrudConfig<T>;
  currentUser: CurrentUser;
}

/**
 * Componente público único para administrar cualquier maestro. Ejemplo de
 * uso:
 *
 *   <MasterCrud db={db} config={categoryConfig} currentUser={user} />
 *
 * Todo lo demás (tabla, formulario, diálogos, llamadas a Firestore) vive
 * encapsulado aquí y en sus componentes hijos — el consumidor solo entrega
 * la configuración del maestro.
 */
export function MasterCrud<T extends MasterEntity>({
  db,
  config,
  currentUser,
}: MasterCrudProps<T>) {
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
  } = useMasterCrud<T>({ db, config, currentUser });

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

  async function handleSubmit(values: Record<string, unknown>) {
    const result = editingRow
      ? await update(editingRow.id, values as Partial<T>)
      : await create(values as Partial<T>);

    if (result.ok) {
      setIsFormOpen(false);
      setEditingRow(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            {config.title}
          </h2>
          <p className="text-sm text-slate">
            Administra los registros de {config.title.toLowerCase()}.
          </p>
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

      {uiState === "loading" && (
        <p className="py-10 text-center text-sm text-slate">Cargando...</p>
      )}

      {uiState === "empty" && (
        <div className="rounded-xl2 border border-dashed border-line bg-mist/40 px-6 py-16 text-center">
          <p className="font-display text-lg font-medium text-ink">
            Todavía no hay {config.title.toLowerCase()}
          </p>
          <p className="mt-1 text-sm text-slate">
            Crea el primer registro con el botón "Nuevo".
          </p>
        </div>
      )}

      {(uiState === "success" ||
        uiState === "submitting" ||
        uiState === "deleting" ||
        uiState === "checkingReferences") && (
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
          isSubmitting={uiState === "submitting"}
          submitLabel={editingRow ? "Guardar cambios" : "Crear"}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
        />
      </MasterModal>

      <MasterModal
        isOpen={pendingDelete !== null}
        title={
          blockedReferences ? "No se puede eliminar" : `Eliminar ${config.singularTitle}`
        }
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
              isChecking={uiState === "checkingReferences"}
              isDeleting={uiState === "deleting"}
              onConfirm={confirmDelete}
              onCancel={cancelDelete}
            />
          ))}
      </MasterModal>
    </div>
  );
}
