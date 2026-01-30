import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';

interface PricingTier {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: string;
    ctaLink: string;
    highlighted?: boolean;
}

const tiers: PricingTier[] = [
    {
        name: 'Anonymous',
        price: 'Free',
        period: '',
        description: 'Try mockd instantly without signing up',
        features: [
            '1 temporary project',
            '5 endpoints per project',
            '24-hour data retention',
            'Basic mock responses',
            'Request logging',
        ],
        cta: 'Start Now',
        ctaLink: '/',
    },
    {
        name: 'Free',
        price: '$0',
        period: '/month',
        description: 'For developers getting started with API mocking',
        features: [
            '3 projects',
            '10 endpoints per project',
            '7-day data retention',
            'Custom subdomains',
            'Request logging',
            'Mock rules & conditions',
        ],
        cta: 'Sign Up Free',
        ctaLink: '/register',
    },
    {
        name: 'Pro',
        price: '$12',
        period: '/month',
        description: 'For professionals who need more power',
        features: [
            'Unlimited projects',
            'Unlimited endpoints',
            '30-day data retention',
            'Custom subdomains',
            'Advanced mock rules',
            'Priority support',
            'Webhooks & callbacks',
            'Response templates',
        ],
        cta: 'Get Pro',
        ctaLink: '/register',
        highlighted: true,
    },
];

function CheckIcon() {
    return (
        <svg
            className="w-5 h-5 text-success shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
            />
        </svg>
    );
}

function PricingCard({ tier }: { tier: PricingTier }) {
    return (
        <div
            className={`card bg-base-100 shadow-sm border ${
                tier.highlighted
                    ? 'border-primary ring-2 ring-primary ring-offset-2 ring-offset-base-100'
                    : 'border-base-200'
            }`}
        >
            {tier.highlighted && (
                <div className="bg-primary text-primary-content text-center py-1 text-sm font-medium rounded-t-2xl">
                    Most Popular
                </div>
            )}
            <div className="card-body">
                <h3 className="card-title text-xl">{tier.name}</h3>
                <div className="mt-2">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && (
                        <span className="text-base-content/60">{tier.period}</span>
                    )}
                </div>
                <p className="text-base-content/70 mt-2">{tier.description}</p>

                <ul className="mt-6 space-y-3">
                    {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                            <CheckIcon />
                            <span className="text-base-content/80">{feature}</span>
                        </li>
                    ))}
                </ul>

                <div className="card-actions mt-8">
                    <Link
                        to={tier.ctaLink}
                        className={`btn w-full ${
                            tier.highlighted ? 'btn-primary' : 'btn-outline'
                        }`}
                    >
                        {tier.cta}
                    </Link>
                </div>
            </div>
        </div>
    );
}

export function Pricing() {
    return (
        <div className="min-h-screen bg-base-100">
            <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Simple, transparent pricing
                    </h1>
                    <p className="mt-4 text-lg text-base-content/70 max-w-2xl mx-auto">
                        Start mocking APIs instantly with our free tier, or upgrade
                        for more power and features.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {tiers.map((tier) => (
                        <PricingCard key={tier.name} tier={tier} />
                    ))}
                </div>

                {/* FAQ or additional info */}
                <div className="mt-16 text-center">
                    <p className="text-base-content/60">
                        All plans include SSL, WebSocket support, and real-time request logging.
                    </p>
                    <p className="text-base-content/60 mt-2">
                        Questions?{' '}
                        <a
                            href="mailto:support@mockd.sh"
                            className="link link-primary"
                        >
                            Contact us
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
}
