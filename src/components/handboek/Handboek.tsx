// src/components/handboek/Handboek.tsx
// Het handboek: een schermvullend paneel met uitleg over alles wat de app doet.
//
// De verwijzingen zijn het punt. Elke "laat me zien"-knop brengt je naar de
// juiste pagina en opent daar zo nodig meteen het juiste scherm, zodat je niet
// hoeft te zoeken naar wat er in de uitleg staat.

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Search, X } from 'lucide-react';
import { HANDBOEK, type Verwijzing } from './handboekInhoud';
import BegrotingKiezer from './BegrotingKiezer';
import { useApp } from '../../contexts/AppContext';
import { haalBegroting } from '../../services/budgetService';

/** Waar een verwijzing je heen brengt, in gewone taal. */
const TAB_LABEL: Record<string, string> = {
  overzicht: 'het overzicht',
  opdrachten: 'de opdrachten',
  middelen: 'de middelen',
  inzet: 'de inzet',
  subsidies: 'de subsidies',
  onderling: 'de onderlinge leveringen',
  schaal: 'de schaalknoppen',
  aannames: 'de aannames',
  controles: 'de controles',
};

const OPENT_LABEL: Record<string, string> = {
  opdracht: 'het scherm voor een nieuwe opdracht',
  middel: 'het scherm voor een nieuw middel',
  inzet: 'het scherm voor een nieuwe inzet',
  subsidie: 'het scherm voor een nieuwe subsidie',
  levering: 'het scherm voor een nieuwe onderlinge levering',
};

/** Bijvoorbeeld: "de inzet, met het scherm voor een nieuwe inzet open". */
function bestemmingInWoorden(verwijzing: Verwijzing): string {
  const tab = verwijzing.tab ? TAB_LABEL[verwijzing.tab] : undefined;
  const opent = verwijzing.opent ? OPENT_LABEL[verwijzing.opent] : undefined;

  if (tab && opent) return `${tab}, met ${opent} open`;
  if (tab) return tab;
  if (opent) return opent;
  return 'de juiste pagina';
}

interface HandboekProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Alle onderwerpen plat, met hun hoofdstuk erbij — handig voor zoeken. */
const ALLE_ONDERWERPEN = HANDBOEK.flatMap((hoofdstuk) =>
  hoofdstuk.onderwerpen.map((onderwerp) => ({
    ...onderwerp,
    hoofdstukTitel: hoofdstuk.titel,
    hoofdstukEmoji: hoofdstuk.emoji,
  }))
);

type PlatOnderwerp = (typeof ALLE_ONDERWERPEN)[number];

/**
 * Zet **vetgedrukte** stukken om naar echte opmaak. Bewust minimaal: alleen vet,
 * want meer heeft de tekst niet nodig.
 */
