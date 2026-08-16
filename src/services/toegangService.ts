// src/services/toegangService.ts
// Toegangsbeheer. Wie erbij mag staat in settings/access, in het veld
// allowedUids. Iedereen op die lijst is gelijk: alles inzien, alles wijzigen.
//
// Accounts worden vanuit de app aangemaakt. Dat gebeurt via een tweede Firebase-
// verbinding, zodat je eigen sessie blijft staan — meldt de gewone client een
// nieuwe gebruiker aan, dan word je namelijk zelf uitgelogd en als die nieuwe
// gebruiker ingelogd.

import { initializeApp, deleteApp, getApp, type FirebaseApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTIE = 'settings';
const DOCUMENT = 'access';

/** De stand van zaken rond toegang, inclusief het geval dat er nog niets staat. */
export interface Toegangsstatus {
  /** Bestaat het document settings/access al? */
  ingericht: boolean;
  /** Staat deze gebruiker op de lijst? */
  toegestaan: boolean;
  allowedUids: string[];
}

function toegangDoc() {
  return doc(db, COLLECTIE, DOCUMENT);
}

/** De lijst zelf, los van de vraag wie er kijkt. Leeg als er nog niets staat. */
export async function haalToegestaneUids(): Promise<string[]> {
  const snapshot = await getDoc(toegangDoc());
  if (!snapshot.exists()) return [];

  const ruw = snapshot.data().allowedUids;
  return Array.isArray(ruw) ? ruw.filter((item): item is string => typeof item === 'string') : [];
}

/** Leest de whitelist en bepaalt of deze gebruiker erbij mag. */
export async function haalToegangsstatus(uid: string): Promise<Toegangsstatus> {
  const snapshot = await getDoc(toegangDoc());

  if (!snapshot.exists()) {
    return { ingericht: false, toegestaan: false, allowedUids: [] };
  }

  const ruw = snapshot.data().allowedUids;
  const allowedUids = Array.isArray(ruw) ? ruw.filter((item): item is string => typeof item === 'string') : [];

  return { ingericht: true, toegestaan: allowedUids.includes(uid), allowedUids };
}

/** Alleen de vraag of iemand erbij mag. */
export async function heeftToegang(uid: string): Promise<boolean> {
  return (await haalToegangsstatus(uid)).toegestaan;
}

/**
 * Richt de toegang voor het eerst in: de huidige gebruiker zet zichzelf op de
 * lijst. Dit kan maar één keer — daarna staat het document er en laten de rules
 * alleen nog wijzigingen toe door wie al op de lijst staat.
 */
export async function claimToegang(uid: string): Promise<void> {
  await setDoc(toegangDoc(), { allowedUids: [uid] });
}

/** Vervangt de volledige lijst met toegestane uid's. */
export async function bewaarToegestaneUids(allowedUids: string[]): Promise<void> {
  const uniek = Array.from(new Set(allowedUids.map((uid) => uid.trim()).filter(Boolean)));

  if (uniek.length === 0) {
    throw new Error('De lijst mag niet leeg zijn — dan kan niemand er meer bij.');
  }

  await setDoc(toegangDoc(), { allowedUids: uniek });
}

/** Voegt een uid toe aan de lijst. Stond hij er al op, dan verandert er niets. */
export async function voegUidToe(uid: string): Promise<void> {
  const huidige = await haalToegestaneUids();
  if (huidige.includes(uid)) return;
  await bewaarToegestaneUids([...huidige, uid]);
}

/**
 * Haalt een uid van de lijst. Jezelf verwijderen kan niet: dan zou je jezelf
 * buitensluiten en dat is alleen nog in de Firebase console terug te draaien.
 */
export async function verwijderUid(uid: string, eigenUid: string): Promise<void> {
  if (uid === eigenUid) {
    throw new Error('Je kunt jezelf niet van de lijst halen.');
  }

  const huidige = await haalToegestaneUids();
  await bewaarToegestaneUids(huidige.filter((item) => item !== uid));
}

// ─── Account aanmaken ───────────────────────────────────────────────────────

const TWEEDE_APP = 'account-aanmaken';

/**
 * Een tweede verbinding met hetzelfde Firebase-project. Nodig om een account aan
 * te maken zonder je eigen sessie kwijt te raken.
 */
function tweedeApp(): FirebaseApp {
  const hoofdApp = getApp();

  try {
    return getApp(TWEEDE_APP);
  } catch {
    return initializeApp(hoofdApp.options, TWEEDE_APP);
  }
}

/** Vertaalt een Firebase-foutcode naar een leesbare melding. */
function foutmelding(fout: unknown): string {
  const code = typeof fout === 'object' && fout !== null && 'code' in fout ? String(fout.code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Er bestaat al een account met dit e-mailadres. Voeg de uid handmatig toe als je die persoon toegang wilt geven.';
    case 'auth/invalid-email':
      return 'Ongeldig e-mailadres';
    case 'auth/weak-password':
      return 'Het wachtwoord is te kort. Gebruik minimaal zes tekens.';
    case 'auth/operation-not-allowed':
      return 'E-mail en wachtwoord staan niet aan in Firebase. Zet ze aan onder Authentication → Sign-in method.';
    default:
      return 'Het account kon niet aangemaakt worden.';
  }
}

/**
 * Maakt een account aan en zet het meteen op de lijst met toegestane gebruikers.
 * Geeft de nieuwe uid terug.
 */
export async function maakAccount(
  email: string,
  wachtwoord: string,
  weergavenaam: string
): Promise<string> {
  const app = tweedeApp();
  const tweedeAuth = getAuth(app);

  try {
    const { user } = await createUserWithEmailAndPassword(tweedeAuth, email.trim(), wachtwoord);

    if (weergavenaam.trim()) {
      await updateProfile(user, { displayName: weergavenaam.trim() });
    }

    const nieuweUid = user.uid;

    // De tweede verbinding meteen weer opruimen; hij heeft zijn werk gedaan.
    await tweedeAuth.signOut();
    await deleteApp(app);

    await voegUidToe(nieuweUid);
    return nieuweUid;
  } catch (fout) {
    try {
      await deleteApp(app);
    } catch {
      // De verbinding was al opgeruimd; niets aan de hand.
    }
    throw new Error(foutmelding(fout));
  }
}
