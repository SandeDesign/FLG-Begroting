// src/utils/menuConfig.ts
// Eén bron voor de navigatie: sidebar, mobiel menu en de onderbalk.
// Er is één rol en één set pagina's, dus geen filters meer.

import {
  Building2,
  GitCompareArrows,
  LayoutDashboard,
  Network,
  Settings,
  Wallet,
} from 'lucide-react';

export interface NavigatieItem {
  id: string;
  naam: string;
  href: string;
  /** Alleen actief markeren bij een exacte match — nodig voor "/". */
  exact?: boolean;
  icoon: React.ComponentType<{ className?: string }>;
  emoji: string;
  /** Korte naam voor de onderbalk op mobiel. */
  kort: string;
}

export const NAVIGATIE: NavigatieItem[] = [
  {
    id: 'dashboard',
    naam: 'Dashboard',
    href: '/',
    exact: true,
    icoon: LayoutDashboard,
    emoji: '📊',
    kort: 'Start',
  },
  {
    id: 'keten',
    naam: 'Ketenoverzicht',
    href: '/keten',
    icoon: Network,
    emoji: '🔗',
    kort: 'Keten',
  },
  {
    id: 'begrotingen',
    naam: 'Begrotingen',
    href: '/begrotingen',
    icoon: Wallet,
    emoji: '💼',
    kort: 'Begroting',
  },
  {
    id: 'vergelijk',
    naam: 'Scenario vergelijken',
    href: '/vergelijk',
    icoon: GitCompareArrows,
    emoji: '⚖️',
    kort: 'Vergelijk',
  },
  {
    id: 'entiteiten',
    naam: 'Entiteiten',
    href: '/entiteiten',
    icoon: Building2,
    emoji: '🏢',
    kort: 'Entiteit',
  },
  {
    id: 'settings',
    naam: 'Instellingen',
    href: '/settings',
    icoon: Settings,
    emoji: '⚙️',
    kort: 'Instellingen',
  },
];

/** De vier items in de onderbalk op mobiel; de hamburger komt er als vijfde bij. */
export const ONDERBALK: NavigatieItem[] = NAVIGATIE.filter((item) =>
  ['dashboard', 'begrotingen', 'keten', 'entiteiten'].includes(item.id)
);
