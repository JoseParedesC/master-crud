import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Power, Trash2 } from "lucide-react";
import type { MasterEntity } from "../../types/master";
import type { MasterCrudConfig } from "./types";

interface MasterTableProps<T extends MasterEntity> {
  rows: T[];
  config: MasterCrudConfig<T>;
  isBusy: boolean;
  onEdit: (row: T) => void;
  onToggleActive: (row: T) => void;
  onDelete: (row: T) => void;
}

const ROWS_PER_PAGE = 10;

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Activo" : "Inactivo";
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in (value as Record<string, unknown>)
  ) {
    // Firestore Timestamp
    const date = (value as { toDate: () => Date }).toDate();
    return date.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }
  return String(value);
}

export function MasterTable<T extends MasterEntity>({
  rows,
  config,
  isBusy,
  onEdit,
  onToggleActive,
  onDelete,
}: MasterTableProps<T>) {
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = String(a[sortField as keyof T] ?? "");
      const bv = String(b[sortField as keyof T] ?? "");
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [rows, sortField, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = sorted.slice(
    currentPage * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE + ROWS_PER_PAGE
  );

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortAsc((prev) => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl2 border border-line bg-surface shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/50 text-xs uppercase tracking-wide text-slate">
              {config.columns.map((col) => (
                <th
                  key={col.field}
                  className={`px-4 py-3 font-medium ${
                    col.sortable ? "cursor-pointer select-none" : ""
                  }`}
                  onClick={() => col.sortable && toggleSort(col.field)}
                >
                  {col.label}
                  {sortField === col.field ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((row) => (
              <tr key={row.id} className="hover:bg-mist/30">
                {config.columns.map((col) => {
                  const rawValue = row[col.field as keyof T];
                  const display = col.render
                    ? col.render(rawValue, row)
                    : formatCellValue(rawValue);
                  const isStatus = col.field === "active";
                  return (
                    <td key={col.field} className="px-4 py-3 text-ink">
                      {isStatus ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.active
                              ? "bg-moss-light text-moss"
                              : "bg-clay-light text-clay"
                          }`}
                        >
                          {display}
                        </span>
                      ) : (
                        display
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => onEdit(row)}
                      disabled={isBusy}
                      aria-label="Editar"
                      className="rounded-full p-1.5 text-slate hover:bg-mist disabled:opacity-40"
                    >
                      <Pencil size={14} />
                    </button>
                    {config.allowDeactivate !== false && (
                      <button
                        onClick={() => onToggleActive(row)}
                        disabled={isBusy}
                        aria-label={row.active ? "Desactivar" : "Activar"}
                        className="rounded-full p-1.5 text-slate hover:bg-mist disabled:opacity-40"
                      >
                        <Power size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(row)}
                      disabled={isBusy}
                      aria-label="Eliminar"
                      className="rounded-full p-1.5 text-slate hover:bg-clay-light hover:text-clay disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-slate">
          <span>
            Página {currentPage + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-full p-1.5 hover:bg-mist disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage === totalPages - 1}
              className="rounded-full p-1.5 hover:bg-mist disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
