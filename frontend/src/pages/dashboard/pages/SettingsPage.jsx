import React, { useState, useEffect } from 'react';
import './SettingsPage.css';
import useAuthStore from "./../../../store/useAuthStore";
import { apiUrl } from '../../../utils/api';

export function SettingsPage() {
    const user = useAuthStore(state => state.user);
    const token = useAuthStore(state => state.token);
    const setLastActiveBusinessId = useAuthStore(state => state.setLastActiveBusinessId);
    const updateUser = useAuthStore(state => state.updateUser);
    const logout = useAuthStore(state => state.logout);

    const username = user?.username ?? 'User';

    const [newUsername, setNewUsername] = useState('');
    const [businesses, setBusinesses] = useState([]);
    const [newBusinessName, setNewBusinessName] = useState('');
    const [selectedBusinessId, setSelectedBusinessId] = useState(user?.lastActiveBusinessId || null);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [newBankDetails, setNewBankDetails] = useState({ bank_name: '', account_nickname: '', account_last_four: '' });

    // Team & Audit State
    const [members, setMembers] = useState([]);
    const [invitations, setInvitations] = useState([]);
    const [myInvitations, setMyInvitations] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('viewer');
    const [isInviting, setIsInviting] = useState(false);
    const [inviteMessage, setInviteMessage] = useState(null);
    const [copiedInviteId, setCopiedInviteId] = useState(null);
    const [actionLoadingId, setActionLoadingId] = useState(null);
    const [acceptToken, setAcceptToken] = useState('');
    const [acceptMessage, setAcceptMessage] = useState(null);

    // --- Modular Fetchers (enables live refresh without page reload) ---

    const fetchSettingsData = async () => {
        if (!token) return;
        try {
            const res = await fetch(apiUrl('/settings/data'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setBusinesses(data.businesses || []);
                setBankAccounts(data.bankAccounts || []);

                if (data.businesses && data.businesses.length > 0) {
                    const currentActive = user?.lastActiveBusinessId;
                    const activeExists = data.businesses.some(b => b.id === currentActive);
                    if (!activeExists) {
                        setSelectedBusinessId(data.businesses[0].id);
                        setLastActiveBusinessId(data.businesses[0].id, data.businesses[0].business_name);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching settings data:', error);
        }
    };

    const fetchMyInvitations = async () => {
        if (!token) return;
        try {
            const res = await fetch(apiUrl('/team/my-invitations'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setMyInvitations(data.invitations || []);
            }
        } catch (err) {
            console.error('Error fetching my invitations:', err);
        }
    };

    const fetchAuditLogs = async (bizId = selectedBusinessId) => {
        if (!token || !bizId) return;
        try {
            const res = await fetch(apiUrl(`/team/audit-logs?businessId=${bizId}`), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Error loading audit logs:', err);
        }
    };

    const fetchTeamAndInvitations = async (bizId = selectedBusinessId) => {
        if (!token || !bizId) return;
        try {
            const [mRes, iRes] = await Promise.all([
                fetch(apiUrl(`/team/members?businessId=${bizId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(apiUrl(`/team/invitations?businessId=${bizId}`), {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            if (mRes.ok) {
                const mData = await mRes.json();
                setMembers(mData.members || []);
            }
            if (iRes.ok) {
                const iData = await iRes.json();
                setInvitations(iData.invitations || []);
            }
        } catch (err) {
            console.error('Error loading team & invitations data:', err);
        }
    };

    // Initial Load
    useEffect(() => {
        fetchSettingsData();
        fetchMyInvitations();
    }, [token, user?.lastActiveBusinessId]);

    // Load Team, Invitations & Audit Logs on business switch
    useEffect(() => {
        if (!token || !selectedBusinessId) return;
        fetchTeamAndInvitations(selectedBusinessId);
        fetchAuditLogs(selectedBusinessId);
    }, [token, selectedBusinessId]);

    // --- Handlers ---
    const handleUpdateUsername = async () => {
        if (!newUsername) return;
        try {
            const res = await fetch(apiUrl('/settings/username'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ username: newUsername })
            });
            if (res.ok) {
                updateUser({ username: newUsername });
                setNewUsername('');
            }
        } catch (error) {
            console.error('Error updating username:', error);
        }
    };

    const handleDeleteAccount = async () => {
        if (window.confirm("Are you sure you want to permanently delete your account?")) {
            try {
                const res = await fetch(apiUrl('/settings/account'), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    logout();
                }
            } catch (error) {
                console.error('Error deleting account:', error);
            }
        }
    };

    const handleAddBusiness = async () => {
        if (!newBusinessName) return;
        try {
            const res = await fetch(apiUrl('/settings/business'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ business_name: newBusinessName })
            });
            if (res.ok) {
                const data = await res.json();
                const newBiz = { id: data.id, business_name: data.business_name, user_id: data.user_id };
                setBusinesses([...businesses, newBiz]);

                if (!selectedBusinessId) {
                    setSelectedBusinessId(newBiz.id);
                    setLastActiveBusinessId(newBiz.id, newBiz.business_name);
                }
                setNewBusinessName('');
                fetchAuditLogs(newBiz.id);
            }
        } catch (error) {
            console.error('Error adding business:', error);
        }
    };

    const handleDeleteBusiness = async (id) => {
        if (window.confirm("Are you sure? This will delete the business and all linked bank accounts.")) {
            try {
                const res = await fetch(apiUrl(`/settings/business/${id}`), {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const updatedBusinesses = businesses.filter(biz => biz.id !== id);
                    setBusinesses(updatedBusinesses);

                    if (selectedBusinessId === id) {
                        const nextActiveBusiness = updatedBusinesses.length > 0 ? updatedBusinesses[0] : null;
                        const nextActiveBusinessId = nextActiveBusiness ? nextActiveBusiness.id : null;
                        setSelectedBusinessId(nextActiveBusinessId);
                        setLastActiveBusinessId(nextActiveBusinessId, nextActiveBusiness ? nextActiveBusiness.business_name : null);
                        if (nextActiveBusinessId) fetchAuditLogs(nextActiveBusinessId);
                    } else {
                        fetchAuditLogs(selectedBusinessId);
                    }

                    setBankAccounts(bankAccounts.filter(acc => acc.business_id !== id));
                }
            } catch (error) {
                console.error('Error deleting business:', error);
            }
        }
    };

    const handleAddBankAccount = async () => {
        if (!newBankDetails.bank_name || !selectedBusinessId) return;
        try {
            const res = await fetch(apiUrl('/settings/bank-account'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    business_id: selectedBusinessId,
                    ...newBankDetails
                })
            });
            if (res.ok) {
                const data = await res.json();
                setBankAccounts([...bankAccounts, {
                    id: data.id,
                    business_id: data.business_id,
                    bank_name: data.bank_name,
                    account_nickname: data.account_nickname,
                    account_last_four: data.account_last_four
                }]);
                setNewBankDetails({ bank_name: '', account_nickname: '', account_last_four: '' });
                fetchAuditLogs(selectedBusinessId);
            }
        } catch (error) {
            console.error('Error adding bank account:', error);
        }
    };

    const handleDeleteBankAccount = async (id) => {
        try {
            const res = await fetch(apiUrl(`/settings/bank-account/${id}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setBankAccounts(bankAccounts.filter(acc => acc.id !== id));
                fetchAuditLogs(selectedBusinessId);
            }
        } catch (error) {
            console.error('Error deleting bank account:', error);
        }
    };

    const handleCopyLink = (link, id) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedInviteId(id);
        setTimeout(() => setCopiedInviteId(null), 2200);
    };

    const handleInviteMember = async () => {
        if (!inviteEmail || !selectedBusinessId) return;
        setIsInviting(true);
        setInviteMessage(null);
        try {
            const res = await fetch(apiUrl('/team/invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    businessId: selectedBusinessId,
                    email: inviteEmail,
                    role: inviteRole
                })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setInviteMessage({
                    type: 'success',
                    text: data.message || `Invitation created for ${inviteEmail}!`,
                    inviteLink: data.invitation.inviteLink
                });
                setInvitations([data.invitation, ...invitations]);
                setInviteEmail('');
                // Automatically refresh audit logs live!
                fetchAuditLogs(selectedBusinessId);
            } else if (res.status === 409) {
                setInviteMessage({
                    type: 'warning',
                    text: data.message,
                    inviteLink: data.invitation?.inviteLink
                });
            } else {
                setInviteMessage({ type: 'error', text: data.message || 'Failed to send invitation' });
            }
        } catch (err) {
            console.error('Error sending invitation:', err);
            setInviteMessage({ type: 'error', text: 'Error creating invitation. Please check your connection.' });
        } finally {
            setIsInviting(false);
        }
    };

    const handleRevokeInvitation = async (inviteId, targetEmail) => {
        if (!window.confirm(`Are you sure you want to revoke the invitation for ${targetEmail}?`)) return;
        setActionLoadingId(inviteId);
        try {
            const res = await fetch(apiUrl(`/team/invitations/${inviteId}?businessId=${selectedBusinessId}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setInvitations(invitations.filter((inv) => inv.id !== inviteId));
                // Automatically refresh audit logs live!
                fetchAuditLogs(selectedBusinessId);
            } else {
                alert(data.message || 'Failed to revoke invitation');
            }
        } catch (err) {
            console.error('Error revoking invitation:', err);
            alert('Error revoking invitation');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleResendInvitation = async (inviteId) => {
        setActionLoadingId(inviteId);
        try {
            const res = await fetch(apiUrl(`/team/invitations/${inviteId}/resend?businessId=${selectedBusinessId}`), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setInvitations(invitations.map((inv) => inv.id === inviteId ? { ...inv, ...data.invitation } : inv));
                handleCopyLink(data.invitation.inviteLink, `resend-${inviteId}`);
                alert(`Invitation renewed for 48 hours! The updated link has been copied to your clipboard.`);
                // Automatically refresh audit logs live!
                fetchAuditLogs(selectedBusinessId);
            } else {
                alert(data.message || 'Failed to resend invitation');
            }
        } catch (err) {
            console.error('Error resending invitation:', err);
            alert('Error resending invitation');
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleAcceptMyInvite = async (invOrToken) => {
        const tokenVal = typeof invOrToken === 'string' ? invOrToken : invOrToken?.token;
        const inviteId = typeof invOrToken === 'object' ? invOrToken?.id : null;
        try {
            const res = await fetch(apiUrl('/team/accept-invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: tokenVal, inviteId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setMyInvitations(prev => prev.filter(inv => inv.id !== inviteId && inv.token !== tokenVal));
                await setLastActiveBusinessId(data.businessId, data.businessName);
                setSelectedBusinessId(data.businessId);
                await fetchSettingsData();
                await fetchTeamAndInvitations(data.businessId);
                await fetchAuditLogs(data.businessId);
                alert(`✓ You've successfully joined "${data.businessName || 'the business'}" as ${data.role}!`);
            } else {
                alert(data.message || 'Failed to accept invitation');
            }
        } catch (err) {
            console.error('Error accepting invitation:', err);
            alert('Error accepting invitation');
        }
    };

    const handleDeclineMyInvite = async (inviteId) => {
        if (!window.confirm('Are you sure you want to decline this invitation?')) return;
        try {
            const res = await fetch(apiUrl('/team/decline-invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ inviteId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setMyInvitations(prev => prev.filter(inv => inv.id !== inviteId));
                fetchAuditLogs(selectedBusinessId);
            } else {
                alert(data.message || 'Failed to decline invitation');
            }
        } catch (err) {
            console.error('Error declining invitation:', err);
            alert('Error declining invitation');
        }
    };

    const handleLeaveBusiness = async (businessId, businessName) => {
        if (!window.confirm(`Are you sure you want to leave "${businessName}"? You will no longer have access to its financial records.`)) return;
        try {
            const res = await fetch(apiUrl('/team/leave'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ businessId })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                const updatedBusinesses = businesses.filter(b => b.id !== businessId);
                setBusinesses(updatedBusinesses);
                if (selectedBusinessId === businessId) {
                    const nextBiz = updatedBusinesses.length > 0 ? updatedBusinesses[0] : null;
                    const nextBizId = nextBiz ? nextBiz.id : null;
                    setSelectedBusinessId(nextBizId);
                    await setLastActiveBusinessId(nextBizId, nextBiz ? nextBiz.business_name : null);
                    if (nextBizId) {
                        fetchTeamAndInvitations(nextBizId);
                        fetchAuditLogs(nextBizId);
                    } else {
                        setMembers([]);
                        setInvitations([]);
                        setAuditLogs([]);
                    }
                } else {
                    fetchAuditLogs(selectedBusinessId);
                }
                alert(`You have left "${businessName}".`);
            } else {
                alert(data.message || 'Failed to leave business');
            }
        } catch (err) {
            console.error('Error leaving business:', err);
            alert('Error leaving business');
        }
    };

    const handleAcceptInvite = async () => {
        if (!acceptToken) return;
        setAcceptMessage(null);
        let cleanToken = acceptToken.trim();
        if (cleanToken.includes('token=')) {
            try {
                const urlObj = new URL(cleanToken.startsWith('http') ? cleanToken : `http://dummy.com/${cleanToken}`);
                const param = urlObj.searchParams.get('token');
                if (param) cleanToken = param.trim();
            } catch (_) {
                cleanToken = cleanToken.split('token=')[1].split('&')[0].trim();
            }
        }

        try {
            const res = await fetch(apiUrl('/team/accept-invite'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ token: cleanToken })
            });
            const data = await res.json();
            if (res.ok) {
                setAcceptMessage({ type: 'success', text: `Invitation accepted! You've joined "${data.businessName || 'the business'}" as ${data.role}.` });
                setAcceptToken('');
                await setLastActiveBusinessId(data.businessId, data.businessName);
                setSelectedBusinessId(data.businessId);
                await fetchSettingsData();
                await fetchTeamAndInvitations(data.businessId);
                await fetchAuditLogs(data.businessId);
                await fetchMyInvitations();
            } else {
                setAcceptMessage({ type: 'error', text: data.message || 'Invalid or expired token' });
            }
        } catch (err) {
            setAcceptMessage({ type: 'error', text: 'Error accepting invitation' });
        }
    };

    const handleRemoveMember = async (userId) => {
        if (!window.confirm("Remove this user's access from the business?")) return;
        try {
            const res = await fetch(apiUrl(`/team/members/${userId}?businessId=${selectedBusinessId}`), {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setMembers(members.filter(m => m.user_id !== userId));
                fetchAuditLogs(selectedBusinessId);
            }
        } catch (err) {
            console.error('Error removing member:', err);
        }
    };

    const handleActiveBusinessChange = (e) => {
        const businessId = Number(e.target.value);
        const selectedBusiness = businesses.find((biz) => biz.id === businessId);
        setSelectedBusinessId(businessId);
        setLastActiveBusinessId(businessId, selectedBusiness ? selectedBusiness.business_name : null);
    };

    // --- Derived Data ---
    const activeBusiness = businesses.find(b => b.id === selectedBusinessId);
    const canManageActiveBusiness = activeBusiness ? (activeBusiness.is_owner || activeBusiness.role === 'accountant') : false;

    const activeBusinessBankAccounts = bankAccounts.filter(acc => acc.business_id === selectedBusinessId);

    return (
        <div className="settings-container">
            {/* 0. Incoming Invitations (Direct Acceptance Inbox) */}
            {myInvitations.length > 0 && (
                <section className="settings-section incoming-invitations-section" style={{ border: '2px solid #3b82f6', background: '#f8faff' }}>
                    <h3 style={{ color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span>📬</span> Pending Invitations For You ({myInvitations.length})
                    </h3>
                    <p style={{ color: '#4b5563', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                        You have been invited to join the following business teams. Accept to access them instantly or decline to reject.
                    </p>
                    <div className="incoming-invitations-panel">
                        {myInvitations.map((inv) => (
                            <div key={inv.id} className="incoming-invite-card">
                                <div className="incoming-invite-info">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '1.05rem', color: '#111827' }}>{inv.business_name}</strong>
                                        <span className={`badge-role-tag ${inv.role}`}>{inv.role.toUpperCase()}</span>
                                    </div>
                                    <span style={{ fontSize: '0.825rem', color: '#6b7280' }}>
                                        Invited by <strong>{inv.inviter_name || 'Business Admin'}</strong> ({inv.inviter_email}) · Expires {new Date(inv.expires_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="incoming-invite-actions">
                                    <button
                                        onClick={() => handleAcceptMyInvite(inv)}
                                        className="btn-accept-small"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => handleDeclineMyInvite(inv.id, inv.business_name)}
                                        className="btn-decline-small"
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* 1. Account Settings */}
            <section className="settings-section">
                <h3>Account Settings</h3>
                <div className="form-group">
                    <label>Current Username: {username}</label>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="New Username"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                        />
                        <button onClick={handleUpdateUsername} className="btn-primary">Update</button>
                    </div>
                </div>

                {/* Redeem Invitation */}
                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label><strong>Have an Invitation Token?</strong></label>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Enter 64-char invitation token"
                            value={acceptToken}
                            onChange={(e) => setAcceptToken(e.target.value)}
                        />
                        <button onClick={handleAcceptInvite} className="btn-primary">Accept Invite</button>
                    </div>
                    {acceptMessage && (
                        <p style={{ color: acceptMessage.type === 'error' ? 'red' : 'green', marginTop: '0.5rem' }}>
                            {acceptMessage.text}
                        </p>
                    )}
                </div>

                <div className="form-group danger-zone" style={{ marginTop: '1.5rem' }}>
                    <button onClick={handleDeleteAccount} className="btn-danger">Delete Account</button>
                </div>
            </section>

            {/* 2. Business Management */}
            <section className="settings-section">
                <h3>Manage Businesses</h3>

                {/* Active Business Selector */}
                <div className="business-selector" style={{ marginBottom: '1.5rem' }}>
                    <label><strong>Select Active Business (Site-Wide):</strong></label>
                    {businesses.length === 0 ? (
                        <p style={{ color: 'red', marginTop: '0.5rem' }}>No businesses found. Please add one below.</p>
                    ) : (
                        <select
                            value={selectedBusinessId || ''}
                            onChange={handleActiveBusinessChange}
                        >
                            {businesses.map(biz => (
                                <option key={biz.id} value={biz.id}>{biz.business_name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Business List */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label><strong>Your Businesses:</strong></label>
                    <ul className="settings-list" style={{ marginTop: '0.5rem' }}>
                        {businesses.map(biz => (
                            <li key={biz.id} className="settings-list-item">
                                <span>
                                    {biz.business_name}
                                    {selectedBusinessId === biz.id && <span className="badge-active">Active</span>}
                                    {!biz.is_owner && (
                                        <span className="badge-active" style={{ background: '#eff6ff', color: '#2563eb', marginLeft: '0.4rem' }}>
                                            Shared · {biz.role}
                                        </span>
                                    )}
                                </span>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {!biz.is_owner && (
                                        <button
                                            onClick={() => handleLeaveBusiness(biz.id, biz.business_name)}
                                            className="btn-danger-small"
                                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                                            title="Leave this business"
                                        >
                                            Leave
                                        </button>
                                    )}
                                    {biz.is_owner && (
                                        <button onClick={() => handleDeleteBusiness(biz.id)} className="btn-danger-small">Remove</button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Add Business Form */}
                <div className="add-form-container">
                    <h4>Add New Business</h4>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="New Business Name"
                            value={newBusinessName}
                            onChange={(e) => setNewBusinessName(e.target.value)}
                        />
                        <button onClick={handleAddBusiness} className="btn-primary">Add</button>
                    </div>
                </div>
            </section>

            {/* 3. Team & Guests Management (RBAC) */}
            <section className="settings-section">
                <h3>Team & Guests (RBAC)</h3>
                {!selectedBusinessId ? (
                    <p style={{ color: 'red' }}>Select a business above to manage team members and viewers.</p>
                ) : (
                    <>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4>Active Members & Viewers</h4>
                            <ul className="settings-list" style={{ marginTop: '0.5rem' }}>
                                {members.map(m => (
                                    <li key={m.user_id} className="settings-list-item">
                                        <span>
                                            <strong>{m.username}</strong> ({m.email}) —{' '}
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                background: m.role === 'admin' ? '#ef4444' : m.role === 'accountant' ? '#2563eb' : '#6b7280',
                                                color: '#fff'
                                            }}>
                                                {m.role.toUpperCase()}
                                            </span>
                                            {m.is_owner ? ' (Owner)' : ''}
                                        </span>
                                        {(m.user_id === user?.id || m.email === user?.email) && !m.is_owner ? (
                                            <button
                                                onClick={() => handleLeaveBusiness(selectedBusinessId, activeBusiness?.business_name)}
                                                className="btn-danger-small"
                                                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}
                                                title="Leave this business"
                                            >
                                                Leave Business
                                            </button>
                                        ) : !m.is_owner && canManageActiveBusiness ? (
                                            <button onClick={() => handleRemoveMember(m.user_id)} className="btn-danger-small">
                                                Remove
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Invite Viewers */}
                        <div className="add-form-container" style={{ marginBottom: '1.5rem' }}>
                            <h4>Invite New Guest / Viewer</h4>
                            <div className="input-group multi-input">
                                <input
                                    type="email"
                                    placeholder="Guest Email Address"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                />
                                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                                    <option value="viewer">Viewer (Read-Only)</option>
                                    <option value="accountant">Accountant (Manager)</option>
                                </select>
                                <button
                                    onClick={handleInviteMember}
                                    className="btn-primary"
                                    disabled={isInviting}
                                >
                                    {isInviting ? 'Sending...' : 'Send Invite'}
                                </button>
                            </div>

                            <div className="invite-role-info">
                                <span>ℹ️</span>
                                <span>
                                    {inviteRole === 'accountant'
                                        ? 'Accountant: Full access to reconcile bank statements, upload ledgers, and manage team members.'
                                        : 'Viewer: Read-only access to view reconciliations, reports, and search financial statements.'}
                                </span>
                            </div>

                            {inviteMessage && (
                                <div className={inviteMessage.type === 'error' ? '' : 'invite-success-box'}>
                                    {inviteMessage.type === 'error' ? (
                                        <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>{inviteMessage.text}</p>
                                    ) : (
                                        <>
                                            <p>{inviteMessage.text}</p>
                                            {inviteMessage.inviteLink && (
                                                <div className="invite-link-copy-row">
                                                    <input
                                                        type="text"
                                                        readOnly
                                                        value={inviteMessage.inviteLink}
                                                    />
                                                    <button
                                                        onClick={() => handleCopyLink(inviteMessage.inviteLink, 'created-new')}
                                                        className={`btn-copy-link ${copiedInviteId === 'created-new' ? 'copied' : ''}`}
                                                    >
                                                        {copiedInviteId === 'created-new' ? '✓ Copied!' : 'Copy Link'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Pending Invitations */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4>Pending Invitations</h4>
                            {invitations.length === 0 ? (
                                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    No pending invitations for this business.
                                </p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                                    {invitations.map((inv) => {
                                        const isActionLoading = actionLoadingId === inv.id;
                                        const isCopied = copiedInviteId === inv.id || copiedInviteId === `resend-${inv.id}`;
                                        const expiresDate = new Date(inv.expires_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        });

                                        return (
                                            <div key={inv.id} className="pending-invite-card">
                                                <div className="pending-invite-info">
                                                    <div className="pending-invite-header">
                                                        <span className="pending-invite-email">{inv.email}</span>
                                                        <span className={`badge-role-tag ${inv.role}`}>
                                                            {inv.role.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="pending-invite-meta">
                                                        Invited by {inv.inviter_name || 'A team member'} · Expires {expiresDate}
                                                    </span>
                                                </div>

                                                <div className="pending-invite-actions">
                                                    <button
                                                        onClick={() => handleCopyLink(inv.inviteLink, inv.id)}
                                                        className={`btn-action-small ${isCopied ? 'btn-copy-link copied' : ''}`}
                                                        title="Copy shareable invite link"
                                                    >
                                                        {isCopied ? '✓ Copied' : '📋 Copy Link'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleResendInvitation(inv.id)}
                                                        disabled={isActionLoading}
                                                        className="btn-action-small"
                                                        title="Renew token and extend 48 hours"
                                                    >
                                                        {isActionLoading ? '...' : '🔄 Resend'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                                                        disabled={isActionLoading}
                                                        className="btn-action-small btn-revoke"
                                                        title="Revoke and invalidate this invitation"
                                                    >
                                                        ✕ Revoke
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </section>

            {/* 4. Audit Log */}
            <section className="settings-section">
                <h3>Audit Activity Log</h3>
                <p>Tracked actions for security and compliance.</p>
                {auditLogs.length === 0 ? (
                    <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>No audit activity recorded yet.</p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>User</th>
                                    <th style={{ padding: '8px' }}>Action</th>
                                    <th style={{ padding: '8px' }}>Entity</th>
                                    <th style={{ padding: '8px' }}>IP Address</th>
                                    <th style={{ padding: '8px' }}>Date/Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #edf2f7' }}>
                                        <td style={{ padding: '8px' }}>{log.username} ({log.email})</td>
                                        <td style={{ padding: '8px', fontWeight: 600, color: '#2563eb' }}>{log.action}</td>
                                        <td style={{ padding: '8px' }}>{log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}</td>
                                        <td style={{ padding: '8px' }}>{log.ip_address}</td>
                                        <td style={{ padding: '8px' }}>{new Date(log.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* 5. Bank Accounts */}
            <section className="settings-section">
                <h3>Bank Accounts</h3>
                {!selectedBusinessId ? (
                    <p style={{ color: 'red' }}>Please create and select a business to manage its bank accounts.</p>
                ) : (
                    <>
                        <p>Managing accounts for the currently active business.</p>

                        <ul className="settings-list" style={{ marginBottom: '1.5rem' }}>
                            {activeBusinessBankAccounts.map(acc => (
                                <li key={acc.id} className="settings-list-item">
                                    <span>{acc.bank_name} - {acc.account_nickname} (**** **** **** {acc.account_last_four})</span>
                                    {canManageActiveBusiness && (
                                        <button
                                            onClick={() => handleDeleteBankAccount(acc.id)}
                                            className="btn-danger-small"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>

                        {canManageActiveBusiness && (
                            <div className="add-form-container">
                                <h4>Add New Bank Account</h4>
                                <div className="input-group multi-input">
                                    <input
                                        type="text"
                                        placeholder="Bank Name (e.g. HDFC)"
                                        value={newBankDetails.bank_name}
                                        onChange={(e) => setNewBankDetails({ ...newBankDetails, bank_name: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Nickname"
                                        value={newBankDetails.account_nickname}
                                        onChange={(e) => setNewBankDetails({ ...newBankDetails, account_nickname: e.target.value })}
                                    />
                                    <input
                                        type="text"
                                        maxLength="4"
                                        placeholder="Last 4 Digits"
                                        value={newBankDetails.account_last_four}
                                        onChange={(e) => setNewBankDetails({ ...newBankDetails, account_last_four: e.target.value })}
                                    />
                                    <button onClick={handleAddBankAccount} className="btn-primary">Add</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}