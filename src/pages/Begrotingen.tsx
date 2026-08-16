// src/pages/Begrotingen.tsx
// Alle begrotingen en scenario's
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { Wallet } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const Begrotingen: React.FC = () => {
  usePageTitle('Begrotingen');

  return (
    <div className="space-y-4">
      <PageHeader title="Begrotingen" subtitle="Alle begrotingen en scenario's" emoji="💼" />
      <Card>
        <EmptyState
          icon={Wallet}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default Begrotingen;
