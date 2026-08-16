// src/services/leveringService.ts
// Onderlinge leveringen ophalen in beide richtingen.
//
// Een levering wordt opgeslagen in de begroting van de entiteit die levert. De
// ontvangende entiteit moet hem dus elders vandaan halen: via het afgeleide veld
// leveringNaarEntityIds op het budgetdocument, dat budgetService bij elke opslag
// bijwerkt.

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { OnderlingeLevering } from '../types/begroting';

const COLLECTIE = 'budgets';

/** Eén levering, met de begroting waar hij in staat. */
export interface LeveringMetHerkomst {
  levering: OnderlingeLevering;
  budgetId: string;
  budgetNaam: string;
}

function leesLeveringen(data: Record<string, unknown>): OnderlingeLevering[] {
  return (data.onderlingeLeveringen as OnderlingeLevering[]) ?? [];
}

/**
 * Alle leveringen die naar deze entiteit toe gaan — voor haar dus directe kosten.
 *
 * De begroting waarin een levering staat kan bij een andere entiteit horen dan
 * de leverende; daarom wordt er ook nog op vanEntityId gefilterd noch op de
 * begroting zelf vertrouwd, maar puur op de levering.
 */
export async function haalInkomendeLeveringen(entityId: string): Promise<OnderlingeLevering[]> {
  const snapshot = await getDocs(
    query(collection(db, COLLECTIE), where('leveringNaarEntityIds', 'array-contains', entityId))
  );

  return snapshot.docs
    .flatMap((d) => leesLeveringen(d.data()))
    .filter((levering) => levering.naarEntityId === entityId);
}

/** Alle leveringen die deze entiteit uitvoert — voor haar dus opbrengst. */
export async function haalUitgaandeLeveringen(entityId: string): Promise<OnderlingeLevering[]> {
  const snapshot = await getDocs(query(collection(db, COLLECTIE), where('entityId', '==', entityId)));

  return snapshot.docs
    .flatMap((d) => leesLeveringen(d.data()))
    .filter((levering) => levering.vanEntityId === entityId);
}

/**
 * Alle leveringen van alle entiteiten, met vermelding van de begroting waar ze
 * in staan. Gebruikt door het ketenoverzicht.
 */
export async function haalAlleLeveringen(): Promise<LeveringMetHerkomst[]> {
  const snapshot = await getDocs(collection(db, COLLECTIE));

  return snapshot.docs.flatMap((d) => {
    const data = d.data();
    const naam = (data.naam as string) ?? '';
    return leesLeveringen(data).map((levering) => ({
      levering,
      budgetId: d.id,
      budgetNaam: naam,
    }));
  });
}
