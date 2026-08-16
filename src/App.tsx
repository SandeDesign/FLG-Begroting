// src/App.tsx
// Routes en providers. Eén rol, dus geen rolafhankelijke routeblokken meer.

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AppProvider } from './contexts/AppContext';
import { DarkModeProvider } from './contexts/DarkModeContext';
import { PageTitleProvider } from './contexts/PageTitleContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import AppUpdateModal from './components/AppUpdateModal';
import Layout from './components/layout/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Ketenoverzicht from './pages/Ketenoverzicht';
import Entiteiten from './pages/Entiteiten';
import VasteLasten from './pages/VasteLasten';
import Begrotingen from './pages/Begrotingen';
import BegrotingNieuw from './pages/BegrotingNieuw';
import BegrotingWerkblad from './pages/BegrotingWerkblad';
import ScenarioVergelijk from './pages/ScenarioVergelijk';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

/** Wikkelt een pagina in de login-poort en het vaste frame. */
const MetLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
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

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </PageTitleProvider>
      </AppProvider>
    </AuthProvider>
  </DarkModeProvider>
);

export default App;
