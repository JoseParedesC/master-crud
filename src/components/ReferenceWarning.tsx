import { AlertTriangle } from 'lucide-react';
import type { ReferenceCount } from '../types';

export interface ReferenceWarningProps {
  entityName: string;
  references: ReferenceCount[];
  onClose: () => void;
}

export function ReferenceWarning({ entityName, references, onClose }: ReferenceWarningProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg bg-clay-light p-4">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-clay" />
        <div className="text-sm text-ink">
          <p className="font-medium">No se puede eliminar &quot;{entityName}&quot;.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-slate">
            {references.map((ref) => (
              <li key={ref.description}>
                Está siendo utilizada por {ref.count} {ref.description}.
              </li>
            ))}
          </ul>
          <p className="mt-2 text-slate">Elimine o reasigne las referencias antes de continuar.</p>
        </div>
      </div>
      <button onClick={onClose} className="self-end rounded-full bg-mist px-5 py-2.5 text-sm font-medium text-ink hover:bg-line">
        Entendido
      </button>
    </div>
  );
}
