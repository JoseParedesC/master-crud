import type { CurrentUser, MasterEntity, MasterFilters, ReferenceCount } from '../types';
import { ReferencedEntityError, toMasterError } from '../errors/masterErrors';
import type { MasterCrudAdapter } from './types';

export type RestAction =
  | 'list'
  | 'getById'
  | 'create'
  | 'update'
  | 'setActive'
  | 'countReferences'
  | 'remove';

export interface ResolveRouteParams {
  action: RestAction;
  /** Recurso configurado (por defecto, `config.collection` del maestro) */
  resource: string;
  baseUrl: string;
  id?: string;
}

/**
 * Resolución de ruta por defecto: sigue la convención REST más común
 * (la misma que expone, por ejemplo, el backend NestJS de referencia):
 *
 *   GET    {baseUrl}/{resource}
 *   GET    {baseUrl}/{resource}/{id}
 *   POST   {baseUrl}/{resource}
 *   PATCH  {baseUrl}/{resource}/{id}
 *   PATCH  {baseUrl}/{resource}/{id}/active
 *   GET    {baseUrl}/{resource}/{id}/references
 *   DELETE {baseUrl}/{resource}/{id}
 *
 * Cualquier proyecto con rutas distintas puede sobreescribir esto pasando
 * su propio `resolveRoute` — es la pieza que hace que el adaptador sea
 * "reutilizable": la forma de las rutas ya no está fija en el componente.
 */
export function defaultResolveRoute({ action, resource, baseUrl, id }: ResolveRouteParams): {
  url: string;
  method: string;
} {
  const base = `${baseUrl.replace(/\/$/, '')}/${resource}`;

  switch (action) {
    case 'list':
      return { url: base, method: 'GET' };
    case 'create':
      return { url: base, method: 'POST' };
    case 'getById':
      return { url: `${base}/${id}`, method: 'GET' };
    case 'update':
      return { url: `${base}/${id}`, method: 'PATCH' };
    case 'setActive':
      return { url: `${base}/${id}/active`, method: 'PATCH' };
    case 'countReferences':
      return { url: `${base}/${id}/references`, method: 'GET' };
    case 'remove':
      return { url: `${base}/${id}`, method: 'DELETE' };
  }
}

export interface RestAdapterOptions<T extends MasterEntity> {
  /** URL base de la API, ej: "https://api.miapp.com/api" */
  baseUrl: string;
  /** Segmento de recurso a usar en las rutas. Por defecto: `config.collection`. */
  resource?: string;
  /**
   * Override total de cómo se arma cada ruta/método. Úsalo si tu backend
   * no sigue la convención por defecto (otros verbos, anidado bajo el
   * usuario, versión de API distinta, GraphQL detrás de un solo endpoint,
   * etc.)
   */
  resolveRoute?: (params: ResolveRouteParams) => { url: string; method: string };
  /** Headers adicionales (normalmente el `Authorization: Bearer <token>`). */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Por si el entorno no tiene `fetch` global (React Native viejo, tests, etc.) */
  fetchImpl?: typeof fetch;
  /**
   * Cómo extraer un mensaje de error legible del `Response` cuando la
   * petición falla. Por defecto intenta leer `{ message }` del body JSON.
   */
  parseErrorMessage?: (response: Response) => Promise<string>;
}

async function defaultParseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.clone().json();
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
  } catch {
    // el body no era JSON, seguimos con el texto plano
  }
  return response.statusText || `Error HTTP ${response.status}`;
}

/**
 * Crea un adaptador que habla con cualquier API REST. No sabe nada de
 * Firestore, Postgres, Mongo, etc. — solo hace `fetch` a las rutas que le
 * indique `resolveRoute` (o la convención por defecto).
 */
export function createRestAdapter<T extends MasterEntity>(
  config: { collection: string },
  options: RestAdapterOptions<T>,
): MasterCrudAdapter<T> {
  const resource = options.resource ?? config.collection;
  const resolveRoute = options.resolveRoute ?? defaultResolveRoute;
  const doFetch = options.fetchImpl ?? fetch;
  const parseErrorMessage = options.parseErrorMessage ?? defaultParseErrorMessage;

  async function request<R>(action: RestAction, opts: { id?: string; body?: unknown } = {}): Promise<R> {
    const { url, method } = resolveRoute({
      action,
      resource,
      baseUrl: options.baseUrl,
      id: opts.id,
    });

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.getHeaders ? await options.getHeaders() : {}),
    };

    const response = await doFetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (response.status === 409) {
      // Convención: el backend devuelve { referencedBy: [{description, count}] }
      // cuando bloquea un borrado por referencias activas.
      let referencedBy: ReferenceCount[] = [];
      try {
        const body = await response.clone().json();
        referencedBy = body?.referencedBy ?? [];
      } catch {
        // sin body estructurado, seguimos igual con el mensaje genérico
      }
      if (referencedBy.length > 0) {
        throw new ReferencedEntityError('el registro', referencedBy);
      }
    }

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw toMasterError({ code: response.status === 403 ? 'FORBIDDEN' : undefined, message });
    }

    if (response.status === 204) {
      return undefined as R;
    }

    return (await response.json()) as R;
  }

  return {
    async list(filters: MasterFilters, _user: CurrentUser) {
      const query = new URLSearchParams();
      if (filters.search.trim()) query.set('search', filters.search.trim());
      if (filters.status !== 'all') query.set('status', filters.status);

      const { url, method } = resolveRoute({ action: 'list', resource, baseUrl: options.baseUrl });
      const finalUrl = query.toString() ? `${url}?${query.toString()}` : url;

      const headers = {
        Accept: 'application/json',
        ...(options.getHeaders ? await options.getHeaders() : {}),
      };
      const response = await doFetch(finalUrl, { method, headers });
      if (!response.ok) {
        throw toMasterError({ message: await parseErrorMessage(response) });
      }
      return (await response.json()) as T[];
    },

    getById(id, _user) {
      return request<T>('getById', { id });
    },

    create(input, _user) {
      return request<T>('create', { body: input });
    },

    async update(id, changes, _user) {
      await request<void>('update', { id, body: changes });
    },

    async setActive(id, active, _user) {
      await request<void>('setActive', { id, body: { active } });
    },

    async countReferences(entityId, _user) {
      try {
        return await request<ReferenceCount[]>('countReferences', { id: entityId });
      } catch {
        // El backend no expone este endpoint: no hay pre-check, pero
        // `remove()` seguirá bloqueando el borrado si corresponde.
        return [];
      }
    },

    async remove(entity, _user) {
      try {
        await request<void>('remove', { id: entity.id });
        return { softDeleted: false };
      } catch (error) {
        if (error instanceof ReferencedEntityError) {
          throw new ReferencedEntityError(entity.name, error.references);
        }
        throw error;
      }
    },
  };
}
