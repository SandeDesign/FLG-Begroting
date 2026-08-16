// src/pages/Dashboard.tsx
// Resultaat per entiteit in één oogopslag
// Skelet — wordt gevuld zodra de rekenmotor is goedgekeurd.

import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { usePageTitle } from '../contexts/PageTitleContext';
import PageHeader from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import Card from '../components/ui/Card';

const Dashboard: React.FC = () => {
  usePageTitle('Dashboard');

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Resultaat per entiteit in één oogopslag" emoji="📊" />
      <Card>
        <EmptyState
          icon={LayoutDashboard}
          title="Nog in aanbouw"
          description="Deze pagina wordt gebouwd zodra de rekenmotor is nagerekend en goedgekeurd."
        />
      </Card>
    </div>
  );
};

export default Dashboard;
