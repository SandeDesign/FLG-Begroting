// src/hooks/useBegrotingsdata.ts
// Rekent de begrotingen door die de BegrotingsdataProvider al in het geheugen
// heeft staan.
//
// De begrotingen zelf worden hier niet meer opgehaald — dat doet één luisteraar
// voor de hele app. Deze hook doet alleen het rekenwerk, en dat kost geen
// netwerk. Alle begrotingen samen in het geheugen hebben is nodig omdat de
// inkomende onderlinge leveringen van de één in de begroting van de ander staan.

import { useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { useBegrotingen } from '../contexts/BegrotingsdataContext';
import { berekenBegroting, controleerBegroting } from '../utils/begroting.calc';
import type {
  Afwijking,
  BegrotingResultaat,
  Budget,
  Entity,
  OnderlingeLevering,
} from '../types/begroting';

export interface DoorgerekendeBegroting {
  budget: Budget;
  entiteit: Entity;
  resultaat: BegrotingResultaat;
  afwijkingen: Afwijking[];
}

interface Begrotingsdata {
  begrotingen: Budget[];
  /** Alleen de begrotingen waarvan de entiteit nog bestaat. */
  doorgerekend: DoorgerekendeBegroting[];
  laden: boolean;
  fout: string | null;
  herlaad: () => Promise<void>;
}

/** Alle leveringen uit alle begrotingen, ongeacht waar ze zijn opgeslagen. */
function alleLeveringen(begrotingen: Budget[]): OnderlingeLevering[] {
  return begrotingen.flatMap((begroting) => begroting.onderlingeLeveringen);
}

export function useBegrotingsdata(): Begrotingsdata {
  const { entiteiten, laden: entiteitenLaden } = useApp();
  const { begrotingen, laden: begrotingenLaden, fout, herlaad } = useBegrotingen();

  // Pas klaar als beide luisteraars hun eerste melding hebben gehad; zonder de
  // entiteiten valt er niets door te rekenen.
  const laden = entiteitenLaden || begrotingenLaden;

  const doorgerekend = useMemo<DoorgerekendeBegroting[]>(() => {
    const leveringen = alleLeveringen(begrotingen);
    const entiteitPerId = new Map(entiteiten.map((entiteit) => [entiteit.id, entiteit]));

    return begrotingen.flatMap((budget) => {
      const entiteit = entiteitPerId.get(budget.entityId);
      if (!entiteit) return [];

      const inkomend = leveringen.filter((levering) => levering.naarEntityId === entiteit.id);
      const resultaat = berekenBegroting(budget, entiteit, inkomend);

      return [{ budget, entiteit, resultaat, afwijkingen: controleerBegroting(resultaat) }];
    });
  }, [begrotingen, entiteiten]);

  return { begrotingen, doorgerekend, laden, fout, herlaad };
}
