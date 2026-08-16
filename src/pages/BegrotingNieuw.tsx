// src/pages/BegrotingNieuw.tsx
// Een nieuwe begroting: leeg beginnen bij een entiteit en periode, of een
// bestaande begroting dupliceren als scenario.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, FilePlus2 } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { useBegrotingsdata } from '../hooks/useBegrotingsdata';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { dupliceerAlsScenario, maakBegroting } from '../services/budgetService';
import { bouwPeriode, isGeldigePeriode, periodeBereikLabel } from '../utils/dateFilters';
import { STANDAARD_AANNAMES } from '../types/begroting';

type Manier = 'leeg' | 'scenario';

const BegrotingNieuw: React.FC = () => {
  usePageTitle('Nieuwe begroting');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entiteiten, geselecteerdeEntiteit, geselecteerdJaar } = useApp();
  const { doorgerekend, laden } = useBegrotingsdata();

  const [manier, setManier] = useState<Manier>('leeg');
  const [entityId, setEntityId] = useState(geselecteerdeEntiteit?.id ?? '');
  const [naam, setNaam] = useState('');
  const [periodeVan, setPeriodeVan] = useState(bouwPeriode(geselecteerdJaar, 1));
  const [periodeTot, setPeriodeTot] = useState(bouwPeriode(geselecteerdJaar, 12));
  const [bronId, setBronId] = useState('');
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const maak = async () => {
    setFout(null);

    if (!naam.trim()) {
      setFout('Geef de begroting een naam.');
      return;
    }

    setBezig(true);

    try {
      if (manier === 'scenario') {
        if (!bronId) {
          setFout('Kies de begroting waarvan je een scenario wilt maken.');
          setBezig(false);
          return;
        }

        const nieuwId = await dupliceerAlsScenario(bronId, naam.trim(), user?.uid ?? '');
        navigate(`/begrotingen/${nieuwId}`);
        return;
      }

      if (!entityId) {
        setFout('Kies een entiteit.');
        setBezig(false);
        return;
      }

      if (!isGeldigePeriode(periodeVan) || !isGeldigePeriode(periodeTot)) {
        setFout('Vul de periode in als JJJJ-MM, bijvoorbeeld 2026-01.');
        setBezig(false);
        return;
      }

      if (periodeTot < periodeVan) {
        setFout('De einddatum ligt vóór de begindatum.');
        setBezig(false);
        return;
      }

      const nieuwId = await maakBegroting({
        entityId,
        naam: naam.trim(),
        periodeVan,
        periodeTot,
        status: 'concept',
        scenarioVan: null,
        weergaveEenheid: 'maand',
        aannames: STANDAARD_AANNAMES,
        opdrachten: [],
        middelen: [],
        inzet: [],
        subsidies: [],
        onderlingeLeveringen: [],
        createdBy: user?.uid ?? '',
      });

      navigate(`/begrotingen/${nieuwId}`);
    } catch (foutmelding) {
      setFout(foutmelding instanceof Error ? foutmelding.message : 'Aanmaken mislukt.');
      setBezig(false);
    }
  };

  if (laden) return <LoadingSpinner />;

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title="Nieuwe begroting"
        subtitle="Leeg beginnen of een bestaand scenario dupliceren"
        emoji="➕"
        actions={
          <Button variant="outline" onClick={() => navigate('/begrotingen')}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Terug
          </Button>
        }
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setManier('leeg')}
            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors ${
              manier === 'leeg'
                ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40'
            }`}
          >
            <FilePlus2 className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                Leeg beginnen
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Kies een entiteit en een periode
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setManier('scenario')}
            disabled={doorgerekend.length === 0}
            className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              manier === 'scenario'
                ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40'
            }`}
          >
            <Copy className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                Scenario dupliceren
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Een kopie van een bestaande begroting
              </span>
            </span>
          </button>
        </div>

        <div className="space-y-4">
          <Input
            label="Naam"
            placeholder="Buddy 2026 basis"
            value={naam}
            onChange={(event) => setNaam(event.target.value)}
          />

          {manier === 'leeg' ? (
            <>
              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                  Entiteit
                </span>
                <select
                  value={entityId}
                  onChange={(event) => setEntityId(event.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="">Kies een entiteit…</option>
                  {entiteiten.map((entiteit) => (
                    <option key={entiteit.id} value={entiteit.id}>
                      {entiteit.naam}
                      {entiteit.actief ? '' : ' (inactief)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Van"
                  placeholder="2026-01"
                  value={periodeVan}
                  onChange={(event) => setPeriodeVan(event.target.value)}
                  helperText="JJJJ-MM"
                />
                <Input
                  label="Tot en met"
                  placeholder="2026-12"
                  value={periodeTot}
                  onChange={(event) => setPeriodeTot(event.target.value)}
                  helperText="JJJJ-MM"
                />
              </div>

              {isGeldigePeriode(periodeVan) && isGeldigePeriode(periodeTot) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Loopt van {periodeBereikLabel(periodeVan, periodeTot)}.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-gray-700 dark:text-gray-200 tracking-tight">
                Dupliceer deze begroting
              </span>
              <select
                value={bronId}
                onChange={(event) => setBronId(event.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="">Kies een begroting…</option>
                {doorgerekend.map(({ budget, entiteit }) => (
                  <option key={budget.id} value={budget.id}>
                    {entiteit.naam} — {budget.naam}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Alles gaat mee: opdrachten, middelen, inzet, subsidies, onderlinge leveringen en
                de aannames. Het nieuwe scenario begint als concept.
              </p>
            </div>
          )}

          {fout && (
            <p className="text-sm text-red-600 dark:text-red-400">{fout}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/begrotingen')}>
              Annuleren
            </Button>
            <Button onClick={() => void maak()} loading={bezig}>
              Begroting aanmaken
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BegrotingNieuw;
