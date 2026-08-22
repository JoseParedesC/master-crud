/**
 * Stub de Cloud Function callable para el borrado "duro" de maestros.
 *
 * Por qué existe (ver ANALYSIS.md, punto 2 y 6): la comprobación de
 * referencias hecha desde el cliente es de mejor esfuerzo — hay una
 * ventana de carrera entre "comprobar que no hay referencias" y "borrar".
 * Esta función corre con Admin SDK, en un único proceso controlado por
 * Google, y repite la comprobación justo antes de borrar. Las Firestore
 * Security Rules deniegan `delete` directo desde el cliente
 * (`allow delete: if false`), así que esta función (o una equivalente) es
 * el único camino real para un borrado físico en producción.
 *
 * No se implementa el proyecto de Functions completo (dependencias,
 * despliegue, etc.) porque el enunciado no lo pide como obligatorio —
 * se deja el diseño listo para conectar cuando el equipo tenga la
 * infraestructura de Cloud Functions configurada.
 */

// import * as functions from "firebase-functions/v2/https";
// import { getFirestore } from "firebase-admin/firestore";

interface DeleteMasterRequest {
  collection: string;
  entityId: string;
  references: { collection: string; field: string; description: string }[];
}

/**
 * Pseudo-implementación (comentada) de cómo se conectaría con
 * `firebase-functions`. Se deja como referencia de arquitectura.
 */
/*
export const deleteMasterEntity = functions.onCall(async (request) => {
  if (!request.auth) {
    throw new functions.HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { collection, entityId, references } = request.data as DeleteMasterRequest;
  const db = getFirestore();
  const userRoot = db.collection("users").doc(request.auth.uid);

  // Repetir la comprobación de referencias con Admin SDK, justo antes de
  // borrar, para minimizar la ventana de carrera al mínimo posible.
  const counts = await Promise.all(
    references.map(async (ref) => {
      const snap = await userRoot
        .collection(ref.collection)
        .where(ref.field, "==", entityId)
        .count()
        .get();
      return { description: ref.description, count: snap.data().count };
    })
  );

  const blocked = counts.filter((c) => c.count > 0);
  if (blocked.length > 0) {
    throw new functions.HttpsError(
      "failed-precondition",
      `No se puede eliminar: está referenciado por ${blocked
        .map((b) => `${b.count} ${b.description}`)
        .join(", ")}.`
    );
  }

  const entityRef = userRoot.collection(collection).doc(entityId);
  const entitySnap = await entityRef.get();
  if (!entitySnap.exists) {
    throw new functions.HttpsError("not-found", "El registro no existe.");
  }

  const code = entitySnap.data()?.code as string | undefined;
  const batch = db.batch();
  if (code) {
    const registryId = `${collection}__${code.trim().toLowerCase()}`;
    batch.delete(userRoot.collection("masterCodeRegistry").doc(registryId));
  }
  batch.delete(entityRef);

  await batch.commit();

  await userRoot.collection("auditLogs").add({
    entity: collection,
    entityId,
    action: "DELETE",
    userId: request.auth.uid,
    timestamp: new Date(),
  });

  return { success: true };
});
*/

export type { DeleteMasterRequest };
