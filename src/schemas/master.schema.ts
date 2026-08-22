import { z } from "zod";

/**
 * Campos base que cualquier maestro valida en el formulario. Los campos de
 * auditoría (createdAt, createdBy, etc.) NO se validan aquí porque nunca
 * vienen del formulario — los agrega el servicio.
 */
export const baseMasterSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "El código es obligatorio.")
    .max(20, "El código no puede superar 20 caracteres.")
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "El código solo puede contener letras, números, guiones y guion bajo."
    ),
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(80, "El nombre no puede superar 80 caracteres."),
  active: z.boolean().default(true),
});

/** Ejemplo de maestro concreto: Category */
export const categorySchema = baseMasterSchema.extend({
  description: z.string().trim().max(200).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "El color debe ser un hexadecimal válido, ej: #1F6D5A.")
    .optional(),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
