import { z } from 'zod';

/** Campos base que cualquier maestro puede extender en su propio schema de validación. */
export const baseMasterSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'El código es obligatorio.')
    .max(20, 'El código no puede superar 20 caracteres.')
    .regex(/^[A-Za-z0-9_-]+$/, 'El código solo puede contener letras, números, guiones y guion bajo.'),
  name: z.string().trim().min(1, 'El nombre es obligatorio.').max(80, 'El nombre no puede superar 80 caracteres.'),
  active: z.boolean().default(true),
});
