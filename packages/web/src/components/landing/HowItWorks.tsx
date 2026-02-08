const STEPS = [
  {
    number: '1',
    title: 'Create an endpoint',
    description:
      'Pick a path, set the response body, status code, and headers. Or use a template to get started instantly.',
    code: `POST /api/projects
{
  "name": "my-app",
  "subdomain": "my-app"
}`,
  },
  {
    number: '2',
    title: 'Send requests to it',
    description:
      'Point your app, webhook provider, or curl at your mock URL. It accepts any HTTP method.',
    code: `curl -X POST \\
  https://my-app.mockd.sh/api/webhooks \\
  -H "Content-Type: application/json" \\
  -d '{"event": "user.signup"}'`,
  },
  {
    number: '3',
    title: 'Inspect everything',
    description:
      'Requests appear instantly in your dashboard via WebSocket. See method, headers, body, query params, and timing.',
    code: `{
  "method": "POST",
  "path": "/api/webhooks",
  "headers": { "content-type": "application/json" },
  "body": { "event": "user.signup" },
  "timestamp": "2025-01-15T10:30:00Z"
}`,
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 bg-base-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold tracking-tight text-base-content">
            Up and running in 30 seconds
          </h2>
          <p className="mt-4 text-lg text-base-content/60 max-w-2xl mx-auto">
            No sign-up required. Create a mock endpoint and start capturing requests immediately.
          </p>
        </div>

        <div className="space-y-12 max-w-4xl mx-auto">
          {STEPS.map((step, i) => (
            <div
              key={step.number}
              className={`flex flex-col md:flex-row gap-8 items-start ${
                i % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              {/* Text */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-content font-bold text-sm">
                    {step.number}
                  </span>
                  <h3 className="text-xl font-semibold text-base-content">
                    {step.title}
                  </h3>
                </div>
                <p className="text-base-content/60 leading-relaxed pl-11">
                  {step.description}
                </p>
              </div>

              {/* Code block */}
              <div className="flex-1 w-full">
                <div className="rounded-lg overflow-hidden border border-base-300 bg-neutral text-neutral-content shadow-sm">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-neutral-focus border-b border-base-content/10">
                    <div className="w-2.5 h-2.5 rounded-full bg-error/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-warning/50" />
                    <div className="w-2.5 h-2.5 rounded-full bg-success/50" />
                  </div>
                  <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed">
                    <code>{step.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
