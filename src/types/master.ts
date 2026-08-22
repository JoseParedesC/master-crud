import type { Timestamp } from "firebase/firestore";

/**
 * Campos mínimos que TODO maestro debe tener. Los maestros concretos
 * (Category, PaymentMethod, etc.) extienden esta interfaz con sus propios
 * campos de negocio.
 */
export interface MasterEntity {
  id: string;
  code: string;
  name: string;
  active: boolean;

  createdAt: Timestamp;
  createdBy: string;

  updatedAt: Timestamp;
  updatedBy: string;
}

/** Payload que entra desde el formulario, antes de agregar campos de auditoría */
export type MasterEntityInput<T extends MasterEntity> = Omit<
  T,
  "id" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "active"
> & { active?: boolean };

export interface AuditLog {
  id: string;
  entity: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "ACTIVATE" | "DEACTIVATE";
  userId: string;
  timestamp: Timestamp;
  changes?: Record<string, unknown>;
}
