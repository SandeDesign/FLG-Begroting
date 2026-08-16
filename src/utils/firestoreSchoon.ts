// src/utils/firestoreSchoon.ts
// Firestore weigert velden met de waarde undefined, en een NaN die erin belandt
// vergiftigt daarna elke berekening. Alles wat wij wegschrijven gaat daarom
// eerst hier langs.
//
// Wat er gebeurt:
//   undefined  → het veld wordt weggelaten
//   NaN        → 0        (een leeg getalveld levert NaN op in het formulier)
//   Infinity   → 0        (deling door nul in een tussenberekening)
//   ""         → blijft   (een lege tekst is een geldige waarde)
//   null       → blijft   (null is bewust "niets", bijvoorbeeld bij einddatum)

/** Waarden die we ongemoeid laten omdat Firestore ze zelf afhandelt. */
function isBijzonderObject(waarde: object): boolean {
  // Date, Timestamp, FieldValue (serverTimestamp) en GeoPoint hebben eigen
  // serialisatie. Die mogen we niet uit elkaar trekken.
  return (
    waarde instanceof Date ||
    waarde.constructor === undefined ||
    waarde.constructor.name !== 'Object'
  );
}

/**
 * Maakt een waarde veilig om naar Firestore te schrijven.
 * Werkt diep door objecten en arrays heen.
 */
export function schoonVoorFirestore<T>(waarde: T): T {
  return schoon(waarde) as T;
}

function schoon(waarde: unknown): unknown {
  if (waarde === null) return null;

  if (typeof waarde === 'number') {
    return Number.isFinite(waarde) ? waarde : 0;
  }

  if (Array.isArray(waarde)) {
    // In een array kan geen veld ontbreken; undefined wordt daar null.
    return waarde.map((item) => (item === undefined ? null : schoon(item)));
  }

  if (typeof waarde === 'object') {
    if (isBijzonderObject(waarde as object)) return waarde;

    const resultaat: Record<string, unknown> = {};

    Object.entries(waarde as Record<string, unknown>).forEach(([sleutel, inhoud]) => {
      if (inhoud === undefined) return; // veld helemaal weglaten
      resultaat[sleutel] = schoon(inhoud);
    });

    return resultaat;
  }

  return waarde;
}

/**
 * Maakt één getal veilig. Handig in formulieren, waar een leeg veld met
 * valueAsNumber een NaN oplevert.
 */
export function veiligGetal(waarde: unknown): number {
  if (typeof waarde === 'number') return Number.isFinite(waarde) ? waarde : 0;

  if (typeof waarde === 'string') {
    const omgezet = Number.parseFloat(waarde.replace(',', '.'));
    return Number.isFinite(omgezet) ? omgezet : 0;
  }

  return 0;
}

/** Maakt één tekst veilig: nooit undefined, altijd zonder spaties eromheen. */
export function veiligeTekst(waarde: unknown): string {
  return typeof waarde === 'string' ? waarde.trim() : '';
}
