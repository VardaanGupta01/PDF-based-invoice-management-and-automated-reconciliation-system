import React from 'react';
import '../App.css';
import './LandingPage.css';
import useAuthStore from '../store/useAuthStore';
import { Link } from 'react-router-dom';

// SVGs
const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);
const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);
const CreditCardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
);
const CheckCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
);
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
);
const ZapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
);
const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
);
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
);

const handleSmoothScroll = (e, targetId) => {
  e.preventDefault();
  const el = document.getElementById(targetId);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

function LandingPage() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);
  const username = user?.username;
  const email = user?.email;
  const avatarLetter = (username?.[0] ?? '?').toUpperCase();

  return (
    <div className="landing-page">
      {/* NAVBAR */}
      <nav className="navbar">
        <Link to="/" className="brand">
          <div className="brand-icon-wrapper">
            <BarChartIcon />
          </div>
          ReconFlow
        </Link>
        <div className="nav-center">
          <a href="#features" className="nav-link" onClick={(e) => handleSmoothScroll(e, 'features')}>Features</a>
          <a href="#how-it-works" className="nav-link" onClick={(e) => handleSmoothScroll(e, 'how-it-works')}>How It Works</a>
          <Link to="/dashboard" className="nav-link">Dashboard</Link>
        </div>
        <div className="nav-right">
          {isAuthenticated && username ? (
            <div className="user-profile">
              <div className="avatar">{avatarLetter}</div>
              <div className="user-info">
                <h4>{username}</h4>
                <p>{email}</p>
              </div>
            </div>
          ) : (
            <>
              <Link to="/auth?mode=login"><button className="btn-login">Log In</button></Link>
              <Link to="/auth?mode=signup">
                <button className="btn-primary">Get Started</button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            Smart Financial Automation for SMEs
          </div>
          <h1 className="hero-title">
            Automate Invoice &amp;<br />
            <span className="hero-title-accent">Reconciliation</span><br />
            in Minutes
          </h1>
          <p className="hero-subtitle">
            ReconFlow extracts financial data from your PDFs and cross-references them
            with bank statements — eliminating hours of manual accounting work.
          </p>
          <div className="hero-cta-group">
            {isAuthenticated ? (
              <Link to="/dashboard">
                <button className="btn-cta-primary">
                  Go to Dashboard <ArrowRightIcon />
                </button>
              </Link>
            ) : (
              <Link to="/auth?mode=signup">
                <button className="btn-cta-primary">
                  Start for Free <ArrowRightIcon />
                </button>
              </Link>
            )}
            <a href="#how-it-works" onClick={(e) => handleSmoothScroll(e, 'how-it-works')}>
              <button className="btn-cta-secondary">See How It Works</button>
            </a>
          </div>
        </div>

        {/* Hero visual card */}
        <div className="hero-visual">
          <div className="hero-card">
            <div className="card-header">
              <div className="card-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="card-title-tag">Reconciliation Session</span>
            </div>
            <div className="card-body">
              <div className="recon-row matched">
                <CheckCircleIcon />
                <span className="txn-id">TXN-001</span>
                <span className="txn-meta">Debit · 15 Jan</span>
                <span className="amount">₹42,500</span>
                <span className="status-badge exact-badge">Exact</span>
              </div>
              <div className="recon-row matched">
                <CheckCircleIcon />
                <span className="txn-id">TXN-002</span>
                <span className="txn-meta">Credit · 18 Jan</span>
                <span className="amount">₹18,200</span>
                <span className="status-badge exact-badge">Exact</span>
              </div>
              <div className="recon-row partial">
                <div className="partial-dot"></div>
                <span className="txn-id">TXN-003</span>
                <span className="txn-meta">Debit · 22 Jan</span>
                <span className="amount">₹91,000</span>
                <span className="status-badge partial-badge">Partial</span>
              </div>
              <div className="recon-row matched">
                <CheckCircleIcon />
                <span className="txn-id">TXN-004</span>
                <span className="txn-meta">Debit · 25 Jan</span>
                <span className="amount">₹6,750</span>
                <span className="status-badge exact-badge">Exact</span>
              </div>
              <div className="card-summary">
                <span>3 exact · 1 partial</span>
                <span className="summary-amount">₹67,450 reconciled</span>
              </div>
            </div>
          </div>
          <div className="floating-badge fb-1">
            <ZapIcon />
            <span>Auto-matched</span>
          </div>
          <div className="floating-badge fb-2">
            <ShieldIcon />
            <span>Audit Ready</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-tag">Features</span>
          <h2 className="section-title">Everything you need to reconcile faster</h2>
          <p className="section-subtitle">
            Built for real-world accounting workflows — multi-business, multi-account, and period-based reconciliation.
          </p>
        </div>
        <div className="features-grid">
          <div className="feature-card feature-card-large">
            <div className="feature-icon-wrap">
              <ShieldIcon />
            </div>
            <h3>Multi-Business &amp; Multi-Account</h3>
            <p>Manage multiple businesses under one login. Each business can have several bank accounts. Your last active business is remembered for a seamless return.</p>
            <ul className="feature-checklist">
              <li><CheckCircleIcon /> One login, many businesses</li>
              <li><CheckCircleIcon /> Multiple bank accounts per business</li>
            </ul>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrap">
              <FileIcon />
            </div>
            <h3>Ledger Upload &amp; Parse</h3>
            <p>Create month/year-based Ledgers linked to a bank account. Upload Excel ledgers or text-based PDF invoices — stored locally and parsed into structured records.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrap">
              <CreditCardIcon />
            </div>
            <h3>Bank Statement Groups</h3>
            <p>Create period-based Bank Statement Groups. Upload CSV exports from your bank. The system parses and stores every transaction row for matching.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon-wrap">
              <RefreshIcon />
            </div>
            <h3>Smart Reconciliation Engine</h3>
            <p>Link a Ledger and a Bank Statement Group into a Reconciliation Session. The engine cross-references Date, Amount, and Transaction Type automatically.</p>
          </div>
          <div className="feature-card feature-card-large">
            <div className="feature-icon-wrap">
              <ZapIcon />
            </div>
            <h3>Exact, Partial &amp; Manual Matches</h3>
            <p>Matches are classified as auto-exact, auto-partial, or manual. Every ledger and bank record tracks an <code>is_reconciled</code> flag so unmatched leftovers are instantly visible.</p>
            <ul className="feature-checklist">
              <li><CheckCircleIcon /> Auto-exact matching</li>
              <li><CheckCircleIcon /> Auto-partial suggestions</li>
              <li><CheckCircleIcon /> Manual override &amp; filtering</li>
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="how-section">
        <div className="section-header">
          <span className="section-tag">How It Works</span>
          <h2 className="section-title">From setup to reconciliation — in 3 steps</h2>
          <p className="section-subtitle">
            Period-based workflow built for accountants. Create containers, upload files, and reconcile side-by-side.
          </p>
        </div>
        <div className="steps-container">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon-wrap">
              <FileIcon />
            </div>
            <h3>Create Ledger &amp; Upload Files</h3>
            <p>Add your business and bank accounts. Create a Ledger for a specific month/year, then upload Excel ledgers or text-based PDF invoices. Files are stored securely and parsed into structured records.</p>
          </div>
          <div className="step-connector">
            <ArrowRightIcon />
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon-wrap">
              <CreditCardIcon />
            </div>
            <h3>Create Bank Statement Group</h3>
            <p>Create a matching Bank Statement Group for the same period. Upload your bank's CSV export. The system parses every transaction row and prepares it for cross-referencing.</p>
          </div>
          <div className="step-connector">
            <ArrowRightIcon />
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon-wrap">
              <RefreshIcon />
            </div>
            <h3>Reconcile &amp; Review Matches</h3>
            <p>Start a Reconciliation Session linking both sides. The engine auto-matches by Date, Amount, and Type. Review exact matches, handle partials manually, and filter unmatched leftovers instantly.</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-brand">
          <div className="brand-icon-wrapper">
            <BarChartIcon />
          </div>
          ReconFlow
        </div>
        <p className="footer-copy">Created By ~ Vardaan, Bhavay, Yash ,Rushal </p>
      </footer>
    </div>
  );
}

export default LandingPage;
