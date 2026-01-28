import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';

function getApiBaseUrl(): string {
  if (import.meta.env.DEV) {
    return 'http://localhost:8787';
  }
  return '';
}

export function AuthVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');
  const errorParam = searchParams.get('error');

  useEffect(() => {
    // Handle error from redirect
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        invalid_token: 'This link is invalid. Please request a new one.',
        token_used: 'This link has already been used. Please request a new one.',
        token_expired: 'This link has expired. Please request a new one.',
      };
      setError(errorMessages[errorParam] || 'An error occurred. Please try again.');
      return;
    }

    // Redirect to API verify endpoint
    if (token) {
      window.location.href = `${getApiBaseUrl()}/api/auth/magic-link/verify?token=${encodeURIComponent(token)}`;
    } else {
      setError('No verification token provided.');
    }
  }, [token, errorParam, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              to="/login"
              className="inline-block w-full py-2 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="w-12 h-12 mx-auto mb-4 animate-spin border-4 border-blue-600 border-t-transparent rounded-full"></div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Verifying</h1>
          <p className="text-gray-600">Please wait while we sign you in...</p>
        </div>
      </div>
    </div>
  );
}
