import { useCallback, useEffect, useState } from 'react';
import type { CurrentUser, MasterEntity, MasterFilters, ReferenceCount, MasterUiState } from '../types';
import { EMPTY_MASTER_FILTERS } from '../types';
import { MasterError, ReferencedEntityError } from '../errors/masterErrors';
import type { MasterCrudAdapter } from '../adapters/types';

export interface UseMasterCrudOptions<T extends MasterEntity> {
  adapter: MasterCrudAdapter<T>;
  currentUser: CurrentUser;
}

/**
 * Hook genérico que orquesta el CRUD de un maestro. No sabe nada de
 * "categorías" ni de ningún backend concreto: todo el comportamiento de
 * dominio viene de `config` (vía el adapter) y toda la persistencia viene
 * del `adapter` que se le inyecta.
 */
export function useMasterCrud<T extends MasterEntity>({ adapter, currentUser }: UseMasterCrudOptions<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [filters, setFilters] = useState<MasterFilters>(EMPTY_MASTER_FILTERS);
  const [uiState, setUiState] = useState<MasterUiState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);
  const [blockedReferences, setBlockedReferences] = useState<ReferenceCount[] | null>(null);

  const load = useCallback(async () => {
    setUiState('loading');
    setErrorMessage(null);
    try {
      const data = await adapter.list(filters, currentUser);
      setRows(data);
      setUiState(data.length === 0 ? 'empty' : 'success');
    } catch (error) {
      setErrorMessage(error instanceof MasterError ? error.message : 'Error al cargar datos.');
      setUiState('error');
    }
  }, [adapter, filters, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  const isBusy = uiState === 'submitting' || uiState === 'deleting' || uiState === 'checkingReferences';

  const create = useCallback(
    async (input: Partial<T>) => {
      setUiState('submitting');
      setErrorMessage(null);
      try {
        await adapter.create(input, currentUser);
        await load();
        return { ok: true as const };
      } catch (error) {
        const message = error instanceof MasterError ? error.message : 'Error al crear.';
        setErrorMessage(message);
        setUiState('success');
        return { ok: false as const, message };
      }
    },
    [adapter, currentUser, load],
  );

  const update = useCallback(
    async (id: string, changes: Partial<T>) => {
      setUiState('submitting');
      setErrorMessage(null);
      try {
        await adapter.update(id, changes, currentUser);
        await load();
        return { ok: true as const };
      } catch (error) {
        const message = error instanceof MasterError ? error.message : 'Error al actualizar.';
        setErrorMessage(message);
        setUiState('success');
        return { ok: false as const, message };
      }
    },
    [adapter, currentUser, load],
  );

  const setActive = useCallback(
    async (row: T, active: boolean) => {
      setUiState('submitting');
      try {
        await adapter.setActive(row.id, active, currentUser);
        await load();
      } catch (error) {
        setErrorMessage(error instanceof MasterError ? error.message : 'Error al cambiar estado.');
        setUiState('success');
      }
    },
    [adapter, currentUser, load],
  );

  const requestDelete = useCallback(
    async (row: T) => {
      setPendingDelete(row);
      setBlockedReferences(null);
      setUiState('checkingReferences');
      try {
        const counts = (await adapter.countReferences?.(row.id, currentUser)) ?? [];
        const withReferences = counts.filter((c) => c.count > 0);
        if (withReferences.length > 0) {
          setBlockedReferences(withReferences);
        }
        setUiState('success');
      } catch (error) {
        setErrorMessage(error instanceof MasterError ? error.message : 'Error al comprobar referencias.');
        setUiState('success');
        setPendingDelete(null);
      }
    },
    [adapter, currentUser],
  );

  const cancelDelete = useCallback(() => {
    setPendingDelete(null);
    setBlockedReferences(null);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setUiState('deleting');
    try {
      await adapter.remove(pendingDelete, currentUser);
      setPendingDelete(null);
      await load();
    } catch (error) {
      if (error instanceof ReferencedEntityError) {
        setBlockedReferences(error.references);
        setUiState('success');
        return;
      }
      setErrorMessage(error instanceof MasterError ? error.message : 'Error al eliminar.');
      setUiState('success');
      setPendingDelete(null);
    }
  }, [adapter, pendingDelete, currentUser, load]);

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
