import React, { useState, useEffect } from 'react';
import './CreateReconciliationModel.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../../../../store/useAuthStore';
import { apiUrl } from '../../../../utils/api';

const MONTHS = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

export function CreateReconcilationsModel({ isOpen, onClose }) {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        ledgerId: '',
        statementGroupId: ''
    });


    const [ledgers,         setLedgers]         = useState([]);
    const [statementGroups, setStatementGroups] = useState([]);
    const [loading,         setLoading]         = useState(false);
    const [running,         setRunning]         = useState(false);
    const [error,           setError]           = useState('');
    const [success,         setSuccess]         = useState('');

    const token = useAuthStore(state => state.token);
    const user = useAuthStore(state => state.user);

    useEffect(() => {
        if (isOpen) {
            setError('');
            setSuccess('');
            setFormData({ ledgerId: '', statementGroupId: '' });
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');

            const [ledgersRes, statementsRes] = await Promise.all([
                axios.get(apiUrl('/ledger'), {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-business-id': user?.lastActiveBusinessId || ''
                    }
                }),
                axios.get(apiUrl('/bank-statement/groups'), {
                    headers: { 
                        Authorization: `Bearer ${token}`,
                        'x-business-id': user?.lastActiveBusinessId || ''
                    }
                })
            ]);

            setLedgers(ledgersRes.data.data || []);
            setStatementGroups(statementsRes.data.groups || []);

        } catch (err) {
            console.error('Failed to fetch data:', err);
            setError('Failed to load ledgers or statement groups.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleLedgerChange = (e) => {
        const newLedgerId = e.target.value;
        const selectedL   = ledgers.find(l => l.id.toString() === newLedgerId);

        let matchingGroupId = '';
        if (selectedL) {
            const matchingGroup = statementGroups.find(group =>
                String(group.bankAccountId) === String(selectedL.bankAccountId) &&
                String(group.month)         === String(selectedL.targetMonth)   &&
                String(group.year)          === String(selectedL.targetYear)
            );
            if (matchingGroup) matchingGroupId = matchingGroup.id.toString();
        }

        setFormData({ ledgerId: newLedgerId, statementGroupId: matchingGroupId });
        setError('');
        setSuccess('');
    };

    /* ── Submit: POST to /run ── */
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.ledgerId || !formData.statementGroupId) {
            setError('Please select both a ledger and a statement group.');
            return;
        }

        try {
            setRunning(true);
            setError('');
            setSuccess('');

            const res = await axios.post(
                apiUrl('/reconciliation/run'),
                {
                    ledgerId            : Number(formData.ledgerId),
                    bankStatementGroupId: Number(formData.statementGroupId)
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const { summary, reconId } = res.data;
            setSuccess(
                `✓ Done — ${summary.matched} matched, ` +
                `${summary.partial} partial, ${summary.unmatched} unmatched.`
            );

            // Navigate directly to the results page after a brief flash
            setTimeout(() => {
                onClose();
                navigate(`/dashboard/reconciliations/${reconId}`);
            }, 900);

        } catch (err) {
            console.error('Reconciliation run error:', err);
            const msg = err.response?.data?.message || 'Reconciliation failed. Please try again.';
            setError(msg);
        } finally {
            setRunning(false);
        }
    };

    const selectedLedger = ledgers.find(l => l.id.toString() === formData.ledgerId);

    const filteredStatementGroups = selectedLedger
        ? statementGroups.filter(group =>
            String(group.bankAccountId) === String(selectedLedger.bankAccountId) &&
            String(group.month)         === String(selectedLedger.targetMonth)   &&
            String(group.year)          === String(selectedLedger.targetYear)
          )
        : statementGroups;

    return (
        <div className="modal-overlay" onClick={running ? undefined : onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>

                <div className="modal-header">
                    <h2>Run Reconciliation</h2>
                    <button className="btn-close" onClick={onClose} disabled={running}>&times;</button>
                </div>

                <form className="modal-form" onSubmit={handleSubmit}>

                    {/* Error banner */}
                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fecaca',
                            color: '#dc2626', borderRadius: '8px',
                            padding: '10px 14px', marginBottom: '12px', fontSize: '13px'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Success banner */}
                    {success && (
                        <div style={{
                            background: '#f0fdf4', border: '1px solid #bbf7d0',
                            color: '#16a34a', borderRadius: '8px',
                            padding: '10px 14px', marginBottom: '12px', fontSize: '13px',
                            fontWeight: 600
                        }}>
                            {success}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Select Ledger</label>
                        <select
                            className="form-select"
                            required
                            value={formData.ledgerId}
                            onChange={handleLedgerChange}
                            disabled={loading || running}
                        >
                            <option value="" disabled>
                                {loading ? 'Loading…' : 'Select a ledger…'}
                            </option>
                            {ledgers.map(ledger => (
                                <option key={ledger.id} value={ledger.id}>
                                    {ledger.bankAccount} — {MONTHS[ledger.targetMonth] || ledger.targetMonth} {ledger.targetYear}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Select Bank Statement Group</label>
                        <select
                            className="form-select"
                            required
                            value={formData.statementGroupId}
                            onChange={(e) => {
                                setFormData({ ...formData, statementGroupId: e.target.value });
                                setError('');
                            }}
                            disabled={loading || running || !formData.ledgerId}
                        >
                            <option value="" disabled>
                                {loading        ? 'Loading…' :
                                 !formData.ledgerId ? 'Select a ledger first…' :
                                 filteredStatementGroups.length === 0 ? 'No matching statement group' :
                                 'Select a statement group…'}
                            </option>
                            {filteredStatementGroups.map(group => (
                                <option key={group.id} value={group.id}>
                                    {group.name} ({MONTHS[group.month] || group.month} {group.year})
                                </option>
                            ))}
                        </select>
                        {formData.ledgerId && filteredStatementGroups.length === 0 && !loading && (
                            <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '4px' }}>
                                ⚠ No bank statement group matches this ledger's period and account.
                            </p>
                        )}
                    </div>

                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                            disabled={running}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={loading || running || !formData.ledgerId || !formData.statementGroupId}
                        >
                            {running ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="spin-icon">⟳</span> Running…
                                </span>
                            ) : 'Run Reconciliation'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}