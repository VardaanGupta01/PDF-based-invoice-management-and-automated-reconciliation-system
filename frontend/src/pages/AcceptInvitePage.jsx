import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import { apiUrl } from '../utils/api';
import './AcceptInvitePage.css';

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"></line>
    <line x1="12" y1="20" x2="12" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="14"></line>
  </svg>
);

const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const AlertCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const authToken = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const setLastActiveBusinessId = useAuthStore((state) => state.setLastActiveBusinessId);

  const [isLoading, setIsLoading] = useState(true);
  const [inviteData, setInviteData] = useState(null);
  const [errorState, setErrorState] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    if (!token) {
      setErrorState({
        title: 'Missing Invitation Token',
        message: 'No invitation token was provided. Please check the invitation link you received.'
      });
      setIsLoading(false);
      return;
    }

    const fetchInviteDetails = async () => {
      try {
        const res = await fetch(apiUrl(`/team/invite-details/${token}`));
        const data = await res.json();

        if (!res.ok || !data.valid) {
          if (data.reason === 'already_accepted') {
            setErrorState({
              type: 'accepted',
              title: 'Invitation Already Accepted',
              message: `This invitation to join "${data.businessName || 'the business'}" has already been accepted.`
            });
          } else if (data.reason === 'expired') {
            setErrorState({
              type: 'expired',
              title: 'Invitation Expired',
              message: `This invitation to join "${data.businessName || 'the business'}" has expired. Please ask the business owner to resend it.`
            });
          } else if (data.reason === 'revoked') {
            setErrorState({
              type: 'revoked',
              title: 'Invitation Revoked',
              message: `This invitation to join "${data.businessName || 'the business'}" has been revoked.`
            });
          } else {
            setErrorState({
              type: 'invalid',
              title: 'Invalid Invitation',
              message: data.message || 'This invitation token is invalid or does not exist.'
            });
          }
        } else {
          setInviteData(data);
        }
      } catch (err) {
        console.error('Error fetching invitation details:', err);
        setErrorState({
          type: 'error',
          title: 'Unable to Load Invitation',
          message: 'Could not communicate with the server. Please check your network connection.'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInviteDetails();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!authToken || !token) return;
    setIsAccepting(true);
    try {
      const res = await fetch(apiUrl('/team/accept-invite'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ token: token ? token.trim() : '', inviteId: inviteData?.id })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAcceptSuccess(true);
        setSuccessData(data);

        // Update active business in store
        await setLastActiveBusinessId(data.businessId, data.businessName);

        // Auto-navigate to dashboard after 2.5 seconds
        setTimeout(() => {
          navigate('/dashboard');
        }, 2500);
      } else {
        setErrorState({
          type: 'accept_error',
          title: 'Failed to Accept Invitation',
          message: data.message || 'Could not accept invitation. Please try again.'
        });
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      setErrorState({
        type: 'accept_error',
        title: 'Error Accepting Invitation',
        message: 'A network error occurred while accepting the invitation.'
      });
    } finally {
      setIsAccepting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    const loginUrl = `/auth?mode=login&email=${encodeURIComponent(inviteData?.email || '')}&redirect=${encodeURIComponent('/accept-invite?token=' + token)}`;
    navigate(loginUrl);
  };

  const isEmailMatching = Boolean(
    isAuthenticated &&
    user?.email &&
    inviteData?.email &&
    user.email.toLowerCase() === inviteData.email.toLowerCase()
  );

  return (
    <div className="accept-invite-container">
      <Link to="/" className="brand-back">
        <div className="brand-icon-wrapper">
          <BarChartIcon />
        </div>
        ReconFlow
      </Link>

      <div className="accept-invite-card">
        {isLoading ? (
          <div className="invite-loading-state">
            <div className="invite-spinner"></div>
            <h3>Verifying your invitation...</h3>
            <p>Please wait a moment while we locate your team details.</p>
          </div>
        ) : acceptSuccess ? (
          <div className="invite-result-state success">
            <CheckCircleIcon />
            <h2>Welcome to {successData?.businessName || 'the Team'}!</h2>
            <p>
              You have successfully joined as a{' '}
              <strong>{successData?.role === 'accountant' ? 'Accountant (Manager)' : 'Viewer (Read-Only)'}</strong>.
            </p>
            <div className="invite-success-banner">
              Redirecting you to your dashboard...
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-invite-action"
              style={{ marginTop: '1.5rem' }}
            >
              Go to Dashboard Now →
            </button>
          </div>
        ) : errorState ? (
          <div className="invite-result-state error">
            <AlertCircleIcon />
            <h2>{errorState.title}</h2>
            <p>{errorState.message}</p>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <Link to="/dashboard" className="btn-invite-secondary">
                Go to Dashboard
              </Link>
              <Link to="/" className="btn-invite-action">
                Return Home
              </Link>
            </div>
          </div>
        ) : inviteData ? (
          <div className="invite-content">
            <div className="invite-header">
              <span className="invite-badge">Team Invitation</span>
              <h2>You've been invited to join</h2>
              <h1 className="invite-business-title">{inviteData.businessName}</h1>
              <p className="invite-inviter-note">
                Invited by <strong>{inviteData.inviterName || 'A team manager'}</strong>
              </p>
            </div>

            <div className="invite-meta-box">
              <div className="meta-row">
                <span className="meta-label">Invited Role</span>
                <span className={`role-tag role-${inviteData.role}`}>
                  {inviteData.role === 'accountant' ? 'Accountant · Manager' : 'Viewer · Read-Only'}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Assigned Account</span>
                <span className="meta-value">{inviteData.email}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Permissions</span>
                <span className="meta-sub">
                  {inviteData.role === 'accountant'
                    ? 'Upload statements, run reconciliations, invite viewers.'
                    : 'View reconciliation matches, search statements, and export reports.'}
                </span>
              </div>
            </div>

            {/* Authenticated with matching account */}
            {isEmailMatching && (
              <div className="invite-actions-block">
                <div className="account-indicator matching">
                  Signed in as <strong>{user?.email}</strong> ✓
                </div>
                <button
                  onClick={handleAcceptInvite}
                  disabled={isAccepting}
                  className="btn-invite-action"
                >
                  {isAccepting ? 'Joining Team...' : 'Accept Invitation & Join Business'}
                </button>
              </div>
            )}

            {/* Authenticated with WRONG account */}
            {isAuthenticated && !isEmailMatching && (
              <div className="invite-actions-block">
                <div className="account-indicator mismatch">
                  You are signed in as <strong>{user?.email}</strong>.<br />
                  This invitation was sent specifically to <strong>{inviteData.email}</strong>.
                </div>
                <button
                  onClick={handleSwitchAccount}
                  className="btn-invite-action"
                >
                  Switch to {inviteData.email} →
                </button>
              </div>
            )}

            {/* Unauthenticated */}
            {!isAuthenticated && (
              <div className="invite-actions-block">
                <p className="invite-prompt-text">
                  To accept this invitation, please log in or create an account with <strong>{inviteData.email}</strong>.
                </p>
                <div className="invite-btn-group">
                  <Link
                    to={`/auth?mode=login&email=${encodeURIComponent(inviteData.email)}&redirect=${encodeURIComponent('/accept-invite?token=' + token)}`}
                    className="btn-invite-action"
                  >
                    Log In to Accept
                  </Link>
                  <Link
                    to={`/auth?mode=signup&email=${encodeURIComponent(inviteData.email)}&redirect=${encodeURIComponent('/accept-invite?token=' + token)}`}
                    className="btn-invite-secondary"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AcceptInvitePage;
