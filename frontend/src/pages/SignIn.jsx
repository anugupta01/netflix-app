import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Maps backend error codes (see backend/src/lib/errors.ts) to copy a person
// can act on, instead of showing a raw "Request failed with status code 401".
function messageFor(error) {
  const code = error?.response?.data?.error?.code;
  const serverMessage = error?.response?.data?.error?.message;
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return 'That email and password combination doesn\u2019t match our records.';
    case 'ACCOUNT_LOCKED':
      return serverMessage;
    case 'ACCOUNT_DEACTIVATED':
      return 'This account has been deactivated. Contact support to restore access.';
    case 'DEVICE_LIMIT_REACHED':
      return serverMessage;
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a minute before trying again.';
    default:
      return 'Something went wrong signing you in. Please try again.';
  }
}

export default function SignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Sign in</h1>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in\u2026' : 'Sign in'}
          </button>
        </form>
        <p className="auth-switch">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
