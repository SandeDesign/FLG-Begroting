// src/hooks/useBegrotingsdata.ts
// Laadt alle begrotingen in één keer en rekent ze door.
//
// Alle begrotingen samen ophalen is hier goedkoper dan per entiteit: er zijn er
// een handvol, en de inkomende onderlinge leveringen van de één zitten in de
// begroting van de ander. Met alles in het geheugen kan de rekenmotor zonder
// extra queries vooruit.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { haalBegrotingen } from '../services/budgetService';
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
  const { entiteiten } = useApp();
  const [begrotingen, setBegrotingen] = useState<Budget[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const herlaad = useCallback(async () => {
    setLaden(true);
    setFout(null);

    try {
      setBegrotingen(await haalBegrotingen());
    } catch (foutmelding) {
      console.error('Begrotingen laden mislukt:', foutmelding);
      setFout('De begrotingen konden niet geladen worden.');
      setBegrotingen([]);
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void herlaad();
  }, [herlaad]);

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
