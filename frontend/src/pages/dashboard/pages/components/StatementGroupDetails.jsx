import { useParams, useNavigate } from "react-router-dom";
import "./StatementGroupDetails.css";
import { useState, useEffect } from "react";
import axios from "axios";
import useAuthStore from "../../../../store/useAuthStore";
import { apiUrl } from '../../../../utils/api';

export function StatementGroupDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = useAuthStore(state => state.token);
    const [transactions, setTransactions] = useState([]);
    const [groupInfo, setGroupInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStatementDetails = async () => {
            try {
                setLoading(true);
                setError('');
                const response = await axios.get(apiUrl(`/bank-statement/groups/${id}`), {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                
                setGroupInfo({
                    id: response.data.group.id,
                    name: response.data.group.name,
                    month: response.data.group.month,
                    year: response.data.group.year,
                    createdAt: response.data.group.createdAt,
                    bankAccount: response.data.group.bankAccount
                });
                
                setTransactions(response.data.records || []);
            } catch (err) {
                const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch statement details';
                setError(errorMessage);
                console.error('Error fetching statement details:', err);
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchStatementDetails();
        }
    }, [id]);

    const formatDate = (dateObj) => {
        if (!dateObj) return '';
        const date = new Date(dateObj);
        return date.toISOString().split('T')[0];
    };

    if (loading) {
        return <div className="loading-state">Loading statement details...</div>;
    }

    if (error) {
        return (
            <div className="error-state">
                <p>{error}</p>
                <button onClick={() => navigate(-1)}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="statement-details-container">
            {groupInfo && (
                <div className="statement-header">
                    <div className="header-content">
                        <h2>{groupInfo.name}</h2>
                        <p className="header-info">
                            {groupInfo.bankAccount} • {getMonthName(groupInfo.month)} {groupInfo.year}
                        </p>
                    </div>
                    <div className="header-stats">
                        <span className="stat-box">
                            <strong>{transactions.length}</strong>
                            <span>Entries</span>
                        </span>
                    </div>
                </div>
            )}

            <div className="transactions-view">
                {transactions.length === 0 ? (
                    <div className="empty-state">No transactions found in this statement.</div>
                ) : (
                    <>
                        <div className="statement-table-container">
                            <table className="statement-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '50px' }}>#</th>
                                        <th style={{ width: '120px' }}>Reconciled</th>
                                        <th style={{ width: '150px' }}>Date</th>
                                        <th style={{ width: '120px' }}>Amount</th>
                                        <th style={{ width: '100px' }}>Type</th>
                                        <th>Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map((txn, index) => (
                                        <tr key={txn.id}>
                                            <td>{index + 1}</td>
                                            <td className="reconciled-cell">
                                                {txn.reconciled}
                                            </td>
                                            <td>
                                                {formatDate(txn.date)}
                                            </td>
                                            <td className={`amount-cell ${txn.type}`}>
                                                {parseFloat(txn.amount || 0).toFixed(2)}
                                            </td>
                                            <td className={`type-badge ${txn.type}`}>
                                                {txn.type ? txn.type.toUpperCase() : '—'}
                                            </td>
                                            <td className="description-cell">
                                                {txn.description || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const getMonthName = (monthNum) => {
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthNum - 1] || '';
};