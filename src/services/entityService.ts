// src/services/entityService.ts
// Alle Firestore-toegang tot de collectie `entities`. Componenten praten nooit
// rechtstreeks met Firestore — altijd via deze service.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Entity, NieuweEntity, VasteLast } from '../types/begroting';
import { schoonVoorFirestore } from '../utils/firestoreSchoon';

const COLLECTIE = 'entities';

/** Zet een Firestore-document om naar een Entity. */
function naarEntity(id: string, data: Record<string, unknown>): Entity {
  return {
    id,
    naam: (data.naam as string) ?? '',
    kvk: (data.kvk as string) ?? '',
    actief: (data.actief as boolean) ?? true,
    heeftPersoneel: (data.heeftPersoneel as boolean) ?? false,
    kleur: (data.kleur as string) ?? '#cd853f',
    volgorde: (data.volgorde as number) ?? 0,
    vasteLasten: (data.vasteLasten as VasteLast[]) ?? [],
    createdAt: data.createdAt as Entity['createdAt'],
    updatedAt: data.updatedAt as Entity['updatedAt'],
  };
}

/** Alle entiteiten, op volgorde. */
export async function haalEntiteiten(): Promise<Entity[]> {
  const q = query(collection(db, COLLECTIE), orderBy('volgorde', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => naarEntity(d.id, d.data()));
}

/** Eén entiteit, of null als hij niet bestaat. */
export async function haalEntiteit(entityId: string): Promise<Entity | null> {
  const snapshot = await getDoc(doc(db, COLLECTIE, entityId));
  if (!snapshot.exists()) return null;
  return naarEntity(snapshot.id, snapshot.data());
}

/** Maakt een nieuwe entiteit aan en geeft het nieuwe id terug. */
export async function maakEntiteit(entiteit: NieuweEntity): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTIE), {
    ...schoonVoorFirestore(entiteit),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Werkt een bestaande entiteit bij. */
export async function werkEntiteitBij(
  entityId: string,
  wijzigingen: Partial<NieuweEntity>
): Promise<void> {
  await updateDoc(doc(db, COLLECTIE, entityId), {
    ...schoonVoorFirestore(wijzigingen),
    updatedAt: serverTimestamp(),
  });
}

/** Vervangt de volledige lijst met vaste lasten van een entiteit. */
export async function bewaarVasteLasten(
  entityId: string,
  vasteLasten: VasteLast[]
): Promise<void> {
  await updateDoc(doc(db, COLLECTIE, entityId), {
    vasteLasten: schoonVoorFirestore(vasteLasten),
    updatedAt: serverTimestamp(),
  });
}

/** Verwijdert een entiteit. De begrotingen eronder blijven bestaan. */
export async function verwijderEntiteit(entityId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIE, entityId));
}
