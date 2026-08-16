// src/pages/BegrotingWerkblad.tsx
// Het werkblad van één begroting: acht tabbladen, met bovenaan altijd de
// controlebalk en de weergave-eenheid.
//
// Elke wijziging wordt meteen opgeslagen. Dat scheelt een opslaanknop en je
// raakt nooit werk kwijt door een gesloten tabblad.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRightLeft,
  Briefcase,
  Copy,
  Download,
  FileText,
  HandCoins,
  Layers,
  Package,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Users,
} from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useApp } from '../contexts/AppContext';
import { useBegrotingen } from '../contexts/BegrotingsdataContext';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/ui/PageHeader';
import ActionMenu from '../components/ui/ActionMenu';
import TabKiezer from '../components/begroting/TabKiezer';
import { MIDDEL_SOORT_ICOON } from '../components/begroting/middelSoortIcoon';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import ControleBalk from '../components/begroting/ControleBalk';
import EenheidSchakelaar from '../components/begroting/EenheidSchakelaar';
import ResultatenStaat from '../components/begroting/ResultatenStaat';
import BtwStaat from '../components/begroting/BtwStaat';
import OpdrachtTabel from '../components/begroting/OpdrachtTabel';
import RegelKaart from '../components/begroting/RegelKaart';
import OpdrachtModal from '../components/begroting/OpdrachtModal';
import MiddelModal from '../components/begroting/MiddelModal';
import InzetModal from '../components/begroting/InzetModal';
import SubsidieModal from '../components/begroting/SubsidieModal';
import LeveringModal from '../components/begroting/LeveringModal';
import VerplaatsOpdrachtModal from '../components/begroting/VerplaatsOpdrachtModal';
import SchaalPaneel from '../components/begroting/SchaalPaneel';
import {
  dupliceerAlsScenario,
  verplaatsOpdracht,
  werkBegrotingBij,
} from '../services/budgetService';
import { exporteerBegrotingCSV, exporteerBegrotingPDF } from '../services/exportService';
import {
  berekenBegroting,
  berekenInzet,
  berekenLevering,
  berekenLeveringBtw,
  berekenMiddel,
  berekenOnderhoud,
  berekenOpbrengst,
  berekenSubsidie,
  controleerBegroting,
  omschrijfInzet,
  pasSchaalToe,
  splitsLoondienst,
  zzpTarief,
} from '../utils/begroting.calc';
import { periodeBereikLabel } from '../utils/dateFilters';
import { formatEuro, formatGetal, formatPercentage, naarMaand, vanMaand } from '../utils/periode';
import {
  BEGROTING_STATUS_LABEL,
  BTW_LABEL,
  EENHEID_LABEL,
  FINANCIERING_LABEL,
  GRONDSLAG_LABEL,
  HOORT_BIJ_ENTITEIT,
  INZET_SOORT_LABEL,
  isSchaalRegel,
  MIDDEL_SOORT_KOSTEN,
  MIDDEL_SOORT_LABEL,
  OPBRENGST_SOORT_LABEL,
  VERDEELSLEUTEL_LABEL,
  type Aannames,
  type Budget,
  type Eenheid,
  type Entity,
  type Inzet,
  type Middel,
  type NieuweBudget,
  type OnderlingeLevering,
  type Opdracht,
  type Schaal,
  type Subsidie,
  type Verdeelsleutel,
} from '../types/begroting';

const TABBLADEN = [
  { id: 'overzicht', naam: 'Overzicht', icoon: Table2 },
  { id: 'opdrachten', naam: 'Opdrachten', icoon: Briefcase },
  { id: 'middelen', naam: 'Middelen', icoon: Package },
  { id: 'inzet', naam: 'Inzet', icoon: Users },
  { id: 'subsidies', naam: 'Subsidies', icoon: HandCoins },
  { id: 'onderling', naam: 'Onderling', icoon: ArrowRightLeft },
  { id: 'schaal', naam: 'Schaal', icoon: Layers },
  { id: 'aannames', naam: 'Aannames', icoon: SlidersHorizontal },
  { id: 'controles', naam: 'Controles', icoon: ShieldCheck },
] as const;

type TabId = (typeof TABBLADEN)[number]['id'];

