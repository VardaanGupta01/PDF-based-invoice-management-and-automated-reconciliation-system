import { Link, NavLink } from "react-router-dom";
import useAuthStore from "../../store/useAuthStore";
import { useNavigate } from "react-router-dom";

// SVG Icons
const BarChartIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

const HomeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
);

const LedgerIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        <line x1="8" y1="7" x2="16" y2="7"></line>
        <line x1="8" y1="11" x2="16" y2="11"></line>
        <line x1="8" y1="15" x2="16" y2="15"></line>
    </svg>
);

const BankStatementIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
    </svg>
);

const ReconciliationIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
        <path d="M16 16h5v5"></path>
        <polyline points="9 11 12 14 22 4"></polyline>
    </svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

export function Sidebar({ pendingInviteCount = 0 }) {
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const navigate = useNavigate();
    const username = user?.username;
    const avatarLetter = (username?.[0] ?? '?').toUpperCase();
    const activeBusinessLabel = user?.lastActiveBusinessName
        ? `Active Business: ${user.lastActiveBusinessName}`
        : user?.lastActiveBusinessId
        ? `Active Business: #${user.lastActiveBusinessId}`
        : "Active Business: Not selected";

    return (
        <aside className="sidebar">
            <NavLink to={"/"} className="sidebar-brand">
                <div className="brand-icon-wrapper">
                    <BarChartIcon />
                </div>
                ReconFlow
            </NavLink>

            <nav className="sidebar-nav">
                <NavLink to="/dashboard" end className={`nav-item`}>
                    <HomeIcon /> Dashboard
                </NavLink>
                <NavLink to="./ledger-collection" className={`nav-item`}>
                    <LedgerIcon /> Ledger Collection
                </NavLink>
                <NavLink to="./bank-statements" className={`nav-item`}>
                    <BankStatementIcon /> Bank Statements
                </NavLink>
                <NavLink to="./reconciliations" className={`nav-item`}>
                    <ReconciliationIcon /> Reconciliations
                </NavLink>
                <NavLink to="./settings" className={`nav-item`} style={{ display: 'flex', alignItems: 'center' }}>
                    <SettingsIcon /> Settings
                    {pendingInviteCount > 0 && (
                        <span style={{
                            marginLeft: 'auto',
                            background: '#ef4444',
                            color: '#ffffff',
                            borderRadius: '9999px',
                            padding: '1px 7px',
                            fontSize: '0.72rem',
                            fontWeight: '700',
                            lineHeight: '1.4'
                        }}>
                            {pendingInviteCount}
                        </span>
                    )}
                </NavLink>
                <NavLink className="nav-item" id="logout-btn" onClick={() => {
                    logout();
                    navigate("/");
                }}>
                    <SettingsIcon /> Logout
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar">{avatarLetter}</div>
                    <div className="user-info">
                        <h4>{username ?? 'User'}</h4>
                        <p>{activeBusinessLabel}</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
