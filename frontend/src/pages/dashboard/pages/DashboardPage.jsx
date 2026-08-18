import React, { useEffect, useState } from 'react';
import useAuthStore from '../../../store/useAuthStore';
import './DashboardPage.css';
import { apiUrl } from '../../../utils/api';

/* SVG Icons */
const TrendingUpIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
);

const TrendingDownIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
);

const MinusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
);

// Default data when API fails
const defaultStats = {
  latestMonthStats: {
    month: "Loading...",
    total_records: 0,
    exact_matches: 0,
    partial_matches: 0,
    manual_matches: 0,
    unmatched: 0
  },
  previousMonthStats: {
    month: "N/A",
    total_records: 0,
    exact_matches: 0,
    partial_matches: 0,
    manual_matches: 0,
    unmatched: 0
  },
  overallStats: {
    total_records_processed: 0,
    all_time_exact: 0,
    all_time_partial: 0,
    all_time_manual: 0,
    all_time_unmatched: 0
  },
  recentMatches: []
};

/* Helpers */
const formatCurrency = (val) => "Rs." + val.toLocaleString("en-IN");

const pct = (num, den) => den === 0 ? "0.0" : ((num / den) * 100).toFixed(1);

// Calculate trend vs previous month - returns { value: "+x.x%", direction: "up" | "down" | "none" }
const calculateTrend = (currentValue, prevValue) => {
  if (prevValue === 0 || prevValue === null || prevValue === undefined) {
    return { value: "N/A", direction: "none" };
  }
  
  const change = ((currentValue - prevValue) / prevValue) * 100;
  const formatted = change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
  
  return {
    value: formatted,
    direction: change > 0 ? "up" : change < 0 ? "down" : "none"
  };
};

/* Reusable Performance Card */
function PerformanceCard({ title, value, count, total, trend, trendDir, fillClass, rightLabel }) {
  // If no trend data (direction === "none"), show grey color
  const trendClass = trendDir === "none" ? "trend-neutral" : trendDir === "up" ? "trend-up" : "trend-down";
  const showIcon = trendDir === "up" ? <TrendingUpIcon /> : trendDir === "down" ? <TrendingDownIcon /> : <MinusIcon />;
  const badgeText = rightLabel ?? trend;
  
  return (
    <div className="overall-stat-card">
      <div className="overall-stat-header">
        <h4>{title}</h4>
        <span className={`overall-stat-trend ${trendClass}`}>
          {rightLabel ? null : showIcon} {badgeText}
        </span>
      </div>
      <div className="overall-stat-value">{value}%</div>
      <div className="overall-stat-bar">
        <div className={`overall-stat-bar-fill ${fillClass}`} style={{ width: `${value}%` }} />
      </div>
      <div className="overall-stat-footer">
        {count.toLocaleString("en-IN")} out of {total.toLocaleString("en-IN")} records
      </div>
    </div>
  );
}

/* Component */
export function DashboardPage() {
  const [stats, setStats] = useState(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        const businessParam = user?.lastActiveBusinessId ? `?businessId=${user.lastActiveBusinessId}` : '';
        const response = await fetch(apiUrl(`/stats/dashboard-stats${businessParam}`), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.previousMonthStats) {
          data.previousMonthStats = {
            month: "N/A",
            total_records: 0,
            exact_matches: 0,
            partial_matches: 0,
            manual_matches: 0,
            unmatched: 0
          };
        }
        setStats(data);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token, user?.lastActiveBusinessId]);

  const m = stats.latestMonthStats;
  const pm = stats.previousMonthStats;
  const overallStats = stats.overallStats;

  // Calculate trends for This Month stats
  const exactTrend = calculateTrend(m.exact_matches, pm.exact_matches);
  const partialTrend = calculateTrend(m.partial_matches, pm.partial_matches);
  const unmatchedTrend = calculateTrend(m.unmatched, pm.unmatched);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="welcome-banner">
          <h1>Dashboard</h1>
          <p>Fetching monthly performance metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Welcome */}
      <div className="welcome-banner">
        <h1>Dashboard</h1>
        <p>Overview of your reconciliation activity and performance metrics.</p>
      </div>

      {/* This Month Performance */}
      <div className="section-title-row">
        <h2>This Month Performance</h2>
        <span className="section-tag">{m.total_records.toLocaleString("en-IN")} records</span>
      </div>

      <div className="overall-stats-grid">
        <PerformanceCard
          title="Exact Match Rate"
          value={pct(m.exact_matches, m.total_records)}
          count={m.exact_matches}
          total={m.total_records}
          trend={exactTrend.value}
          trendDir={exactTrend.direction}
          fillClass="fill-green"
        />
        <PerformanceCard
          title="Partial Match Rate"
          value={pct(m.partial_matches, m.total_records)}
          count={m.partial_matches}
          total={m.total_records}
          trend={partialTrend.value}
          trendDir={partialTrend.direction}
          fillClass="fill-amber"
        />
        <PerformanceCard
          title="Unmatched Rate"
          value={pct(m.unmatched, m.total_records)}
          count={m.unmatched}
          total={m.total_records}
          trend={unmatchedTrend.value}
          trendDir={unmatchedTrend.direction}
          fillClass="fill-rose"
        />
      </div>

      {/* Overall Reconciliation Performance */}
      <div className="section-title-row">
        <h2>Overall Reconciliation Performance</h2>
        <span className="section-tag">{overallStats.total_records_processed.toLocaleString("en-IN")} records all time</span>
      </div>

      <div className="overall-stats-grid">
        <PerformanceCard
          title="Exact Match Rate"
          value={pct(overallStats.all_time_exact, overallStats.total_records_processed)}
          count={overallStats.all_time_exact}
          total={overallStats.total_records_processed}
          trend="N/A"
          trendDir="none"
          rightLabel={`${overallStats.all_time_exact.toLocaleString("en-IN")}`}
          fillClass="fill-green"
        />
        <PerformanceCard
          title="Partial Match Rate"
          value={pct(overallStats.all_time_partial, overallStats.total_records_processed)}
          count={overallStats.all_time_partial}
          total={overallStats.total_records_processed}
          trend="N/A"
          trendDir="none"
          rightLabel={`${overallStats.all_time_partial.toLocaleString("en-IN")}`}
          fillClass="fill-amber"
        />
        <PerformanceCard
          title="Unmatched Rate"
          value={pct(overallStats.all_time_unmatched, overallStats.total_records_processed)}
          count={overallStats.all_time_unmatched}
          total={overallStats.total_records_processed}
          trend="N/A"
          trendDir="none"
          rightLabel={`${overallStats.all_time_unmatched.toLocaleString("en-IN")}`}
          fillClass="fill-rose"
        />
      </div>

      {/* Recent Matches Table */}
      <div className="mini-table-wrapper">
        <div className="mini-table-header">
          <h4>Recent Matches</h4>
          <a href="/dashboard/reconciliations">View All <ArrowRightIcon /></a>
        </div>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Match Type</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentMatches && stats.recentMatches.length > 0 ? (
              stats.recentMatches.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.transaction_id}</strong></td>
                  <td>{item.transaction_type}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td>
                    <span className={`match-type-badge badge-${item.match_type}`}>
                      {item.match_type.charAt(0).toUpperCase() + item.match_type.slice(1)}
                    </span>
                  </td>
                  <td>{item.match_date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', color: 'var(--dash-text-muted)' }}>
                  No recent matches found. Start a reconciliation to see matches here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
