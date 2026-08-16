// src/services/entityService.ts
// Alle Firestore-toegang tot de collectie `entities`. Componenten praten nooit
// rechtstreeks met Firestore — altijd via deze service.

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Entity, NieuweEntity, VasteLast } from '../types/begroting';
import { schoonVoorFirestore } from '../utils/firestoreSchoon';
import { verwijderBegrotingenVanEntiteit } from './budgetService';

const COLLECTIE = 'entities';

/** Zet een Firestore-document om naar een Entity. */
function naarEntity(id: string, data: Record<string, unknown>): Entity {
  return {
    id,
    naam: (data.naam as string) ?? '',
    kvk: (data.kvk as string) ?? '',
    actief: (data.actief as boolean) ?? true,
    heeftPersoneel: (data.heeftPersoneel as boolean) ?? false,
    isHolding: (data.isHolding as boolean) ?? false,
    kleur: (data.kleur as string) ?? '#cd853f',
    volgorde: (data.volgorde as number) ?? 0,
    vasteLasten: ((data.vasteLasten as VasteLast[]) ?? []).map((last) => ({
      ...last,
      btw: last.btw ?? 'hoog',
    })),
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

/**
 * Blijft de entiteiten volgen. De eerste melding komt uit de schijfcache en is
 * er dus meteen; daarna volgt de versie van de server. Ook eigen wijzigingen
 * komen hier direct langs, zodat de app na een opslag niets hoeft op te halen.
 *
 * Geeft de opzegfunctie terug — altijd aanroepen bij het opruimen.
 */
export function volgEntiteiten(
  bij: (entiteiten: Entity[]) => void,
  bijFout: (fout: Error) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, COLLECTIE), orderBy('volgorde', 'asc')),
    (snapshot) => bij(snapshot.docs.map((d) => naarEntity(d.id, d.data()))),
    bijFout
  );
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

/**
 * Verwijdert een entiteit, met alles wat eraan hangt: de begrotingen van deze
 * entiteit en de onderlinge leveringen die haar noemen.
 *
 * Zonder dit bleven de begrotingen als wees achter — onzichtbaar in de lijst,
 * want die groepeert op entiteit, maar wel gewoon nog in de database.
 *
 * Geeft terug hoeveel begrotingen zijn meeverwijderd, zodat de UI dat kan melden.
 */
export async function verwijderEntiteit(entityId: string): Promise<number> {
  const aantalBegrotingen = await verwijderBegrotingenVanEntiteit(entityId);
  await deleteDoc(doc(db, COLLECTIE, entityId));
  return aantalBegrotingen;
}
