import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { CreateReconcilationsModel } from "./components/CreateReconciliationModel";
import useAuthStore from '../../../store/useAuthStore';
import { apiUrl } from '../../../utils/api';

const MONTHS = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d) ? iso : d.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

export function ReconciliationsPage() {
    const { showCreateModalOverlay, setShowCreateModalOverlay } = useOutletContext();
    const navigate  = useNavigate();
    const token     = useAuthStore(s => s.token);
    const user      = useAuthStore(s => s.user);

    const [reconciliations, setReconciliations] = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [error,   setError]                   = useState('');

    /* ── fetch reconciliation runs from DB ── */
    const fetchReconciliations = async () => {
        try {
            setLoading(true);
            setError('');
            const res  = await fetch(apiUrl(`/reconciliation/?businessId=${user?.lastActiveBusinessId || ''}`), {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to load');
            setReconciliations(data.data || []);
        } catch (e) {
            console.error(e);
            setError('Could not load reconciliation runs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReconciliations(); }, [token]);

    /* ── status badge helper ── */
    const StatusBadge = ({ status }) => {
        const isComplete = (status || '').toLowerCase() === 'completed';
        return (
            <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                background: isComplete ? '#f0fdf4' : '#fefce8',
                color:      isComplete ? '#16a34a' : '#ca8a04',
            }}>
                {isComplete ? '✓ Completed' : '⏳ In Progress'}
            </span>
        );
    };

    return (
        <>
            {showCreateModalOverlay && (
                <CreateReconcilationsModel
                    isOpen={showCreateModalOverlay}
                    onClose={() => {
                        setShowCreateModalOverlay(false);
                        fetchReconciliations(); // refresh after creating
                    }}
                />
            )}

            <div className="ledger-table-container">
                {loading && (
                    <p style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                        Loading reconciliation runs…
                    </p>
                )}

                {error && (
                    <p style={{ textAlign: 'center', padding: '32px', color: '#ef4444' }}>
                        {error}
                    </p>
                )}

                {!loading && !error && (
                    <table className="ledger-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Bank Account</th>
                                <th>Period</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'center' }}>✓ Matched</th>
                                <th style={{ textAlign: 'center' }}>~ Partial</th>
                                <th style={{ textAlign: 'center' }}>✗ Unmatched</th>
                                <th style={{ textAlign: 'center' }}>Total</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reconciliations.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{
                                        textAlign: 'center', padding: '40px',
                                        color: '#94a3b8', fontSize: '14px'
                                    }}>
                                        No reconciliation runs yet. Click <strong>Create New Reconciliation Group</strong> to start.
                                    </td>
                                </tr>
                            ) : reconciliations.map((r, idx) => (
                                <tr
                                    key={r.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => navigate(`/dashboard/reconciliations/${r.id}`)}
                                >
                                    <td style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                                        {idx + 1}
                                    </td>
                                    <td className="cell-name">
                                        <div style={{ fontWeight: 600 }}>{r.bank_name || '—'}</div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{r.account_nickname || ''}</div>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>
                                        {MONTHS[r.target_month] || r.target_month} {r.target_year}
                                    </td>
                                    <td><StatusBadge status={r.status} /></td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#16a34a' }}>
                                        {r.matched_count ?? '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#d97706' }}>
                                        {r.partial_count ?? '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>
                                        {r.unmatched_count ?? '—'}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#475569' }}>
                                        {r.total_count ?? '—'}
                                    </td>
                                    <td style={{ color: '#64748b', fontSize: '13px' }}>
                                        {formatDate(r.created_at)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
}