function metOpmaak(tekst: string): React.ReactNode[] {
  return tekst.split(/(\*\*[^*]+\*\*)/g).map((deel, index) => {
    if (deel.startsWith('**') && deel.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold text-gray-900 dark:text-gray-100">
          {deel.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={index}>{deel}</React.Fragment>;
  });
}

const Handboek: React.FC<HandboekProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { entiteiten } = useApp();

  const [zoek, setZoek] = useState('');
  const [gekozenId, setGekozenId] = useState<string>(ALLE_ONDERWERPEN[0]?.id ?? '');
  const [toonDetailMobiel, setToonDetailMobiel] = useState(false);

  // Zodra een verwijzing een begroting nodig heeft die nog niet open staat,
  // wordt hij hier geparkeerd tot je er een gekozen hebt.
  const [wachtOpBegroting, setWachtOpBegroting] = useState<Verwijzing | null>(null);
  const [actieveBegrotingNaam, setActieveBegrotingNaam] = useState<string | null>(null);

  // Sluiten met Escape — een schermvullend paneel hoort dat te kunnen.
  useEffect(() => {
    if (!isOpen) return;

    const opToets = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', opToets);
    return () => document.removeEventListener('keydown', opToets);
  }, [isOpen, onClose]);

  // De naam van de begroting waar je nu in zit, zodat de knop kan tonen waar je
  // heen gaat in plaats van je blind ergens naartoe te sturen.
  useEffect(() => {
    if (!isOpen) return;

    const match = location.pathname.match(/^\/begrotingen\/([^/]+)$/);
    const budgetId = match?.[1];

    if (!budgetId || budgetId === 'nieuw') {
      setActieveBegrotingNaam(null);
      return;
    }

    let actief = true;
    haalBegroting(budgetId)
      .then((gevonden) => {
        if (actief) setActieveBegrotingNaam(gevonden?.naam ?? null);
      })
      .catch(() => {
        if (actief) setActieveBegrotingNaam(null);
      });

    return () => {
      actief = false;
    };
  }, [isOpen, location.pathname]);

  const gefilterd = useMemo<PlatOnderwerp[]>(() => {
    const term = zoek.trim().toLowerCase();
    if (!term) return ALLE_ONDERWERPEN;

    return ALLE_ONDERWERPEN.filter((onderwerp) =>
      [onderwerp.titel, onderwerp.kort, onderwerp.hoofdstukTitel, ...onderwerp.tekst]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [zoek]);

  const gekozen = useMemo<PlatOnderwerp | undefined>(
    () => gefilterd.find((item) => item.id === gekozenId) ?? gefilterd[0],
    [gefilterd, gekozenId]
  );

  if (!isOpen) return null;

  /** Het id van de begroting die nu open staat, of null. */
  const huidigeBegroting = (): string | null => {
    const match = location.pathname.match(/^\/begrotingen\/([^/]+)$/);
    const budgetId = match?.[1];
    return budgetId && budgetId !== 'nieuw' ? budgetId : null;
  };

  /** Bouwt het pad, met het tabblad en het te openen scherm erin. */
  const bouwPad = (verwijzing: Verwijzing, budgetId: string | null): string => {
    const pad = verwijzing.pad === 'begroting' ? `/begrotingen/${budgetId}` : verwijzing.pad;

    const params = new URLSearchParams();
    if (verwijzing.tab) params.set('tab', verwijzing.tab);
    if (verwijzing.opent) params.set('open', verwijzing.opent);

    const query = params.toString();
    return query ? `${pad}?${query}` : pad;
  };

  const volgVerwijzing = (verwijzing: Verwijzing) => {
    // Gaat de verwijzing naar een begroting, dan moeten we weten welke. Staat er
    // een open, dan is dat de logische keuze; anders vragen we het eerst, want
    // anders beland je op de lijst en ben je het tabblad kwijt.
    if (verwijzing.pad === 'begroting') {
      const budgetId = huidigeBegroting();

      if (!budgetId) {
        setWachtOpBegroting(verwijzing);
        return;
      }

      navigate(bouwPad(verwijzing, budgetId));
      onClose();
      return;
    }

    navigate(bouwPad(verwijzing, null));
    onClose();
  };

  const kiesBegroting = (budgetId: string) => {
    if (!wachtOpBegroting) return;

    navigate(bouwPad(wachtOpBegroting, budgetId));
    setWachtOpBegroting(null);
    onClose();
  };

  const kies = (id: string) => {
    setGekozenId(id);
    setToonDetailMobiel(true);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center">
      <div className="absolute inset-0 bg-gray-900/60 dark:bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-6xl m-0 sm:m-4 lg:m-8 bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Kop */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-primary-50/80 to-transparent dark:from-primary-900/20">
          <span className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary-500 text-white flex-shrink-0 shadow-glow-primary">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Handboek
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Alles wat de app doet, met een knop die je er direct heen brengt
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Handboek sluiten"
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 flex min-h-0 relative">
          {wachtOpBegroting && (
            <BegrotingKiezer
              bestemming={bestemmingInWoorden(wachtOpBegroting)}
              entiteiten={entiteiten}
              onKies={kiesBegroting}
              onAnnuleer={() => setWachtOpBegroting(null)}
            />
          )}

          {/* Lijst */}
          <div
            className={`w-full lg:w-80 xl:w-96 border-r border-gray-100 dark:border-gray-700 flex flex-col min-h-0 ${
              toonDetailMobiel ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="p-3 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                  aria-hidden
                />
                <input
                  type="search"
                  value={zoek}
                  onChange={(event) => setZoek(event.target.value)}
                  placeholder="Zoek in het handboek…"
                  aria-label="Zoek in het handboek"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 dark:text-gray-100 border border-transparent rounded-lg outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20 transition-all"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto p-2">
              {gefilterd.length === 0 && (
                <p className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                  Niets gevonden voor "{zoek}".
                </p>
              )}

              {HANDBOEK.map((hoofdstuk) => {
                const onderwerpen = gefilterd.filter((item) =>
                  hoofdstuk.onderwerpen.some((eigen) => eigen.id === item.id)
                );
                if (onderwerpen.length === 0) return null;

                return (
                  <div key={hoofdstuk.id} className="mb-3">
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="text-base leading-none" aria-hidden>
                        {hoofdstuk.emoji}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">
                        {hoofdstuk.titel}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {onderwerpen.map((onderwerp) => (
                        <button
                          key={onderwerp.id}
                          type="button"
                          onClick={() => kies(onderwerp.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                            gekozen?.id === onderwerp.id
                              ? 'bg-primary-50 dark:bg-primary-900/30'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <span
                            className={`block text-sm font-medium ${
                              gekozen?.id === onderwerp.id
                                ? 'text-primary-800 dark:text-primary-200'
                                : 'text-gray-800 dark:text-gray-200'
                            }`}
                          >
                            {onderwerp.titel}
                          </span>
                          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                            {onderwerp.kort}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Inhoud */}
          <div
            className={`flex-1 overflow-y-auto min-h-0 ${
              toonDetailMobiel ? 'block' : 'hidden lg:block'
            }`}
          >
            {gekozen ? (
              <article className="p-4 sm:p-8 max-w-3xl">
                <button
                  type="button"
                  onClick={() => setToonDetailMobiel(false)}
                  className="lg:hidden inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-4 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                  Alle onderwerpen
                </button>

                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-[0.1em] mb-2">
                  <span aria-hidden>{gekozen.hoofdstukEmoji}</span>
                  {gekozen.hoofdstukTitel}
                </span>

                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mb-5">
                  {gekozen.titel}
                </h3>

                <div className="space-y-3.5">
                  {gekozen.tekst.map((alinea, index) =>
                    alinea.startsWith('- ') ? (
                      <div key={index} className="flex gap-3 pl-1">
                        <span
                          className="mt-2 h-1.5 w-1.5 rounded-full bg-primary-400 flex-shrink-0"
                          aria-hidden
                        />
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {metOpmaak(alinea.slice(2))}
                        </p>
                      </div>
                    ) : (
                      <p
                        key={index}
                        className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"
                      >
                        {metOpmaak(alinea)}
                      </p>
                    )
                  )}
                </div>

                {gekozen.verwijzingen && gekozen.verwijzingen.length > 0 && (
                  <div className="mt-7 pt-6 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em] mb-3">
                      Direct erheen
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gekozen.verwijzingen.map((verwijzing) => (
                        <button
                          key={verwijzing.label}
                          type="button"
                          onClick={() => volgVerwijzing(verwijzing)}
                          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold shadow-glow-primary hover:shadow-glow-primary-lg transition-all"
                        >
                          {verwijzing.label}
                          <ArrowRight
                            className="h-4 w-4 group-hover:translate-x-0.5 transition-transform"
                            aria-hidden
                          />
                        </button>
                      ))}
                    </div>

                    {/* Gaat een knop naar een begroting, dan zie je hier welke —
                        en kun je een andere kiezen zonder eerst weg te navigeren. */}
                    {gekozen.verwijzingen.some((verwijzing) => verwijzing.pad === 'begroting') && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {actieveBegrotingNaam ? (
                          <>
                            Je gaat naar{' '}
                            <span className="font-semibold text-gray-700 dark:text-gray-200">
                              {actieveBegrotingNaam}
                            </span>
                            .{' '}
                          </>
                        ) : (
                          <>Er staat nog geen begroting open. </>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setWachtOpBegroting(
                              gekozen.verwijzingen?.find(
                                (verwijzing) => verwijzing.pad === 'begroting'
                              ) ?? null
                            )
                          }
                          className="font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 underline underline-offset-2 transition-colors"
                        >
                          {actieveBegrotingNaam ? 'Een andere kiezen' : 'Kies een begroting'}
                        </button>
                      </p>
                    )}
                  </div>
                )}
              </article>
            ) : (
              <div className="p-8 text-sm text-gray-500 dark:text-gray-400">
                Kies een onderwerp uit de lijst.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Handboek;
