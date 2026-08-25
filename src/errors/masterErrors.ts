import type { ReferenceCount } from '../types';

export class MasterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterError';
  }
}

export class DuplicateCodeError extends MasterError {
  constructor(public readonly code: string) {
    super(`El código "${code}" ya está registrado.`);
    this.name = 'DuplicateCodeError';
  }
}

export class ReferencedEntityError extends MasterError {
  constructor(
    public readonly entityName: string,
    public readonly references: ReferenceCount[],
  ) {
    const detail = references.map((r) => `${r.count} ${r.description}`).join(', ');
    super(
      `No se puede eliminar "${entityName}" porque está siendo utilizada por ${detail}. Elimine o reasigne las referencias antes de continuar.`,
    );
    this.name = 'ReferencedEntityError';
  }
}

export class PermissionError extends MasterError {
  constructor(message = 'No tienes permisos para realizar esta acción.') {
    super(message);
    this.name = 'PermissionError';
  }
}

export class ValidationError extends MasterError {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends MasterError {
  constructor(id: string) {
    super(`El registro "${id}" no existe o fue eliminado.`);
    this.name = 'NotFoundError';
  }
}

/** Convierte cualquier error (HTTP, Firestore, etc.) a un `MasterError` legible para la UI. */
export function toMasterError(error: unknown): MasterError {
  if (error instanceof MasterError) return error;

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === 'permission-denied' || code === 'FORBIDDEN') {
      return new PermissionError();
    }
    if (code === 'not-found' || code === 'NOT_FOUND') {
      return new MasterError('El registro solicitado no existe.');
    }
  }

  return new MasterError('Ocurrió un error inesperado. Intenta nuevamente en unos minutos.');
}
