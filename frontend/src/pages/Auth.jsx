import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import zxcvbn from 'zxcvbn';
import useAuthStore from '../store/useAuthStore';
import { apiUrl } from '../utils/api';
import './Auth.css';

const BarChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
);

function Auth() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);

  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const redirectUrl = searchParams.get('redirect');
  const emailParam = searchParams.get('email');

  const [isLogin, setIsLogin] = useState(mode !== 'signup' && mode !== 'forgot');
  const [isForgot, setIsForgot] = useState(mode === 'forgot');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(emailParam || '');
  const [password, setPassword] = useState('');

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedResetToken, setGeneratedResetToken] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (emailParam && !email) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectUrl || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate, redirectUrl]);

  useEffect(() => {
    if (!mode) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('mode', 'login');
        return next;
      }, { replace: true });
      setIsLogin(true);
      setIsForgot(false);
    } else if (mode === 'forgot') {
      setIsForgot(true);
      setIsLogin(false);
    } else {
      setIsForgot(false);
      setIsLogin(mode !== 'signup');
    }
  }, [mode, setSearchParams]);

  // Evaluate password strength using zxcvbn on Sign Up
  const strengthResult = useMemo(() => {
    if (!password) return { score: 0, label: 'Very Weak', color: '#e5e7eb' };
    const res = zxcvbn(password);
    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#059669'];
    return {
      score: res.score,
      label: labels[res.score],
      color: colors[res.score]
    };
  }, [password]);

  // Real-time password criteria checklist
  const criteria = useMemo(() => {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
  }, [password]);

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    setGeneratedResetToken(null);

    try {
      const response = await fetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to request password reset');
      }

      setSuccess(data.message);
      if (data.resetToken) {
        setGeneratedResetToken(data.resetToken);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Enforce password criteria on frontend Sign Up
    if (!isLogin && (!criteria.length || !criteria.uppercase || !criteria.number || !criteria.special)) {
      setError('Password does not meet all security constraints.');
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? '/auth/login' : '/auth/register';

    try {
      const response = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isLogin ? { email, password } : { username, email, password }),
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      if (isLogin) {
        login(data.user, data.token);
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => {
          navigate(redirectUrl || '/dashboard');
        }, 800);
      } else {
        setSuccess('Registration successful! Please log in.');
        setTimeout(() => {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set('mode', 'login');
            return next;
          });
          setPassword('');
          setSuccess(null);
        }, 1500);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <Link to="/" className="brand-back">
        <div className="brand-icon-wrapper">
          <BarChartIcon />
        </div>
        ReconFlow
      </Link>

      <div className="auth-card">
        <div className="auth-header">
          <h2>{isForgot ? 'Forgot Password' : isLogin ? 'Welcome Back' : 'Create an Account'}</h2>
          <p>
            {isForgot
              ? 'Enter your account email to receive a password reset link.'
              : isLogin
              ? 'Log in to manage your automated reconciliations.'
              : 'Automate your financial processing today.'}
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {isForgot ? (
          <form className="auth-form" onSubmit={handleForgotPassword}>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {generatedResetToken && (
              <div style={{ marginTop: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Password Reset Token Generated:</p>
                <code style={{ wordBreak: 'break-all', color: '#2563eb' }}>{generatedResetToken}</code>
                <div style={{ marginTop: '0.5rem' }}>
                  <Link
                    to={`/reset-password?token=${generatedResetToken}`}
                    style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Click here to Reset Password →
                  </Link>
                </div>
              </div>
            )}

            <button type="submit" className="btn-auth-submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Enter Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="Enter Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {!isLogin && password && (
                <div className="strength-meter-container">
                  <div className="strength-bar-track">
                    {[0, 1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className="strength-segment"
                        style={{
                          backgroundColor: level <= strengthResult.score ? strengthResult.color : '#e5e7eb'
                        }}
                      />
                    ))}
                  </div>
                  <span className="strength-label" style={{ color: strengthResult.color }}>
                    Strength: {strengthResult.label}
                  </span>
                </div>
              )}

              {!isLogin && (
                <div className="password-criteria-list">
                  <div className={`criterion-item ${criteria.length ? 'valid' : ''}`}>
                    <span>{criteria.length ? '✓' : '○'}</span> 8+ Characters
                  </div>
                  <div className={`criterion-item ${criteria.uppercase ? 'valid' : ''}`}>
                    <span>{criteria.uppercase ? '✓' : '○'}</span> 1 Upper (A-Z)
                  </div>
                  <div className={`criterion-item ${criteria.number ? 'valid' : ''}`}>
                    <span>{criteria.number ? '✓' : '○'}</span> 1 Number (0-9)
                  </div>
                  <div className={`criterion-item ${criteria.special ? 'valid' : ''}`}>
                    <span>{criteria.special ? '✓' : '○'}</span> 1 Special (!@#)
                  </div>
                </div>
              )}
            </div>

            {isLogin && (
              <span
                className="forgot-password-link"
                onClick={() => setSearchParams({ mode: 'forgot' })}
              >
                Forgot password?
              </span>
            )}

            <button type="submit" className="btn-auth-submit" disabled={isLoading}>
              {isLoading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>
        )}

        <div className="auth-toggle">
          {isForgot ? (
            <>
              Remember your password?
              <span onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('mode', 'login'); return n; })}>Sign In</span>
            </>
          ) : isLogin ? (
            <>
              Don't have an account?
              <span onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('mode', 'signup'); return n; })}>Sign Up</span>
            </>
          ) : (
            <>
              Already have an account?
              <span onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('mode', 'login'); return n; })}>Log In</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;
