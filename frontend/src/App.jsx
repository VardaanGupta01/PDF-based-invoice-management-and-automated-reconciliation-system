import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/dashboard/Dashboard';
import Auth from './pages/Auth';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitePage from './pages/AcceptInvitePage';
import ProtectedRoute from './components/ProtectedRoute'; // Import the guard
import useAuthStore from './store/useAuthStore';
import { DashboardPage } from './pages/dashboard/pages/DashboardPage';
import { LedgerCollectionPage } from './pages/dashboard/pages/LedgerCollectionPage';
import { BankStatementsPage } from './pages/dashboard/pages/BankStatementsPage';
import { ReconciliationsPage } from './pages/dashboard/pages/ReconciliationsPage';
import { SettingsPage } from './pages/dashboard/pages/SettingsPage';
import { LedgerDetails } from './pages/dashboard/pages/components/LedgerDetails';
import { StatementGroupDetails } from "./pages/dashboard/pages/components/StatementGroupDetails";
import { ReconciliationDetails } from './pages/dashboard/pages/components/ReconciliationDetails';


function App() {

  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Check token validity whenever the app loads or tab is refreshed
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);


  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardPage />} />

            <Route path="ledger-collection"  >
              <Route index element={<LedgerCollectionPage />} />
              <Route path=":id" element={<LedgerDetails />} />
            </Route>

            <Route path="bank-statements"  >
              <Route index element={<BankStatementsPage />} />
              <Route path=":id" element={<StatementGroupDetails />} />
            </Route>

            <Route path="reconciliations"  >
              <Route index element={<ReconciliationsPage />} />
              <Route path=":id" element={<ReconciliationDetails />} />
            </Route>

            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
