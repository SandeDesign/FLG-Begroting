// src/services/toegangService.ts
// Toegangscontrole. Er zijn twee accounts en verder niemand. De harde grens ligt
// in de Firestore rules; deze service leest dezelfde whitelist zodat de app een
// nette melding kan tonen in plaats van overal leesfouten te laten opduiken.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const TOEGANG_PAD = { collectie: 'settings', document: 'access' };

/**
 * Controleert of een uid op de whitelist in settings/access staat.
 * Bestaat het document niet, dan is er nog niets ingericht en heeft niemand toegang.
 */
export async function heeftToegang(uid: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, TOEGANG_PAD.collectie, TOEGANG_PAD.document));
  if (!snapshot.exists()) return false;

  const allowedUids = snapshot.data().allowedUids;
  if (!Array.isArray(allowedUids)) return false;

  return allowedUids.includes(uid);
}
