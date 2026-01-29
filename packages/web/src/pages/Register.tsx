import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks';
import { MockdLogo } from '../components/common';

export function Register() {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError(null);

    if (password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }

    try {
      await register({ email, password });
      navigate('/', { replace: true });
    } catch {
      // Error is handled by useAuth
    }
  };

  const displayError = validationError || error;

  return (
    <div className="flex-1 bg-base-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <MockdLogo size="md" className="mx-auto" />
          <p className="mt-2 text-base-content/70">Create your account</p>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <div className="alert alert-error mb-4">
                {displayError}
              </div>
            )}

            <div className="form-control">
              <label htmlFor="email" className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
              />
            </div>

            <div className="form-control">
              <label htmlFor="password" className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="input input-bordered w-full"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="form-control">
              <label htmlFor="confirmPassword" className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="input input-bordered w-full"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-base-content/70">
            Already have an account?{' '}
            <Link to="/login" className="link link-primary">
              Sign in
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to="/" className="link link-hover text-sm text-base-content/70">
            Continue without signing in
          </Link>
        </div>
      </div>
    </div>
  );
}
