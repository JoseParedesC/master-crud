interface DeleteConfirmationProps {
  entityName: string;
  isChecking: boolean;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmation({
  entityName,
  isChecking,
  isDeleting,
  onConfirm,
  onCancel,
}: DeleteConfirmationProps) {
  return (
    <div className="flex flex-col gap-4">
      {isChecking ? (
        <p className="text-sm text-slate">Comprobando referencias...</p>
      ) : (
        <>
          <p className="text-sm text-slate leading-relaxed">
            ¿Deseas eliminar <span className="font-medium text-ink">"{entityName}"</span>?
            <br />
            Esta acción no podrá deshacerse.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isDeleting}
              className="rounded-full bg-mist px-5 py-2.5 text-sm font-medium text-ink hover:bg-line disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="rounded-full bg-clay px-5 py-2.5 text-sm font-medium text-white hover:bg-clay/90 disabled:opacity-40"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
