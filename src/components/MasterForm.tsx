import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import type { MasterEntity, MasterFormField } from '../types';

export interface MasterFormProps<T extends MasterEntity> {
  fields: MasterFormField<T>[];
  schema: ZodType<unknown>;
  initial?: Partial<T> | null;
  isEditing: boolean;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function MasterForm<T extends MasterEntity>({
  fields,
  schema,
  initial,
  isEditing,
  isSubmitting,
  submitLabel,
  onSubmit,
  onCancel,
}: MasterFormProps<T>) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema as never),
    defaultValues: (initial ?? {}) as Record<string, unknown>,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {fields.map((field) => {
        const fieldName = field.name;
        const error = errors[fieldName as string];
        const disabled = isSubmitting || (isEditing && field.disabledOnEdit);

        return (
          <div key={fieldName} className="flex flex-col gap-1.5">
            <label htmlFor={fieldName} className="text-xs font-medium uppercase tracking-wide text-slate">
              {field.label}
              {field.required && <span className="text-clay"> *</span>}
            </label>

            {field.type === 'textarea' && (
              <textarea
                id={fieldName}
                disabled={disabled}
                placeholder={field.placeholder}
                {...register(fieldName)}
                rows={3}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink disabled:bg-mist disabled:text-slate"
              />
            )}

            {field.type === 'select' && (
              <select
                id={fieldName}
                disabled={disabled}
                {...register(fieldName)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink disabled:bg-mist disabled:text-slate"
              >
                <option value="">Selecciona...</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'boolean' && (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  id={fieldName}
                  type="checkbox"
                  disabled={disabled}
                  {...register(fieldName)}
                  className="h-4 w-4 rounded border-line"
                />
                {field.helperText ?? 'Activo'}
              </label>
            )}

            {(field.type === 'text' || field.type === 'number' || field.type === 'date') && (
              <input
                id={fieldName}
                type={field.type}
                disabled={disabled}
                placeholder={field.placeholder}
                {...register(fieldName, field.type === 'number' ? { valueAsNumber: true } : undefined)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-ink disabled:bg-mist disabled:text-slate"
              />
            )}

            {field.type === 'color' && (
              <div className="flex items-center gap-3">
                <input
                  id={fieldName}
                  type="color"
                  disabled={disabled}
                  {...register(fieldName)}
                  className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span className="font-mono text-sm text-slate">
                  {(watch(fieldName) as string) || field.placeholder || '#000000'}
                </span>
              </div>
            )}

            {field.helperText && field.type !== 'boolean' && <p className="text-xs text-slate">{field.helperText}</p>}
            {error?.message && <p className="text-xs text-clay">{String(error.message)}</p>}
          </div>
        );
      })}

      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 rounded-full bg-mist px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-line disabled:opacity-40"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
        >
          {isSubmitting ? 'Guardando...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
