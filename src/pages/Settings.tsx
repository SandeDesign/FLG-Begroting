// src/pages/Settings.tsx
// Instellingen: profiel, themakleur, donkere modus, wie er toegang heeft en de
// voorbeelddata.

import React, { useCallback, useEffect, useState } from 'react';
import { Moon, Palette, ShieldCheck, Sparkles, Sun, Trash2, UserPlus } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import PageHeader from '../components/ui/PageHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { applyThemeColor, THEME_COLOR_PRESETS } from '../utils/themeColors';
import { laadVoorbeelddata, wisAlleData } from '../services/seedService';
import {
  haalToegestaneUids,
  maakAccount,
  verwijderUid,
  voegUidToe,
} from '../services/toegangService';

const OPSLAG_THEMA = 'flg.themakleur';

const Settings: React.FC = () => {
  usePageTitle('Instellingen');
  const { user, herlaadToegang } = useAuth();
  const { herlaadEntiteiten } = useApp();

  const [thema, setThema] = useState('blue');
  const [donker, setDonker] = useState(false);

  const [uids, setUids] = useState<string[]>([]);
  const [uidsLaden, setUidsLaden] = useState(true);

  const [nieuwEmail, setNieuwEmail] = useState('');
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState('');
  const [nieuwNaam, setNieuwNaam] = useState('');
  const [handmatigeUid, setHandmatigeUid] = useState('');

  const [accountBezig, setAccountBezig] = useState(false);
  const [accountFout, setAccountFout] = useState<string | null>(null);
  const [accountMelding, setAccountMelding] = useState<string | null>(null);

  const [seedBezig, setSeedBezig] = useState(false);
  const [wisBezig, setWisBezig] = useState(false);
  const [seedMelding, setSeedMelding] = useState<string | null>(null);

  // Thema en donkere modus staan in localStorage; met twee accounts op eigen
  // apparaten is dat genoeg en scheelt het een Firestore-lees bij elke start.
  useEffect(() => {
    setThema(localStorage.getItem(OPSLAG_THEMA) ?? 'blue');
    setDonker(document.documentElement.classList.contains('dark'));
  }, []);

  const laadUids = useCallback(async () => {
    setUidsLaden(true);
    try {
      setUids(await haalToegestaneUids());
    } catch {
      setAccountFout('De lijst met gebruikers kon niet geladen worden.');
    } finally {
      setUidsLaden(false);
    }
  }, []);

  useEffect(() => {
    void laadUids();
  }, [laadUids]);

  const kiesThema = (naam: string) => {
    setThema(naam);
    localStorage.setItem(OPSLAG_THEMA, naam);
    applyThemeColor(naam);
  };

  const wisselDonker = () => {
    const nieuw = !donker;
    setDonker(nieuw);
    document.documentElement.classList.toggle('dark', nieuw);
    localStorage.setItem('flg.donkereModus', String(nieuw));
  };

  const maakNieuwAccount = async () => {
    setAccountFout(null);
    setAccountMelding(null);

    if (!nieuwEmail.trim()) {
      setAccountFout('Vul een e-mailadres in.');
      return;
    }
    if (nieuwWachtwoord.length < 6) {
      setAccountFout('Gebruik een wachtwoord van minimaal zes tekens.');
      return;
    }

    setAccountBezig(true);

    try {
      await maakAccount(nieuwEmail, nieuwWachtwoord, nieuwNaam);
      setNieuwEmail('');
      setNieuwWachtwoord('');
      setNieuwNaam('');
      await laadUids();
      setAccountMelding('Het account is aangemaakt en heeft meteen toegang.');
    } catch (fout) {
      setAccountFout(fout instanceof Error ? fout.message : 'Account aanmaken mislukt.');
    } finally {
      setAccountBezig(false);
    }
  };

  const voegHandmatigToe = async () => {
    setAccountFout(null);
    setAccountMelding(null);

    const uid = handmatigeUid.trim();
    if (!uid) {
      setAccountFout('Vul een uid in.');
      return;
    }

    setAccountBezig(true);

    try {
      await voegUidToe(uid);
      setHandmatigeUid('');
      await laadUids();
      await herlaadToegang();
      setAccountMelding('De uid staat nu op de lijst.');
    } catch (fout) {
      setAccountFout(fout instanceof Error ? fout.message : 'Toevoegen mislukt.');
    } finally {
      setAccountBezig(false);
    }
  };

  const haalVanLijst = async (uid: string) => {
    if (!user) return;
    if (!window.confirm('Deze gebruiker de toegang ontnemen?')) return;

    setAccountFout(null);
    setAccountMelding(null);

    try {
      await verwijderUid(uid, user.uid);
      await laadUids();
      setAccountMelding('De gebruiker is van de lijst gehaald.');
    } catch (fout) {
      setAccountFout(fout instanceof Error ? fout.message : 'Verwijderen mislukt.');
    }
  };

  const laadSeed = async () => {
    const bevestigd = window.confirm(
      'De voorbeelddata toevoegen? Dit lukt alleen als de app nog leeg is — anders komt alles dubbel te staan.'
    );
    if (!bevestigd) return;

    setSeedBezig(true);
    setSeedMelding(null);

    try {
      const resultaat = await laadVoorbeelddata(user?.uid ?? '');
      await herlaadEntiteiten();
      setSeedMelding(
        `${resultaat.entiteiten} entiteiten en ${resultaat.begrotingen} begrotingen toegevoegd.`
      );
    } catch (fout) {
      setSeedMelding(
        fout instanceof Error ? fout.message : 'De voorbeelddata konden niet geladen worden.'
      );
    } finally {
      setSeedBezig(false);
    }
  };

  const wisAlles = async () => {
    const bevestigd = window.confirm(
      'Alle entiteiten en alle begrotingen verwijderen? Dit kan niet ongedaan gemaakt worden.'
    );
    if (!bevestigd) return;

    setWisBezig(true);
    setSeedMelding(null);

    try {
      const resultaat = await wisAlleData();
      await herlaadEntiteiten();
      setSeedMelding(
        `${resultaat.entiteiten} entiteiten en ${resultaat.begrotingen} begrotingen verwijderd.`
      );
    } catch {
      setSeedMelding('Wissen mislukt. Probeer het opnieuw.');
    } finally {
      setWisBezig(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <PageHeader title="Instellingen" subtitle="Profiel, weergave en toegang" emoji="⚙️" />

      {/* Profiel */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight mb-3">
          Ingelogd als
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Naam</dt>
            <dd className="text-gray-900 dark:text-gray-100">
              {user?.displayName || 'Niet ingevuld'}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">E-mailadres</dt>
            <dd className="text-gray-900 dark:text-gray-100">{user?.email}</dd>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Uid</dt>
            <dd className="text-gray-500 dark:text-gray-400 font-mono text-xs break-all">
              {user?.uid}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Weergave */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Weergave
          </h3>
        </div>

        <span className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          Themakleur
        </span>
        <div className="flex flex-wrap gap-2 mb-5">
          {THEME_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => kiesThema(preset.id)}
              title={preset.name}
              aria-label={`Themakleur ${preset.name}`}
              aria-pressed={thema === preset.id}
              className={`h-9 w-9 rounded-full transition-all ${
                thema === preset.id
                  ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: preset.primaryHex }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={wisselDonker}
          className="flex items-center gap-3 w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors text-left"
        >
          {donker ? (
            <Moon className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
          ) : (
            <Sun className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden />
          )}
          <span className="flex-1">
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
              Donkere modus
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {donker ? 'Staat aan' : 'Staat uit'}
            </span>
          </span>
        </button>
      </Card>

      {/* Toegang */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Wie heeft toegang
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Iedereen op deze lijst kan alles inzien en wijzigen. Er is geen onderscheid in rechten.
        </p>

        {accountFout && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-200">
            {accountFout}
          </div>
        )}
        {accountMelding && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-sm text-emerald-800 dark:text-emerald-200">
            {accountMelding}
          </div>
        )}

        {/* Huidige lijst */}
        <div className="space-y-2 mb-6">
          {uidsLaden ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Bezig met laden…</p>
          ) : uids.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Er staat nog niemand op de lijst.
            </p>
          ) : (
            uids.map((uid) => (
              <div
                key={uid}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
              >
                <span className="flex-1 min-w-0">
                  <span className="block font-mono text-xs text-gray-700 dark:text-gray-200 break-all">
                    {uid}
                  </span>
                  {uid === user?.uid && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      dat ben jij
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => void haalVanLijst(uid)}
                  disabled={uid === user?.uid}
                  aria-label="Toegang intrekken"
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Nieuw account */}
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Nieuw account aanmaken
            </h4>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Het account krijgt meteen toegang. Je blijft zelf gewoon ingelogd.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Naam"
              placeholder="Optioneel"
              value={nieuwNaam}
              onChange={(event) => setNieuwNaam(event.target.value)}
            />
            <Input
              label="E-mailadres"
              type="email"
              autoComplete="off"
              value={nieuwEmail}
              onChange={(event) => setNieuwEmail(event.target.value)}
            />
            <Input
              label="Wachtwoord"
              type="password"
              autoComplete="new-password"
              helperText="Minimaal zes tekens"
              value={nieuwWachtwoord}
              onChange={(event) => setNieuwWachtwoord(event.target.value)}
            />
          </div>

          <Button onClick={() => void maakNieuwAccount()} loading={accountBezig}>
            Account aanmaken
          </Button>
        </div>

        {/* Bestaande uid toevoegen */}
        <div className="mt-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Bestaand account toevoegen
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Heeft iemand zich al via /register aangemeld, plak dan de uid die op zijn scherm staat.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[240px]">
              <Input
                label="Uid"
                placeholder="bijvoorbeeld A1b2C3d4E5f6G7h8I9j0"
                value={handmatigeUid}
                onChange={(event) => setHandmatigeUid(event.target.value)}
              />
            </div>
            <Button variant="outline" onClick={() => void voegHandmatigToe()} loading={accountBezig}>
              Toevoegen
            </Button>
          </div>
        </div>
      </Card>

      {/* Voorbeelddata */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary-600 dark:text-primary-400" aria-hidden />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
            Voorbeelddata
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Zet Buddy BV, De Installatie BV en Smart Transport BV neer met bijbehorende
          begrotingen. Handig om mee te beginnen; alle bedragen pas je daarna zelf aan.
        </p>

        {seedMelding && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200">
            {seedMelding}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void laadSeed()} loading={seedBezig}>
            Voorbeelddata laden
          </Button>
          <Button variant="danger" onClick={() => void wisAlles()} loading={wisBezig}>
            Alles wissen
          </Button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          "Alles wissen" haalt alle entiteiten en alle begrotingen weg, ook begrotingen
          waarvan de entiteit al verwijderd was. Daarna kun je de voorbeelddata opnieuw
          laden.
        </p>
      </Card>
    </div>
  );
};

export default Settings;
