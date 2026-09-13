import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import './Dashboard.css';
import { CreateLedgerModal } from './pages/components/CreateLedgerModal';
import useAuthStore from '../../store/useAuthStore';
import { apiUrl } from '../../utils/api';

const UploadCloudIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
);

const titles = {
  "Dashboard": "Overview",
  "LedgerCollection": "Ledgers",
  "BankStatements": "Bank Statements",
  "Reconciliations": "Reconciliations",
  "Settings": "Settings",
}

function Dashboard() {
  const location = useLocation();
  const path = location.pathname;
  const token = useAuthStore(state => state.token);

  let currentPage = "Dashboard";
  if (path.includes("ledger-collection")) currentPage = "LedgerCollection";
  else if (path.includes("bank-statements")) currentPage = "BankStatements";
  else if (path.includes("reconciliations")) currentPage = "Reconciliations";
  else if (path.includes("settings")) currentPage = "Settings";

  const [showCreateModalOverlay, setShowCreateModalOverlay] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    const checkInvitations = async () => {
      try {
        const res = await fetch(apiUrl('/team/my-invitations'), {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPendingInviteCount((data.invitations || []).length);
        }
      } catch (err) {
        console.error('Failed to check incoming invitations:', err);
      }
    };
    checkInvitations();
  }, [token, location.pathname]);

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <Sidebar pendingInviteCount={pendingInviteCount} />

      {/* Main Content Area */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <h2>{titles[currentPage]}</h2>
          </div>

          <div className="topbar-right" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {
              currentPage === "Dashboard" || currentPage === "Settings" ? null :
                <Link className="btn-upload-primary" onClick={() => {
                  setShowCreateModalOverlay(true);
                }}>
                  <UploadCloudIcon />
                  {
                    currentPage === "LedgerCollection" ?
                      <>Create New Ledger</> :
                      currentPage === "BankStatements" ?
                        <>Create New Statement Group</> :
                        currentPage === "Reconciliations" ?
                          <>Create New Reconciliation Group</> :
                          null
                  }
                </Link>
            }
          </div>
        </header>

        {pendingInviteCount > 0 && currentPage !== "Settings" && (
          <div style={{
            background: '#eff6ff',
            borderBottom: '1px solid #bfdbfe',
            padding: '0.65rem 1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.875rem',
            color: '#1e40af'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.1rem' }}>📬</span>
              <span>You have <strong>{pendingInviteCount}</strong> pending business invitation{pendingInviteCount > 1 ? 's' : ''}!</span>
            </div>
            <Link to="./settings" style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.8rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
              View & Accept
            </Link>
          </div>
        )}

        <div className="page-body">
          <Outlet context={{showCreateModalOverlay, setShowCreateModalOverlay}} />
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
