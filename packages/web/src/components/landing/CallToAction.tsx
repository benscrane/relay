import { Link } from 'react-router-dom';

interface CallToActionProps {
  onQuickStart: () => void;
  isLoading?: boolean;
}

export function CallToAction({ onQuickStart, isLoading }: CallToActionProps) {
  return (
    <section className="py-20 bg-base-100">
      <div className="max-w-3xl mx-auto px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-base-content">
          Ready to mock your first API?
        </h2>
        <p className="mt-4 text-lg text-base-content/60">
          Start capturing requests in under 30 seconds. No credit card, no server, no config.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={onQuickStart}
            disabled={isLoading}
            className="btn btn-primary btn-lg"
          >
            {isLoading ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              'Try It Now — Free'
            )}
          </button>
          <Link to="/pricing" className="btn btn-outline btn-lg">
            View Pricing
          </Link>
        </div>
        <p className="mt-6 text-sm text-base-content/40">
          Free tier includes 3 projects, 10 endpoints each, and 7-day data retention.
        </p>
      </div>
    </section>
  );
}
