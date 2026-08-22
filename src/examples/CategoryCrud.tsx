import type { Firestore } from "firebase/firestore";
import { MasterCrud } from "../components/master-crud/MasterCrud";
import { categoryConfig } from "../config/category.config";

interface CurrentUser {
  uid: string;
}

/**
 * Así se ve un maestro nuevo en la práctica: cero lógica propia, solo
 * configuración. Para agregar "PaymentMethod", "MovementType", "Account",
 * etc. se repite este mismo patrón con su propio *.config.ts.
 */
export function CategoryCrud({
  db,
  currentUser,
}: {
  db: Firestore;
  currentUser: CurrentUser;
}) {
  return <MasterCrud db={db} config={categoryConfig} currentUser={currentUser} />;
}
