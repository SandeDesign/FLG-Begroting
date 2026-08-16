// src/components/begroting/VerplaatsOpdrachtModal.tsx
// Een opdracht naar de begroting van een andere entiteit tillen, met alles wat
// eraan hangt. Bedoeld voor het moment dat een opdracht een eigen entiteit
// krijgt — zoals Bezorging die van Buddy naar Smart Transport gaat.

import React, { useEffect, useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { Budget, Entity, Opdracht } from '../../types/begroting';

interface VerplaatsOpdrachtModalProps {
  isOpen: boolean;
  onClose: () => void;
  opdracht: Opdracht | null;
  vanEntiteit: Entity;
  /** Alle begrotingen van andere entiteiten waar we naartoe kunnen verplaatsen. */
  doelen: Array<{ budget: Budget; entiteit: Entity }>;
  /** Wat er meeverhuist, om het vooraf te kunnen tonen. */
  aantalMiddelen: number;
  aantalInzet: number;
  aantalLeveringen: number;
  onVerplaatsen: (naarBudgetId: string) => Promise<void>;
}

const VerplaatsOpdrachtModal: React.FC<VerplaatsOpdrachtModalProps> = ({
  isOpen,
  onClose,
  opdracht,
  vanEntiteit,
  doelen,
  aantalMiddelen,
  aantalInzet,
  aantalLeveringen,
  onVerplaatsen,
}) => {
  const [doelId, setDoelId] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDoelId(doelen[0]?.budget.id ?? '');
    setFout(null);
  }, [isOpen, doelen]);

  const verplaats = async () => {
    if (!doelId) {
      setFout('Kies de begroting waar de opdracht naartoe moet.');
      return;
    }

    setBezig(true);
    setFout(null);

    try {
      await onVerplaatsen(doelId);
      onClose();
    } catch (foutmelding) {
      setFout(foutmelding instanceof Error ? foutmelding.message : 'Verplaatsen mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const meeverhuizend = [
    aantalMiddelen > 0 ? `${aantalMiddelen} ${aantalMiddelen === 1 ? 'middel' : 'middelen'}` : null,
    aantalInzet > 0 ? `${aantalInzet} keer inzet` : null,
    aantalLeveringen > 0
      ? `${aantalLeveringen} onderlinge ${aantalLeveringen === 1 ? 'levering' : 'leveringen'}`
      : null,
  ].filter((item): item is string => item !== null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Opdracht verplaatsen">
      <div className="space-y-4">
        {opdracht && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-sm">
            <span className="font-semibold text-gray-900 dark:text-gray-100">{opdracht.naam}</span>
            <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" aria-hidden />
            <span className="text-gray-500 dark:text-gray-400">nu bij {vanEntiteit.naam}</span>
          </div>
        )}

        {doelen.length === 0 ? (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-900 dark:text-amber-200">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" aria-hidden />
            <span>
              Er is geen andere begroting om naartoe te verplaatsen. Maak eerst een begroting aan
              voor de entiteit die de opdracht moet overnemen.
            </span>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                Naar welke begroting
              </span>
              <select
                value={doelId}
                onChange={(event) => setDoelId(event.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              >
                {doelen.map(({ budget, entiteit }) => (
                  <option key={budget.id} value={budget.id}>
                    {entiteit.naam} — {budget.naam}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-sm text-gray-600 dark:text-gray-300">
              {meeverhuizend.length > 0 ? (
                <>
                  Mee verhuizen: <span className="font-medium">{meeverhuizend.join(', ')}</span>. De
                  onderlinge leveringen worden vanaf dan geleverd door de nieuwe entiteit.
                </>
              ) : (
                'Aan deze opdracht hangen geen middelen, inzet of leveringen.'
              )}
            </div>
          </>
        )}

        {fout && <p className="text-sm text-red-600 dark:text-red-400">{fout}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuleren
          </Button>
          <Button
            onClick={() => void verplaats()}
            loading={bezig}
            disabled={doelen.length === 0}
          >
            Verplaatsen
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default VerplaatsOpdrachtModal;
