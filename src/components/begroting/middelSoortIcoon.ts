// src/components/begroting/middelSoortIcoon.ts
// Het icoon per soort middel. Staat los van de types, want daar horen geen
// React-componenten thuis; wordt gebruikt in de modal én in de lijst, zodat je
// in één oogopslag ziet waar een kostenregel over gaat.

import type React from 'react';
import { HardHat, Laptop, Package, Truck, Wrench } from 'lucide-react';
import type { MiddelSoort } from '../../types/begroting';

export const MIDDEL_SOORT_ICOON: Record<
  MiddelSoort,
  React.ComponentType<{ className?: string }>
> = {
  voertuig: Truck,
  materieel: HardHat,
  gereedschap: Wrench,
  ict: Laptop,
  overig: Package,
};
