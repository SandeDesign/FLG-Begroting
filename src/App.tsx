// src/App.tsx
// Routes en providers. Eén rol, dus geen rolafhankelijke routeblokken meer.

import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { BegrotingsdataProvider } from './contexts/BegrotingsdataContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppUpdateModal from './components/AppUpdateModal';
import Layout from './components/layout/Layout';

import { LoadingSpinner } from './components/ui/LoadingSpinner';

import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';

// De pagina's achter de login worden pas opgehaald als je ze opent. Zo hoeft de
// browser bij het starten niet de hele app binnen te halen — op een mobiele
// verbinding scheelt dat direct in hoe snel het eerste scherm staat.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ketenoverzicht = lazy(() => import('./pages/Ketenoverzicht'));
const Entiteiten = lazy(() => import('./pages/Entiteiten'));
const VasteLasten = lazy(() => import('./pages/VasteLasten'));
const Begrotingen = lazy(() => import('./pages/Begrotingen'));
const BegrotingNieuw = lazy(() => import('./pages/BegrotingNieuw'));
const BegrotingWerkblad = lazy(() => import('./pages/BegrotingWerkblad'));
const ScenarioVergelijk = lazy(() => import('./pages/ScenarioVergelijk'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Wikkelt een pagina in de login-poort en het vaste frame. */
const MetLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <Layout>
      <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>
    </Layout>
  </ProtectedRoute>
);

/** Luistert naar het swUpdateAvailable-event dat index.html afvuurt. */
const UpdateMelding: React.FC = () => {
  const [registratie, setRegistratie] = useState<ServiceWorkerRegistration | null>(null);
  const [zichtbaar, setZichtbaar] = useState(false);

  useEffect(() => {
    const opUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ reg: ServiceWorkerRegistration }>).detail;
      setRegistratie(detail?.reg ?? null);
      setZichtbaar(true);
    };

    window.addEventListener('swUpdateAvailable', opUpdate);
    return () => window.removeEventListener('swUpdateAvailable', opUpdate);
  }, []);

  if (!zichtbaar) return null;

  return <AppUpdateModal registratie={registratie} onSluiten={() => setZichtbaar(false)} />;
};

const App: React.FC = () => (
  <DarkModeProvider>
    <AuthProvider>
      <AppProvider>
        <BegrotingsdataProvider>
          <PageTitleProvider>
            <BrowserRouter>
              <UpdateMelding />
              <Routes>
                {/* Openbaar */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Achter de login */}
                <Route
                  path="/"
                  element={
                    <MetLayout>
                      <Dashboard />
                    </MetLayout>
                  }
                />
                <Route
                  path="/keten"
                  element={
                    <MetLayout>
                      <Ketenoverzicht />
                    </MetLayout>
                  }
                />
                <Route
                  path="/entiteiten"
                  element={
                    <MetLayout>
                      <Entiteiten />
                    </MetLayout>
                  }
                />
                <Route
                  path="/entiteiten/:entityId/vaste-lasten"
                  element={
                    <MetLayout>
                      <VasteLasten />
                    </MetLayout>
                  }
                />
                <Route
                  path="/begrotingen"
                  element={
                    <MetLayout>
                      <Begrotingen />
                    </MetLayout>
                  }
                />
                <Route
                  path="/begrotingen/nieuw"
                  element={
                    <MetLayout>
                      <BegrotingNieuw />
                    </MetLayout>
                  }
                />
                <Route
                  path="/begrotingen/:budgetId"
                  element={
                    <MetLayout>
                      <BegrotingWerkblad />
                    </MetLayout>
                  }
                />
                <Route
                  path="/vergelijk"
                  element={
                    <MetLayout>
                      <ScenarioVergelijk />
                    </MetLayout>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <MetLayout>
                      <Settings />
                    </MetLayout>
                  }
                />

                <Route
                  path="*"
                  element={
                    <Suspense fallback={<LoadingSpinner />}>
                      <NotFound />
                    </Suspense>
                  }
                />
              </Routes>
            </BrowserRouter>
          </PageTitleProvider>
        </BegrotingsdataProvider>
      </AppProvider>
    </AuthProvider>
  </DarkModeProvider>
);

export default App;
