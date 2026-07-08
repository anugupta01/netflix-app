import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function messageFor(error) {
  const code = error?.response?.data?.error?.code;
  const serverMessage = error?.response?.data?.error?.message;
  switch (code) {
    case 'EMAIL_IN_USE':
      return 'An account with this email already exists. Try signing in instead.';
    case 'VALIDATION_ERROR':
      return serverMessage;
    default:
      return 'Something went wrong creating your account. Please try again.';
  }
}

export default function SignUp() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup(form.email, form.password, form.name);
      navigate('/', { replace: true });
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1>Create your account</h1>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="name">Name</label>
          <input id="name" required value={form.name} onChange={update('name')} />

          <label htmlFor="email">Email</label>
          <input id="email" type="email" required autoComplete="email" value={form.email} onChange={update('email')} />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={10}
            value={form.password}
            onChange={update('password')}
          />
          <p className="field-hint">At least 10 characters, mixing upper/lowercase, digits, or symbols.</p>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account\u2026' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
