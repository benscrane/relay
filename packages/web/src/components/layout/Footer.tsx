import React from 'react';
import { useAuth } from '../../hooks';
import { ROUTES } from '../../routes';

export const Footer: React.FC = () => {
    const { user } = useAuth();

    return (
        <footer className="footer footer-center bg-base-100 text-base-content p-4">
            <nav className="flex gap-4">
                {user && <a href={ROUTES.pricing()} className="link link-hover">Pricing</a>}
            </nav>
            <aside>
                <p>© {new Date().getFullYear()} mockd</p>
            </aside>
        </footer>
    );
};
