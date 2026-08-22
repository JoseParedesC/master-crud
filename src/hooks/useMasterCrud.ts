import { useCallback, useEffect, useMemo, useState } from "react";
import type { Firestore } from "firebase/firestore";
import type { MasterEntity } from "../types/master";
import type {
  MasterCrudConfig,
  MasterFilters,
  MasterUiState,
} from "../components/master-crud/types";
import { EMPTY_MASTER_FILTERS } from "../components/master-crud/types";
import { MasterCrudService } from "../services/firestore/masterCrud.service";
import {
  MasterError,
  ReferencedEntityError,
} from "../errors/masterErrors";
import type { ReferenceCount } from "../services/firestore/deleteStrategy";

interface CurrentUser {
  uid: string;
}

interface UseMasterCrudOptions<T extends MasterEntity> {
  db: Firestore;
  config: MasterCrudConfig<T>;
  currentUser: CurrentUser;
}

/**
 * Hook genérico que orquesta el CRUD de un maestro. No sabe nada de
 * "categorías": todo el comportamiento viene de `config`. Devuelve datos,
 * estado de UI, y funciones de acción — ningún componente visual llama a
 * `MasterCrudService` directamente.
 */
export function useMasterCrud<T extends MasterEntity>({
  db,
  config,
  currentUser,
}: UseMasterCrudOptions<T>) {
  const service = useMemo(() => new MasterCrudService<T>(db, config), [db, config]);

  const [rows, setRows] = useState<T[]>([]);
  const [filters, setFilters] = useState<MasterFilters>(EMPTY_MASTER_FILTERS);
  const [uiState, setUiState] = useState<MasterUiState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estado del flujo de eliminación (referencias detectadas, si aplica)
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [blockedReferences, setBlockedReferences] = useState<
    ReferenceCount[] | null
  >(null);

  const load = useCallback(async () => {
    setUiState("loading");
    setErrorMessage(null);
    try {
      const data = await service.list(filters, currentUser);
      setRows(data);
      setUiState(data.length === 0 ? "empty" : "success");
    } catch (error) {
      setErrorMessage(
        error instanceof MasterError ? error.message : "Error al cargar datos."
      );
      setUiState("error");
    }
  }, [service, filters, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  const isBusy =
    uiState === "submitting" ||
    uiState === "deleting" ||
    uiState === "checkingReferences";

  const create = useCallback(
    async (input: Partial<T>) => {
      setUiState("submitting");
      setErrorMessage(null);
      try {
        await service.create(input, currentUser);
        await load();
        return { ok: true as const };
      } catch (error) {
        const message =
          error instanceof MasterError ? error.message : "Error al crear.";
        setErrorMessage(message);
        setUiState("success");
        return { ok: false as const, message };
      }
    },
    [service, currentUser, load]
  );

  const update = useCallback(
    async (id: string, changes: Partial<T>) => {
      setUiState("submitting");
      setErrorMessage(null);
      try {
        await service.update(id, changes, currentUser);
        await load();
        return { ok: true as const };
      } catch (error) {
        const message =
          error instanceof MasterError ? error.message : "Error al actualizar.";
        setErrorMessage(message);
        setUiState("success");
        return { ok: false as const, message };
      }
    },
    [service, currentUser, load]
  );

  const setActive = useCallback(
    async (row: T, active: boolean) => {
      setUiState("submitting");
      try {
        await service.setActive(row.id, active, currentUser);
        await load();
      } catch (error) {
        setErrorMessage(
          error instanceof MasterError ? error.message : "Error al cambiar estado."
        );
        setUiState("success");
      }
    },
    [service, currentUser, load]
  );

  /** Paso 1 del flujo de borrado: comprobar referencias antes de confirmar */
  const requestDelete = useCallback(
    async (row: T) => {
      setPendingDelete(row);
      setBlockedReferences(null);
      setUiState("checkingReferences");
      try {
        const counts = await service.countReferences(row.id, currentUser);
        const withReferences = counts.filter((c) => c.count > 0);
        if (withReferences.length > 0) {
          setBlockedReferences(withReferences);
        }
        setUiState("success");
      } catch (error) {
        setErrorMessage(
          error instanceof MasterError
            ? error.message
            : "Error al comprobar referencias."
        );
        setUiState("success");
        setPendingDelete(null);
      }
    },
    [service, currentUser]
  );

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
    setBlockedReferences(null);
  }, []);

  /** Paso 2: confirmación final (solo llega aquí si no hay referencias) */
  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setUiState("deleting");
    try {
      await service.remove(pendingDelete, currentUser);
      setPendingDelete(null);
      await load();
    } catch (error) {
      if (error instanceof ReferencedEntityError) {
        // Otra pestaña/usuario creó una referencia justo antes del delete.
        setErrorMessage(error.message);
      } else {
        setErrorMessage(
          error instanceof MasterError ? error.message : "Error al eliminar."
        );
      }
      setUiState("success");
      setPendingDelete(null);
    }
  }, [service, pendingDelete, currentUser, load]);

  return {
    rows,
    filters,
    setFilters,
    uiState,
    isBusy,
    errorMessage,
    clearError: () => setErrorMessage(null),

    create,
    update,
    setActive,

    pendingDelete,
    blockedReferences,
    requestDelete,
    cancelDelete,
    confirmDelete,

    reload: load,
  };
}
