import { useState, FormEvent, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks';
import { ROUTES } from '../routes';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loading, error, clearError, sendMagicLink, loginWithGitHub, magicLinkSent, magicLinkEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  // Handle OAuth/magic link error from URL params
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_denied: 'GitHub authorization was denied.',
        invalid_callback: 'Invalid OAuth callback.',
        invalid_state: 'Invalid OAuth state. Please try again.',
        state_expired: 'OAuth session expired. Please try again.',
        token_exchange_failed: 'Failed to authenticate with GitHub.',
        no_email: 'Could not retrieve email from GitHub. Please make sure your email is public or verified.',
        invalid_token: 'Invalid magic link. Please request a new one.',
        token_used: 'This magic link has already been used.',
        token_expired: 'This magic link has expired.',
      };
      setOauthError(errorMessages[errorParam] || 'An error occurred. Please try again.');
    }
  }, [searchParams]);

  const handleMagicLinkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setOauthError(null);

    try {
      await sendMagicLink(email);
    } catch {
      // Error is handled by useAuth
    }
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setOauthError(null);

    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch {
      // Error is handled by useAuth
    }
  };

  const handleGitHubLogin = () => {
    clearError();
    setOauthError(null);
    loginWithGitHub();
  };

  // Show success message if magic link was sent
  if (magicLinkSent && magicLinkEmail) {
    return (
      <div className="flex-1 bg-base-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-base-content">Relay</h1>
          </div>

          <div className="card bg-base-200 shadow-sm">
            <div className="card-body text-center">
              <div className="w-12 h-12 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-base-content mb-2">Check your email</h2>
              <p className="text-base-content/70 mb-4">
                We sent a sign-in link to <span className="font-medium">{magicLinkEmail}</span>
              </p>
              <p className="text-sm text-base-content/50">
                The link will expire in 15 minutes.
              </p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-ghost btn-sm"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-base-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-base-content">Relay</h1>
          <p className="mt-2 text-base-content/70">Sign in to your account</p>
        </div>

        <div className="p-6">
          {(error || oauthError) && (
            <div className="alert alert-error mb-4">
              {error || oauthError}
            </div>
          )}

          {/* GitHub OAuth Button */}
          <button
            onClick={handleGitHubLogin}
            disabled={loading}
            className="btn btn-block btn-outline"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
            Continue with GitHub
          </button>

          <div className="divider">or</div>

          {showPasswordLogin ? (
            /* Password Login Form */
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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
                  autoComplete="current-password"
                  className="input input-bordered w-full"
                  placeholder="Enter your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <button
                type="button"
                onClick={() => setShowPasswordLogin(false)}
                className="btn btn-ghost btn-sm w-full"
              >
                Sign in with magic link instead
              </button>
            </form>
          ) : (
            /* Magic Link Form */
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? 'Sending...' : 'Send magic link'}
              </button>

              <button
                type="button"
                onClick={() => setShowPasswordLogin(true)}
                className="btn btn-ghost btn-sm w-full"
              >
                Sign in with password instead
              </button>
            </form>
          )}

          <div className="mt-4 text-center text-sm text-base-content/70">
            Don't have an account?{' '}
            <Link to="/register" className="link link-primary">
              Sign up
            </Link>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Link to={ROUTES.home()} className="link link-hover text-sm text-base-content/70">
            Continue without signing in
          </Link>
        </div>
      </div>
    </div>
  );
}
