// src/pages/VasteLasten.tsx
// De vaste lasten van één entiteit. Elke regel heeft een eigen eenheid; onderaan
// staat het totaal per maand, want dat is waar de rekenmotor mee werkt.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Receipt, Trash2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import EenheidKeuze from '../components/begroting/EenheidKeuze';
import { bewaarVasteLasten, haalEntiteit } from '../services/entityService';
import { formatEuro, naarMaand } from '../utils/periode';
import {
  STANDAARD_AANNAMES,
  VASTE_LAST_CATEGORIE_LABEL,
  type Eenheid,
  type Entity,
  type VasteLast,
  type VasteLastCategorie,
} from '../types/begroting';

const CATEGORIEEN = Object.keys(VASTE_LAST_CATEGORIE_LABEL) as VasteLastCategorie[];

/** Een id dat uniek genoeg is binnen één lijst met vaste lasten. */
function nieuwId(): string {
  return `vl-${Math.random().toString(36).slice(2, 10)}`;
}

const VasteLasten: React.FC = () => {
  usePageTitle('Vaste lasten');
  const { entityId } = useParams<{ entityId: string }>();
  const navigate = useNavigate();
  const { herlaadEntiteiten } = useApp();

  const [entiteit, setEntiteit] = useState<Entity | null>(null);
  const [regels, setRegels] = useState<VasteLast[]>([]);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [gewijzigd, setGewijzigd] = useState(false);

  useEffect(() => {
    if (!entityId) return;

    let actief = true;
    setLaden(true);

    haalEntiteit(entityId)
      .then((gevonden) => {
        if (!actief) return;
        setEntiteit(gevonden);
        setRegels(gevonden?.vasteLasten ?? []);
      })
      .catch(() => setMelding('De entiteit kon niet geladen worden.'))
      .finally(() => {
        if (actief) setLaden(false);
      });

    return () => {
      actief = false;
    };
  }, [entityId]);

  const totaalPerMaand = useMemo(
    () =>
      regels.reduce(
        (totaal, regel) => totaal + naarMaand(regel.bedrag, regel.eenheid, STANDAARD_AANNAMES),
        0
      ),
    [regels]
  );

  const wijzig = (id: string, aanpassing: Partial<VasteLast>) => {
    setRegels((huidig) =>
      huidig.map((regel) => (regel.id === id ? { ...regel, ...aanpassing } : regel))
    );
    setGewijzigd(true);
  };

  const voegToe = () => {
    setRegels((huidig) => [
      ...huidig,
      {
        id: nieuwId(),
        omschrijving: '',
        bedrag: 0,
        eenheid: 'maand',
        categorie: 'overig',
      },
    ]);
    setGewijzigd(true);
  };

  const verwijder = (id: string) => {
    setRegels((huidig) => huidig.filter((regel) => regel.id !== id));
    setGewijzigd(true);
  };

  const bewaar = async () => {
    if (!entityId) return;

    const leeg = regels.find((regel) => !regel.omschrijving.trim());
    if (leeg) {
      setMelding('Elke regel heeft een omschrijving nodig.');
      return;
    }

    setBezig(true);
    setMelding(null);

    try {
      await bewaarVasteLasten(entityId, regels);
      await herlaadEntiteiten();
      setGewijzigd(false);
      setMelding('De vaste lasten zijn opgeslagen.');
    } catch {
      setMelding('Opslaan mislukt. Probeer het opnieuw.');
    } finally {
      setBezig(false);
    }
  };

  if (laden) return <LoadingSpinner />;

  if (!entiteit) {
    return (
      <Card>
        <EmptyState
          icon={Receipt}
          title="Entiteit niet gevonden"
          description="Deze entiteit bestaat niet meer."
          actionLabel="Terug naar entiteiten"
          onAction={() => navigate('/entiteiten')}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vaste lasten"
        subtitle={entiteit.naam}
        emoji="🧾"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/entiteiten')}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Terug
            </Button>
            <Button onClick={() => void bewaar()} loading={bezig} disabled={!gewijzigd}>
              Opslaan
            </Button>
          </div>
        }
      />

      {melding && (
        <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
          {melding}
        </div>
      )}

      <Card>
        {regels.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nog geen vaste lasten"
            description="Kantoorhuur, verzekeringen, boekhouding, software — alles wat doorloopt, ongeacht de opdrachten."
            actionLabel="Regel toevoegen"
            onAction={voegToe}
          />
        ) : (
          <div className="space-y-3">
            {regels.map((regel) => (
              <div
                key={regel.id}
                className="grid gap-3 sm:grid-cols-[1fr_140px_150px_150px_auto] sm:items-end p-3 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <Input
                  label="Omschrijving"
                  placeholder="Kantoorhuur"
                  value={regel.omschrijving}
                  onChange={(event) => wijzig(regel.id, { omschrijving: event.target.value })}
                />

                <Input
                  label="Bedrag"
                  type="number"
                  step="0.01"
                  min="0"
                  value={regel.bedrag}
                  onChange={(event) =>
                    wijzig(regel.id, { bedrag: Number.parseFloat(event.target.value) || 0 })
                  }
                />

                <div className="space-y-1.5">
                  <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                    Eenheid
                  </span>
                  <EenheidKeuze
                    waarde={regel.eenheid}
                    onChange={(eenheid: Eenheid) => wijzig(regel.id, { eenheid })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                    Categorie
                  </span>
                  <select
                    value={regel.categorie}
                    onChange={(event) =>
                      wijzig(regel.id, { categorie: event.target.value as VasteLastCategorie })
                    }
                    className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                  >
                    {CATEGORIEEN.map((categorie) => (
                      <option key={categorie} value={categorie}>
                        {VASTE_LAST_CATEGORIE_LABEL[categorie]}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => verwijder(regel.id)}
                  aria-label={`${regel.omschrijving || 'Regel'} verwijderen`}
                  className="h-[42px] px-3 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors justify-self-start"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button variant="outline" onClick={voegToe}>
                <Plus className="h-4 w-4" aria-hidden />
                Regel toevoegen
              </Button>

              <div className="text-right">
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Totaal per maand
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatEuro(totaalPerMaand)}
                </span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default VasteLasten;