const BegrotingWerkblad: React.FC = () => {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { entiteiten } = useApp();
  const [zoekParams, setZoekParams] = useSearchParams();

  // De begrotingen komen uit de gedeelde luisteraar: geen query bij het openen,
  // dus het werkblad staat er meteen. Het budget zelf staat lokaal, zodat een
  // wijziging direct zichtbaar is en pas daarna wordt weggeschreven.
  const { begrotingen: alleBegrotingen, laden } = useBegrotingen();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [melding, setMelding] = useState<string | null>(null);

  const [opdrachtModal, setOpdrachtModal] = useState<{ open: boolean; item: Opdracht | null }>({
    open: false,
    item: null,
  });
  const [middelModal, setMiddelModal] = useState<{ open: boolean; item: Middel | null }>({
    open: false,
    item: null,
  });
  const [inzetModal, setInzetModal] = useState<{ open: boolean; item: Inzet | null }>({
    open: false,
    item: null,
  });
  const [subsidieModal, setSubsidieModal] = useState<{ open: boolean; item: Subsidie | null }>({
    open: false,
    item: null,
  });
  const [leveringModal, setLeveringModal] = useState<{
    open: boolean;
    item: OnderlingeLevering | null;
  }>({ open: false, item: null });
  const [verplaatsModal, setVerplaatsModal] = useState<{ open: boolean; item: Opdracht | null }>({
    open: false,
    item: null,
  });

  const tab = (zoekParams.get('tab') as TabId | null) ?? 'overzicht';
  const zetTab = (nieuw: TabId) => setZoekParams({ tab: nieuw }, { replace: true });

  // Het handboek kan hier naartoe linken met ?open=inzet en dergelijke. Dan gaat
  // meteen het juiste scherm open, zodat je niet hoeft te zoeken naar wat er in
  // de uitleg stond.
  const teOpenen = zoekParams.get('open');

  useEffect(() => {
    if (!teOpenen) return;

    switch (teOpenen) {
      case 'opdracht':
        setOpdrachtModal({ open: true, item: null });
        break;
      case 'middel':
        setMiddelModal({ open: true, item: null });
        break;
      case 'inzet':
        setInzetModal({ open: true, item: null });
        break;
      case 'subsidie':
        setSubsidieModal({ open: true, item: null });
        break;
      case 'levering':
        setLeveringModal({ open: true, item: null });
        break;
      default:
        break;
    }

    // De parameter meteen opruimen, zodat het scherm niet opnieuw opengaat als
    // je terugnavigeert of de pagina ververst.
    const rest = new URLSearchParams(zoekParams);
    rest.delete('open');
    setZoekParams(rest, { replace: true });
    // Alleen reageren op een nieuwe open-parameter, niet op elke wijziging van
    // de zoekparameters — anders zou het opruimen zichzelf opnieuw aftrappen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teOpenen]);

  const entiteit = useMemo<Entity | null>(
    () => entiteiten.find((item) => item.id === budget?.entityId) ?? null,
    [entiteiten, budget?.entityId]
  );

  usePageTitle(budget?.naam ?? 'Begroting');

  // ── Laden
  //
  // Zodra de gedeelde lijst binnen is, of zodra je naar een andere begroting
  // gaat, wordt het lokale budget daaruit overgenomen. Staat er al een budget
  // met hetzelfde id, dan blijft dat staan: dat is de versie met de wijziging
  // die je zojuist deed.
  useEffect(() => {
    if (!budgetId) return;

    const gevonden = alleBegrotingen.find((item) => item.id === budgetId) ?? null;
    setBudget((huidig) => (huidig && huidig.id === budgetId ? huidig : gevonden));
  }, [budgetId, alleBegrotingen]);

  // ── Opslaan: lokaal bijwerken en meteen wegschrijven
  const bewaar = useCallback(
    async (wijzigingen: Partial<NieuweBudget>) => {
      if (!budget) return;

      const vorige = budget;
      setBudget({ ...budget, ...wijzigingen });

      try {
        await werkBegrotingBij(budget.id, wijzigingen);
        setMelding(null);
      } catch {
        setBudget(vorige);
        setMelding('Opslaan mislukt. De wijziging is teruggedraaid.');
      }
    },
    [budget]
  );

  // ── Doorrekenen
  const inkomendeLeveringen = useMemo(
    () =>
      alleBegrotingen
        .flatMap((item) => item.onderlingeLeveringen)
        .filter((levering) => levering.naarEntityId === budget?.entityId),
    [alleBegrotingen, budget?.entityId]
  );

  const resultaat = useMemo(
    () => (budget && entiteit ? berekenBegroting(budget, entiteit, inkomendeLeveringen) : null),
    [budget, entiteit, inkomendeLeveringen]
  );

  const afwijkingen = useMemo(
    () => (resultaat ? controleerBegroting(resultaat) : []),
    [resultaat]
  );

  if (laden) return <LoadingSpinner />;

  if (!budget || !entiteit || !resultaat) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Begroting niet gevonden"
          description={
            budget
              ? 'De entiteit van deze begroting bestaat niet meer. Maak hem opnieuw aan of verwijder de begroting.'
              : 'Deze begroting bestaat niet meer.'
          }
          actionLabel="Terug naar begrotingen"
          onAction={() => navigate('/begrotingen')}
        />
      </Card>
    );
  }

  // De lijsten tonen de geschaalde versie: de regels die uit de schaalknoppen
  // volgen staan er dan gewoon tussen, herkenbaar gemarkeerd. Anders zie je ze
  // wel terug in het resultaat maar nergens in de opsomming.
  const geschaald = pasSchaalToe(budget);
  const eenheid = budget.weergaveEenheid;
  const aannames = budget.aannames;
  const om = (bedrag: number) => vanMaand(bedrag, eenheid, aannames);

  const naamVanOpdracht = (opdrachtId: string): string => {
    if (opdrachtId === HOORT_BIJ_ENTITEIT) return 'De entiteit zelf';
    return geschaald.opdrachten.find((item) => item.id === opdrachtId)?.naam ?? 'Onbekende opdracht';
  };

  const naamVanEntiteit = (entityId: string): string =>
    entiteiten.find((item) => item.id === entityId)?.naam ?? 'Onbekende entiteit';

  // ── Wijzigingen per lijst
  const bewaarOpdracht = async (opdracht: Opdracht) => {
    const bestaat = budget.opdrachten.some((item) => item.id === opdracht.id);
    await bewaar({
      opdrachten: bestaat
        ? budget.opdrachten.map((item) => (item.id === opdracht.id ? opdracht : item))
        : [...budget.opdrachten, opdracht],
    });
  };

  const verwijderOpdracht = async (opdracht: Opdracht) => {
    const hangend =
      budget.middelen.filter((item) => item.hoortBij === opdracht.id).length +
      budget.inzet.filter((item) => item.hoortBij === opdracht.id).length;

    const tekst = hangend
      ? `"${opdracht.naam}" verwijderen? Er hangen nog ${hangend} regels aan; die blijven staan maar horen dan nergens meer bij.`
      : `"${opdracht.naam}" verwijderen?`;

    if (!window.confirm(tekst)) return;
    await bewaar({ opdrachten: budget.opdrachten.filter((item) => item.id !== opdracht.id) });
  };

  const bewaarMiddel = async (middel: Middel) => {
    const bestaat = budget.middelen.some((item) => item.id === middel.id);
    await bewaar({
      middelen: bestaat
        ? budget.middelen.map((item) => (item.id === middel.id ? middel : item))
        : [...budget.middelen, middel],
    });
  };

  const bewaarInzet = async (inzet: Inzet) => {
    const bestaat = budget.inzet.some((item) => item.id === inzet.id);
    await bewaar({
      inzet: bestaat
        ? budget.inzet.map((item) => (item.id === inzet.id ? inzet : item))
        : [...budget.inzet, inzet],
    });
  };

  const bewaarSubsidie = async (subsidie: Subsidie) => {
    const bestaat = budget.subsidies.some((item) => item.id === subsidie.id);
    await bewaar({
      subsidies: bestaat
        ? budget.subsidies.map((item) => (item.id === subsidie.id ? subsidie : item))
        : [...budget.subsidies, subsidie],
    });
  };

  const bewaarLevering = async (levering: OnderlingeLevering) => {
    const bestaat = budget.onderlingeLeveringen.some((item) => item.id === levering.id);
    await bewaar({
      onderlingeLeveringen: bestaat
        ? budget.onderlingeLeveringen.map((item) => (item.id === levering.id ? levering : item))
        : [...budget.onderlingeLeveringen, levering],
    });
  };

  const bewaarAannames = async (aanpassing: Partial<Aannames>) => {
    await bewaar({ aannames: { ...aannames, ...aanpassing } });
  };

  const bewaarSchaal = async (aanpassing: Partial<Schaal>) => {
    await bewaar({ schaal: { ...budget.schaal, ...aanpassing } });
  };

  /**
   * Zet de regels die de schaal genereert om naar gewone regels, zodat je ze per
   * stuk kunt aanpassen. De schaalknoppen gaan daarna uit — anders zou alles
   * dubbel tellen.
   */
  const zetSchaalVast = async () => {
    const bevestigd = window.confirm(
      'De extra routes worden omgezet naar losse regels die je per stuk kunt aanpassen. De schaalknoppen gaan daarna uit. Doorgaan?'
    );
    if (!bevestigd) return;

    const uniek = (id: string) => `${id.replace('schaal-', '')}-${Math.random().toString(36).slice(2, 8)}`;
    const vertaling = new Map<string, string>();

    const nieuweOpdrachten = geschaald.opdrachten.map((item) => {
      if (!isSchaalRegel(item.id)) return item;
      const nieuwId = uniek(item.id);
      vertaling.set(item.id, nieuwId);
      return { ...item, id: nieuwId, voorWie: '' };
    });

    await bewaar({
      opdrachten: nieuweOpdrachten,
      middelen: geschaald.middelen.map((item) =>
        isSchaalRegel(item.id)
          ? { ...item, id: uniek(item.id), hoortBij: vertaling.get(item.hoortBij) ?? item.hoortBij }
          : item
      ),
      inzet: geschaald.inzet.map((item) =>
        isSchaalRegel(item.id)
          ? { ...item, id: uniek(item.id), hoortBij: vertaling.get(item.hoortBij) ?? item.hoortBij }
          : item
      ),
      schaal: { ...budget.schaal, actief: false, extraRoutes: 0, zzpRoutes: 0 },
    });

    setMelding('De extra routes staan nu als losse regels in de begroting. De schaalknoppen zijn uitgezet.');
  };

  const dupliceer = async () => {
    const naam = window.prompt('Naam voor het nieuwe scenario', `${budget.naam} — variant`);
    if (!naam?.trim()) return;

    try {
      const nieuwId = await dupliceerAlsScenario(budget.id, naam.trim(), user?.uid ?? '');
      navigate(`/begrotingen/${nieuwId}`);
    } catch {
      setMelding('Dupliceren mislukt.');
    }
  };

  const doeVerplaatsing = async (naarBudgetId: string) => {
    const opdracht = verplaatsModal.item;
    if (!opdracht) return;

    const overzicht = await verplaatsOpdracht(budget.id, naarBudgetId, opdracht.id);
    // De luisteraar levert de bijgewerkte begroting; het lokale budget moet die
    // versie overnemen, want de opdracht staat er nu niet meer in.
    setBudget(null);
    setMelding(
      `"${overzicht.opdracht}" is verplaatst, samen met ${overzicht.aantalMiddelen} middelen, ${overzicht.aantalInzet} keer inzet en ${overzicht.aantalLeveringen} onderlinge leveringen.`
    );
  };

  const verplaatsDoelen = alleBegrotingen
    .filter((item) => item.id !== budget.id)
    .flatMap((item) => {
      const doelEntiteit = entiteiten.find((e) => e.id === item.entityId);
      return doelEntiteit ? [{ budget: item, entiteit: doelEntiteit }] : [];
    });

  const andereEntiteiten = entiteiten.filter((item) => item.id !== entiteit.id);

  return (
    <div className="space-y-4">
      <PageHeader
        title={budget.naam}
        subtitle={`${entiteit.naam} · ${periodeBereikLabel(budget.periodeVan, budget.periodeTot)} · ${BEGROTING_STATUS_LABEL[budget.status]}`}
        emoji="📋"
        actiesNaastTitel
        actions={
          <>
            {/* Telefoon: alles onder één knop, anders vult die rij het halve scherm */}
            <ActionMenu
              variant="knop"
              label="Acties voor deze begroting"
              className="sm:hidden"
              actions={[
                {
                  label: 'Terug naar begrotingen',
                  icon: ArrowLeft,
                  onClick: () => navigate('/begrotingen'),
                },
                { label: 'Dupliceren als scenario', icon: Copy, onClick: () => void dupliceer() },
                {
                  label: 'Exporteren naar CSV',
                  icon: Download,
                  onClick: () => exporteerBegrotingCSV(resultaat, eenheid),
                },
                {
                  label: 'Exporteren naar PDF',
                  icon: Download,
                  onClick: () => void exporteerBegrotingPDF(resultaat, eenheid),
                },
              ]}
            />

            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/begrotingen')}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Terug
              </Button>
              <Button variant="outline" onClick={() => void dupliceer()}>
                <Copy className="h-4 w-4" aria-hidden />
                Scenario
              </Button>
              <Button variant="outline" onClick={() => exporteerBegrotingCSV(resultaat, eenheid)}>
                <Download className="h-4 w-4" aria-hidden />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => void exporteerBegrotingPDF(resultaat, eenheid)}
              >
                <Download className="h-4 w-4" aria-hidden />
                PDF
              </Button>
            </div>
          </>
        }
      />

      <ControleBalk afwijkingen={afwijkingen} waarschuwingen={resultaat.waarschuwingen} />

      {melding && (
        <div className="px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
          {melding}
        </div>
      )}

      {/* Tabbladen */}
      <TabKiezer
        actief={tab}
        onKies={zetTab}
        tabbladen={TABBLADEN.map((blad) => ({
          ...blad,
          telling: blad.id === 'controles' ? afwijkingen.length : 0,
        }))}
      />

      {/* ── Overzicht */}
      {tab === 'overzicht' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <EenheidSchakelaar
              waarde={eenheid}
              onChange={(nieuw: Eenheid) => void bewaar({ weergaveEenheid: nieuw })}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <ResultatenStaat resultaat={resultaat} eenheid={eenheid} />
            </Card>

            <Card>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
                In het kort
              </h3>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Actieve opdrachten</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100">
                    {resultaat.opdrachten.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Middelen</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100">
                    {geschaald.middelen.filter((item) => item.actief).length}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Inzet</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100">
                    {geschaald.inzet.filter((item) => item.actief).length}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Onderlinge leveringen uit</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatEuro(om(resultaat.opbrengstOnderlingUit))}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Onderlinge leveringen in</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatEuro(om(resultaat.kostenOnderlingIn))}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Stuks per maand</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatGetal(resultaat.stuksPerMaand, 0)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Resultaat per stuk</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatEuro(resultaat.resultaatPerStuk)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Resultaat per opdracht</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatEuro(om(resultaat.resultaatPerOpdracht))}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">Verdeling vaste lasten</dt>
                  <dd className="font-semibold text-gray-900 dark:text-gray-100">
                    {VERDEELSLEUTEL_LABEL[aannames.verdeelsleutel]}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>

          <Card>
            <OpdrachtTabel resultaat={resultaat} eenheid={eenheid} />
          </Card>

          <Card>
            <BtwStaat resultaat={resultaat} eenheid={eenheid} />
          </Card>
        </div>
      )}

      {/* ── Opdrachten */}
      {tab === 'opdrachten' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Opdrachten
            </h3>
            <Button size="sm" onClick={() => setOpdrachtModal({ open: true, item: null })} title="Opdracht toevoegen" aria-label="Opdracht toevoegen">
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Opdracht</span>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => zetTab('schaal')}
            className="w-full mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-primary-50/60 dark:bg-primary-900/15 hover:bg-primary-50 dark:hover:bg-primary-900/25 transition-colors text-left"
          >
            <Layers
              className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5"
              aria-hidden
            />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Voeg je routes toe die als geheel meeschalen — zoveel routes, zoveel bussen, zoveel
              mensen? Gebruik dan de <span className="font-semibold">schaalknoppen</span>. Daar vul
              je het aantal op één plek in en maakt de app de opdracht, de bussen en de inzet in
              één keer aan.
            </span>
          </button>

          {geschaald.opdrachten.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nog geen opdrachten"
              description="Een opdracht is wat je doet en voor wie. De opbrengst gaat per uur, per stuk of als vast bedrag."
              actionLabel="Opdracht toevoegen"
              onAction={() => setOpdrachtModal({ open: true, item: null })}
            />
          ) : (
            <div className="space-y-2">
              {geschaald.opdrachten.map((opdracht) => (
                <RegelKaart
                  key={opdracht.id}
                  titel={opdracht.naam}
                  ondertitel={opdracht.voorWie ? `voor ${opdracht.voorWie}` : undefined}
                  labels={[
                    { tekst: OPBRENGST_SOORT_LABEL[opdracht.opbrengst.soort] },
                    ...(isSchaalRegel(opdracht.id)
                      ? [{ tekst: 'Uit de schaalknoppen', toon: 'schaal' as const }]
                      : []),
                    ...(opdracht.actief
                      ? []
                      : [{ tekst: 'Inactief', toon: 'waarschuwing' as const }]),
                  ]}
                  bedrag={om(berekenOpbrengst(opdracht, aannames))}
                  bedragLabel={`Opbrengst ${EENHEID_LABEL[eenheid]}`}
                  opbouw={(() => {
                    const regel = resultaat.opdrachten.find(
                      (item) => item.opdrachtId === opdracht.id
                    );
                    if (!regel) return undefined;
                    return [
                      { label: 'Middelen', bedrag: om(-regel.kostenMiddelen) },
                      { label: 'Inzet', bedrag: om(-regel.kostenInzet) },
                      { label: 'Aandeel vaste lasten', bedrag: om(-regel.aandeelVasteLasten) },
                      { label: 'Blijft over', bedrag: om(regel.overNaVasteLasten) },
                    ];
                  })()}
                  actief={opdracht.actief}
                  vanSchaal={isSchaalRegel(opdracht.id)}
                  onNaarSchaal={() => zetTab('schaal')}
                  onBewerken={() => setOpdrachtModal({ open: true, item: opdracht })}
                  onVerwijderen={() => void verwijderOpdracht(opdracht)}
                  extraActies={[
                    {
                      label: 'Verplaats naar andere entiteit',
                      icon: ArrowRightLeft,
                      onClick: () => setVerplaatsModal({ open: true, item: opdracht }),
                    },
                  ]}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Middelen */}
      {tab === 'middelen' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Middelen
            </h3>
            <Button size="sm" onClick={() => setMiddelModal({ open: true, item: null })} title="Middel toevoegen" aria-label="Middel toevoegen">
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Middel</span>
            </Button>
          </div>

          {geschaald.middelen.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nog geen middelen"
              description="Bussen, machines, gereedschap — alles wat geld kost en bij een opdracht of bij de entiteit zelf hoort."
              actionLabel="Middel toevoegen"
              onAction={() => setMiddelModal({ open: true, item: null })}
            />
          ) : (
            <div className="space-y-2">
              {geschaald.middelen.map((middel) => (
                <RegelKaart
                  key={middel.id}
                  titel={middel.naam}
                  icoon={MIDDEL_SOORT_ICOON[middel.soort]}
                  ondertitel={`hoort bij ${naamVanOpdracht(middel.hoortBij)}`}
                  labels={[
                    { tekst: MIDDEL_SOORT_LABEL[middel.soort] },
                    { tekst: FINANCIERING_LABEL[middel.financiering] },
                    ...(isSchaalRegel(middel.id)
                      ? [{ tekst: 'Uit de schaalknoppen', toon: 'schaal' as const }]
                      : []),
                    ...(middel.actief ? [] : [{ tekst: 'Inactief', toon: 'waarschuwing' as const }]),
                  ]}
                  bedrag={om(berekenMiddel(middel, aannames))}
                  bedragLabel={`Kosten ${EENHEID_LABEL[eenheid]}`}
                  opbouw={middelOpbouw(middel, aannames, om)}
                  actief={middel.actief}
                  vanSchaal={isSchaalRegel(middel.id)}
                  onNaarSchaal={() => zetTab('schaal')}
                  onBewerken={() => setMiddelModal({ open: true, item: middel })}
                  onVerwijderen={() => {
                    if (!window.confirm(`"${middel.naam}" verwijderen?`)) return;
                    void bewaar({
                      middelen: budget.middelen.filter((item) => item.id !== middel.id),
                    });
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Inzet */}
      {tab === 'inzet' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Inzet
            </h3>
            <Button size="sm" onClick={() => setInzetModal({ open: true, item: null })} title="Inzet toevoegen" aria-label="Inzet toevoegen">
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Inzet</span>
            </Button>
          </div>

          {!entiteit.heeftPersoneel && (
            <p className="mb-4 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-300">
              {entiteit.naam} staat niet als entiteit met personeel, dus loondienst kan hier niet.
              ZZP kan wel.
            </p>
          )}

          <button
            type="button"
            onClick={() => zetTab('schaal')}
            className="w-full mb-4 flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-primary-50/60 dark:bg-primary-900/15 hover:bg-primary-50 dark:hover:bg-primary-900/25 transition-colors text-left"
          >
            <Layers
              className="h-4 w-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5"
              aria-hidden
            />
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Hoort deze inzet bij een hele route, dan hoef je het aantal stuks hier niet apart in
              te vullen: op het tabblad <span className="font-semibold">Schaal</span> zet je het één
              keer neer en rekent de app de opbrengst én de kosten er samen uit.
            </span>
          </button>

          {geschaald.inzet.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nog geen inzet"
              description="Wie voert de opdracht uit? Loondienst, ZZP per stuk of ZZP per dag. Elke inzet hoort bij precies één opdracht."
              actionLabel="Inzet toevoegen"
              onAction={() => setInzetModal({ open: true, item: null })}
            />
          ) : (
            <div className="space-y-2">
              {geschaald.inzet.map((inzet) => {
                const loon = splitsLoondienst(inzet);
                const zzp = zzpTarief(inzet);
                return (
                  <RegelKaart
                    key={inzet.id}
                    titel={inzet.naam}
                    ondertitel={`${omschrijfInzet(inzet)} · hoort bij ${naamVanOpdracht(inzet.hoortBij)}`}
                    labels={[
                      { tekst: INZET_SOORT_LABEL[inzet.model.soort] },
                      ...(isSchaalRegel(inzet.id)
                        ? [{ tekst: 'Uit de schaalknoppen', toon: 'schaal' as const }]
                        : []),
                      ...(inzet.actief ? [] : [{ tekst: 'Inactief', toon: 'waarschuwing' as const }]),
                    ]}
                    bedrag={om(berekenInzet(inzet))}
                    bedragLabel={`Kosten ${EENHEID_LABEL[eenheid]}`}
                    opbouw={
                      loon
                        ? [
                            { label: 'Bruto', bedrag: om(loon.bruto) },
                            { label: 'Vakantiegeld', bedrag: om(loon.vakantiegeld) },
                            { label: 'Werkgeverslasten', bedrag: om(loon.werkgeverslasten) },
                            { label: 'Pensioen', bedrag: om(loon.pensioen) },
                            { label: 'Overig', bedrag: om(loon.overig) },
                          ]
                        : zzp
                          ? [
                              { label: `Krijgt per ${zzp.eenheid}`, bedrag: zzp.bedrag },
                              { label: 'Per dag', bedrag: zzp.perDag },
                              { label: 'Per maand', bedrag: zzp.perMaand },
                            ]
                          : undefined
                    }
                    actief={inzet.actief}
                    vanSchaal={isSchaalRegel(inzet.id)}
                    onNaarSchaal={() => zetTab('schaal')}
                    onBewerken={() => setInzetModal({ open: true, item: inzet })}
                    onVerwijderen={() => {
                      if (!window.confirm(`"${inzet.naam}" verwijderen?`)) return;
                      void bewaar({ inzet: budget.inzet.filter((item) => item.id !== inzet.id) });
                    }}
                  />
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Subsidies */}
      {tab === 'subsidies' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
              Subsidies
            </h3>
            <Button size="sm" onClick={() => setSubsidieModal({ open: true, item: null })} title="Subsidie toevoegen" aria-label="Subsidie toevoegen">
              <Plus className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Subsidie</span>
            </Button>
          </div>

          <p className="mb-4 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-xs text-emerald-800 dark:text-emerald-200">
            Een subsidie is een eigen regel in de resultatenstaat en wordt nooit van een loonkost
            afgetrokken. Hij hoort bij de entiteit, niet bij de opdracht.
          </p>

          {budget.subsidies.length === 0 ? (
            <EmptyState
              icon={HandCoins}
              title="Nog geen subsidies"
              description="Loonkostensubsidie, doelgroepvermindering — alles wat erbij komt zonder dat er een prestatie tegenover staat."
              actionLabel="Subsidie toevoegen"
              onAction={() => setSubsidieModal({ open: true, item: null })}
            />
          ) : (
            <div className="space-y-2">
              {budget.subsidies.map((subsidie) => (
                <RegelKaart
                  key={subsidie.id}
                  titel={subsidie.omschrijving}
                  ondertitel={
                    subsidie.inzetId
                      ? `bij ${budget.inzet.find((item) => item.id === subsidie.inzetId)?.naam ?? 'onbekende inzet'}`
                      : undefined
                  }
                  labels={
                    subsidie.einddatum
                      ? [{ tekst: `loopt tot ${subsidie.einddatum}` }]
                      : [{ tekst: 'doorlopend', toon: 'goed' as const }]
                  }
                  bedrag={om(berekenSubsidie(subsidie, aannames))}
                  bedragLabel={`Bedrag ${EENHEID_LABEL[eenheid]}`}
                  actief
                  onBewerken={() => setSubsidieModal({ open: true, item: subsidie })}
                  onVerwijderen={() => {
                    if (!window.confirm(`"${subsidie.omschrijving}" verwijderen?`)) return;
                    void bewaar({
                      subsidies: budget.subsidies.filter((item) => item.id !== subsidie.id),
                    });
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Onderling */}
      {tab === 'onderling' && (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Wat wij leveren
              </h3>
              <Button
                size="sm"
                onClick={() => setLeveringModal({ open: true, item: null })}
                disabled={andereEntiteiten.length === 0 || budget.opdrachten.length === 0}
               title="Levering toevoegen" aria-label="Levering toevoegen">
                <Plus className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">Levering</span>
              </Button>
            </div>

            <p className="mb-4 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-900/40 text-xs text-gray-600 dark:text-gray-300">
              Elke post die je onderling doorbelast is een eigen regel: mensen, bussen,
              administratie, huur — voeg er zoveel toe als er zijn. Alle bedragen zijn exclusief
              BTW; de BTW staat per regel apart en telt niet mee in het resultaat.
            </p>

            {budget.onderlingeLeveringen.length === 0 ? (
              <EmptyState
                icon={ArrowRightLeft}
                title="Nog geen onderlinge leveringen"
                description="Wat wij aan een andere entiteit leveren en wat wij daarvoor rekenen. Bij ons een opbrengst, bij hen een directe kost."
                actionLabel="Levering toevoegen"
                onAction={() => setLeveringModal({ open: true, item: null })}
              />
            ) : (
              <div className="space-y-2">
                {budget.onderlingeLeveringen.map((levering) => (
                  <RegelKaart
                    key={levering.id}
                    titel={levering.omschrijving}
                    ondertitel={`${entiteit.naam} → ${naamVanEntiteit(levering.naarEntityId)} · ${naamVanOpdracht(levering.opdrachtId)}`}
                    labels={[
                      { tekst: GRONDSLAG_LABEL[levering.grondslag] },
                      { tekst: `BTW ${BTW_LABEL[levering.btw ?? 'hoog']}` },
                    ]}
                    bedrag={om(berekenLevering(levering, aannames))}
                    bedragLabel={`Opbrengst ${EENHEID_LABEL[eenheid]}, ex BTW`}
                    opbouw={[
                      { label: 'Exclusief BTW', bedrag: om(berekenLevering(levering, aannames)) },
                      { label: 'BTW', bedrag: om(berekenLeveringBtw(levering, aannames)) },
                      {
                        label: 'Op de factuur',
                        bedrag: om(
                          berekenLevering(levering, aannames) +
                            berekenLeveringBtw(levering, aannames)
                        ),
                      },
                    ]}
                    actief
                    onBewerken={() => setLeveringModal({ open: true, item: levering })}
                    onVerwijderen={() => {
                      if (!window.confirm(`"${levering.omschrijving}" verwijderen?`)) return;
                      void bewaar({
                        onderlingeLeveringen: budget.onderlingeLeveringen.filter(
                          (item) => item.id !== levering.id
                        ),
                      });
                    }}
                  />
                ))}

                {/* Wat er in totaal naar elke entiteit gaat */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
                  {Array.from(
                    resultaat.onderlingUit.reduce((totalen, regel) => {
                      const huidig = totalen.get(regel.naarEntityId) ?? { ex: 0, btw: 0 };
                      totalen.set(regel.naarEntityId, {
                        ex: huidig.ex + regel.bedrag,
                        btw: huidig.btw + regel.btwBedrag,
                      });
                      return totalen;
                    }, new Map<string, { ex: number; btw: number }>())
                  ).map(([entityId, totalen]) => (
                    <div key={entityId} className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-300">
                        Totaal naar {naamVanEntiteit(entityId)}
                      </span>
                      <span className="text-sm tabular-nums">
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatEuro(om(totalen.ex))}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                          {' '}
                          ex BTW · {formatEuro(om(totalen.ex + totalen.btw))} op de factuur
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-4">
              Wat anderen aan ons leveren
            </h3>

            {resultaat.onderlingIn.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Geen enkele andere entiteit levert op dit moment aan {entiteit.naam}.
              </p>
            ) : (
              <div className="space-y-2">
                {resultaat.onderlingIn.map((regel) => (
                  <div
                    key={regel.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
                  >
                    <div className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {regel.omschrijving}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        van {naamVanEntiteit(regel.vanEntityId)} · beheer je bij die entiteit
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        Kosten {EENHEID_LABEL[eenheid]}, ex BTW
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatEuro(om(regel.bedrag))}
                      </span>
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        {formatEuro(om(regel.factuurbedrag))} op de factuur
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Schaal */}
      {tab === 'schaal' && (
        <SchaalPaneel
          schaal={budget.schaal}
          aannames={aannames}
          onWijzigen={(aanpassing) => void bewaarSchaal(aanpassing)}
          onVastzetten={() => void zetSchaalVast()}
        />
      )}

      {/* ── Aannames */}
      {tab === 'aannames' && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
            Aannames
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Deze waarden gelden voor de hele begroting en bepalen hoe bedragen worden omgerekend.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Dagen per maand"
              type="number"
              step="1"
              min="1"
              helperText="26 bij maandag tot en met zaterdag"
              value={aannames.dagenPerMaand}
              onChange={(event) =>
                void bewaarAannames({ dagenPerMaand: Number.parseFloat(event.target.value) || 0 })
              }
            />
            <Input
              label="Contracturen per week"
              type="number"
              step="0.5"
              min="1"
              helperText="Basis voor de omrekening van en naar uur"
              value={aannames.contracturenPerWeek}
              onChange={(event) =>
                void bewaarAannames({
                  contracturenPerWeek: Number.parseFloat(event.target.value) || 0,
                })
              }
            />
            <Input
              label="Uren per dag"
              type="number"
              step="0.5"
              min="0"
              value={aannames.urenPerDag}
              onChange={(event) =>
                void bewaarAannames({ urenPerDag: Number.parseFloat(event.target.value) || 0 })
              }
            />
            <Input
              label="Kilometers per dag per middel"
              type="number"
              step="1"
              min="0"
              value={aannames.kmPerDagPerMiddel}
              onChange={(event) =>
                void bewaarAannames({
                  kmPerDagPerMiddel: Number.parseFloat(event.target.value) || 0,
                })
              }
            />
            <Input
              label="Onderhoud per kilometer"
              type="number"
              step="0.001"
              min="0"
              helperText="Gebruikt als je onderhoud laat berekenen"
              value={aannames.onderhoudPerKm}
              onChange={(event) =>
                void bewaarAannames({ onderhoudPerKm: Number.parseFloat(event.target.value) || 0 })
              }
            />
            <Input
              label="Rente per jaar"
              type="number"
              step="0.001"
              min="0"
              helperText={`Nu ${formatPercentage(aannames.rente, 1)} — gebruikt bij financial lease`}
              value={aannames.rente}
              onChange={(event) =>
                void bewaarAannames({ rente: Number.parseFloat(event.target.value) || 0 })
              }
            />
            <Input
              label="BTW-tarief"
              type="number"
              step="0.01"
              min="0"
              helperText={`Nu ${formatPercentage(aannames.btwTarief, 0)}`}
              value={aannames.btwTarief}
              onChange={(event) =>
                void bewaarAannames({ btwTarief: Number.parseFloat(event.target.value) || 0 })
              }
            />
          </div>

          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
              Verdeling van de vaste lasten
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Hoe de vaste lasten van {entiteit.naam} over de opdrachten verdeeld worden.
            </p>

            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(VERDEELSLEUTEL_LABEL) as Verdeelsleutel[]).map((optie) => (
                <button
                  key={optie}
                  type="button"
                  onClick={() => void bewaarAannames({ verdeelsleutel: optie })}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors text-left ${
                    aannames.verdeelsleutel === optie
                      ? 'border-primary-400 bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-200'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                  }`}
                >
                  {VERDEELSLEUTEL_LABEL[optie]}
                </button>
              ))}
            </div>

            {aannames.verdeelsleutel === 'handmatig' && (
              <div className="mt-4 space-y-3">
                {budget.opdrachten
                  .filter((opdracht) => opdracht.actief)
                  .map((opdracht) => (
                    <Input
                      key={opdracht.id}
                      label={`${opdracht.naam} in procenten`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={aannames.handmatigeVerdeling[opdracht.id] ?? 0}
                      onChange={(event) =>
                        void bewaarAannames({
                          handmatigeVerdeling: {
                            ...aannames.handmatigeVerdeling,
                            [opdracht.id]: Number.parseFloat(event.target.value) || 0,
                          },
                        })
                      }
                    />
                  ))}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Komen de percentages niet op 100 uit, dan worden ze naar rato genormaliseerd. Er
                  raken dus nooit vaste lasten zoek.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Controles */}
      {tab === 'controles' && (
        <Card>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-1">
            Controles
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
            Elk totaal wordt langs een tweede, onafhankelijke weg herberekend. Een verschil groter
            dan een halve cent verschijnt hier.
          </p>

          <ControleBalk afwijkingen={afwijkingen} waarschuwingen={resultaat.waarschuwingen} />

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {[
                  ['Opbrengst uit opdrachten', resultaat.opbrengstOpdrachten],
                  ['Waarvan via de opdrachtregels', som(resultaat.opdrachten.map((o) => o.opbrengst))],
                  ['Kosten middelen', resultaat.kostenMiddelen],
                  [
                    'Waarvan per opdracht',
                    som(resultaat.opdrachten.map((o) => o.kostenMiddelen)),
                  ],
                  ['Waarvan op de entiteit', resultaat.kostenMiddelenOpEntiteit],
                  ['Kosten inzet', resultaat.kostenInzet],
                  ['Waarvan per opdracht', som(resultaat.opdrachten.map((o) => o.kostenInzet))],
                  ['Waarvan op de entiteit', resultaat.kostenInzetOpEntiteit],
                  ['Vaste lasten', resultaat.vasteLasten],
                  [
                    'Waarvan verdeeld over opdrachten',
                    som(resultaat.opdrachten.map((o) => o.aandeelVasteLasten)),
                  ],
                  ['Waarvan niet verdeeld', resultaat.nietVerdeeldeVasteLasten],
                ].map(([label, waarde], index) => (
                  <tr key={`${label}-${index}`}>
                    <td
                      className={`py-2 pr-3 ${
                        String(label).startsWith('Waarvan')
                          ? 'pl-4 text-gray-500 dark:text-gray-400'
                          : 'font-medium text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {label}
                    </td>
                    <td className="py-2 text-right tabular-nums text-gray-700 dark:text-gray-200">
                      {formatEuro(om(Number(waarde)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Modals */}
      <OpdrachtModal
        isOpen={opdrachtModal.open}
        onClose={() => setOpdrachtModal({ open: false, item: null })}
        opdracht={opdrachtModal.item}
        aannames={aannames}
        onBewaren={bewaarOpdracht}
      />

      <MiddelModal
        isOpen={middelModal.open}
        onClose={() => setMiddelModal({ open: false, item: null })}
        middel={middelModal.item}
        opdrachten={geschaald.opdrachten}
        aannames={aannames}
        onBewaren={bewaarMiddel}
      />

      <InzetModal
        isOpen={inzetModal.open}
        onClose={() => setInzetModal({ open: false, item: null })}
        inzet={inzetModal.item}
        opdrachten={geschaald.opdrachten}
        heeftPersoneel={entiteit.heeftPersoneel}
        entiteitNaam={entiteit.naam}
        onBewaren={bewaarInzet}
      />

      <SubsidieModal
        isOpen={subsidieModal.open}
        onClose={() => setSubsidieModal({ open: false, item: null })}
        subsidie={subsidieModal.item}
        inzet={budget.inzet}
        onBewaren={bewaarSubsidie}
      />

      <LeveringModal
        isOpen={leveringModal.open}
        onClose={() => setLeveringModal({ open: false, item: null })}
        levering={leveringModal.item}
        vanEntiteit={entiteit}
        andereEntiteiten={andereEntiteiten}
        opdrachten={budget.opdrachten}
        onBewaren={bewaarLevering}
      />

      <VerplaatsOpdrachtModal
        isOpen={verplaatsModal.open}
        onClose={() => setVerplaatsModal({ open: false, item: null })}
        opdracht={verplaatsModal.item}
        vanEntiteit={entiteit}
        doelen={verplaatsDoelen}
        aantalMiddelen={
          budget.middelen.filter((item) => item.hoortBij === verplaatsModal.item?.id).length
        }
        aantalInzet={budget.inzet.filter((item) => item.hoortBij === verplaatsModal.item?.id).length}
        aantalLeveringen={
          budget.onderlingeLeveringen.filter(
            (item) => item.opdrachtId === verplaatsModal.item?.id
          ).length
        }
        onVerplaatsen={doeVerplaatsing}
      />
    </div>
  );
};

/**
 * De losse bedragen van een middel staan in de eenheid van dat middel. Eerst
 * naar maand, zodat de weergave-omrekening daarna klopt.
 */
function middelPost(bedrag: number, middel: Middel, aannames: Aannames): number {
  return naarMaand(bedrag, middel.eenheid, aannames);
}

/**
 * De opbouw van een middel, met alleen de kostenposten die bij die soort horen.
 * Op een laptop staat geen wegenbelasting, dus die regel hoort er ook niet te
 * staan — al helemaal niet op nul, want dan lijkt het een keuze.
 */
function middelOpbouw(
  middel: Middel,
  aannames: Aannames,
  om: (bedrag: number) => number
): Array<{ label: string; bedrag: number }> {
  const posten = MIDDEL_SOORT_KOSTEN[middel.soort] ?? MIDDEL_SOORT_KOSTEN.voertuig;

  return [
    ...(posten.brandstof
      ? [{ label: posten.brandstof, bedrag: om(middelPost(middel.brandstof, middel, aannames)) }]
      : []),
    ...(posten.verzekering
      ? [
          {
            label: posten.verzekering,
            bedrag: om(middelPost(middel.verzekering, middel, aannames)),
          },
        ]
      : []),
    ...(posten.wegenbelasting
      ? [
          {
            label: posten.wegenbelasting,
            bedrag: om(middelPost(middel.wegenbelasting, middel, aannames)),
          },
        ]
      : []),
    ...(posten.onderhoud
      ? [{ label: posten.onderhoud, bedrag: om(berekenOnderhoud(middel, aannames)) }]
      : []),
    { label: posten.overig, bedrag: om(middelPost(middel.overig, middel, aannames)) },
  ];
}

function som(waarden: number[]): number {
  return waarden.reduce((totaal, waarde) => totaal + (Number.isFinite(waarde) ? waarde : 0), 0);
}

export default BegrotingWerkblad;
