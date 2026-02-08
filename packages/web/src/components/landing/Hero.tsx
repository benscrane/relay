import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

interface HeroProps {
  onQuickStart: () => void;
  isLoading?: boolean;
}

export function Hero({ onQuickStart, isLoading }: HeroProps) {
  const [animStep, setAnimStep] = useState(0);

  // Auto-advance the terminal animation
  useEffect(() => {
    const timers = [
      setTimeout(() => setAnimStep(1), 800),
      setTimeout(() => setAnimStep(2), 1800),
      setTimeout(() => setAnimStep(3), 2600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 pt-16 pb-20 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-base-content leading-tight">
              Mock APIs in seconds.{' '}
              <span className="text-primary">Debug webhooks in real time.</span>
            </h1>
            <p className="mt-6 text-lg text-base-content/70 max-w-xl leading-relaxed">
              Create mock API endpoints at{' '}
              <code className="text-primary font-mono text-base bg-primary/10 px-1.5 py-0.5 rounded">
                your-project.mockd.sh
              </code>{' '}
              — capture, inspect, and replay HTTP requests without writing a single line of server code.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onQuickStart}
                disabled={isLoading}
                className="btn btn-primary btn-lg"
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  <>
                    Start Mocking — Free
                    <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
              <Link to="/register" className="btn btn-outline btn-lg">
                Sign Up Free
              </Link>
            </div>
            <p className="mt-4 text-sm text-base-content/50">
              No account required to start. Create a mock endpoint in under 30 seconds.
            </p>
          </div>

          {/* Right: Terminal mockup */}
          <div className="hidden lg:block">
            <TerminalDemo animStep={animStep} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TerminalDemo({ animStep }: { animStep: number }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-base-300 bg-neutral text-neutral-content">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-focus border-b border-base-content/10">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-error/70" />
          <div className="w-3 h-3 rounded-full bg-warning/70" />
          <div className="w-3 h-3 rounded-full bg-success/70" />
        </div>
        <span className="text-xs text-neutral-content/50 ml-2 font-mono">Terminal</span>
      </div>

      {/* Terminal body */}
      <div className="p-5 font-mono text-sm leading-relaxed space-y-3 min-h-[280px]">
        {/* Step 1: curl command */}
        <div className={`transition-opacity duration-300 ${animStep >= 0 ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-success">$</span>{' '}
          <span className="text-neutral-content/90">curl -X POST https://my-app.mockd.sh/api/webhooks \</span>
          <br />
          <span className="text-neutral-content/90 pl-4">-H "Content-Type: application/json" \</span>
          <br />
          <span className="text-neutral-content/90 pl-4">-d '{`{"event": "order.created", "id": 42}`}'</span>
        </div>

        {/* Step 2: Response */}
        {animStep >= 1 && (
          <div className="transition-opacity duration-500 opacity-100">
            <div className="border-l-2 border-success/40 pl-3 mt-2">
              <span className="text-success text-xs">HTTP/1.1 200 OK</span>
              <pre className="text-info/80 text-xs mt-1">{`{
  "status": "received",
  "id": "req_8f3k2j",
  "timestamp": "${new Date().toISOString().split('T')[0]}"
}`}</pre>
            </div>
          </div>
        )}

        {/* Step 3: Live indicator */}
        {animStep >= 2 && (
          <div className="transition-opacity duration-500 opacity-100 pt-2 border-t border-neutral-content/10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <span className="text-success text-xs">Request captured — visible in your dashboard</span>
            </div>
          </div>
        )}

        {/* Step 4: Details */}
        {animStep >= 3 && (
          <div className="transition-opacity duration-500 opacity-100 text-xs text-neutral-content/50">
            <span>Method: POST | Status: 200 | Time: 12ms | Body: 48 bytes</span>
          </div>
        )}
      </div>
    </div>
  );
}
