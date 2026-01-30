import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes';
import { useAuth } from '../../hooks';
import { MockdLogo } from '../common';

interface NavbarProps {

};

export const Navbar: React.FC<NavbarProps> = () => {
    const { user, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    }

    return (
        <div className="navbar bg-base-100 max-w-7xl mx-auto">
            <div className="navbar-start">
                <div className="dropdown">
                    <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h8m-8 6h16" /> </svg>
                    </div>
                    <ul
                        tabIndex={-1}
                        className="menu menu-sm dropdown-content bg-base-100 rounded-box z-1 mt-3 w-52 p-2 shadow">
                        <li><a href={ROUTES.pricing()}>Pricing</a></li>
                    </ul>
                </div>
                <a className="btn btn-ghost" href={ROUTES.home()}>
                    <MockdLogo size="sm" />
                </a>
            </div>
            <div className="navbar-center hidden lg:flex">
                <ul className="menu menu-horizontal px-1">
                    <li><a href={ROUTES.pricing()}>Pricing</a></li>
                </ul>
            </div>
            <div className="navbar-end">
                {!authLoading && (
                    user ? (
                        <div className="dropdown dropdown-end">
                            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle w-12">
                                <div className="avatar avatar-placeholder">
                                    <div className="bg-base-200 text-base-content w-12 rounded-full">
                                        <span className="text-xl">{user.email.charAt(0).toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>
                            <ul
                                tabIndex={-1}
                                className="menu menu-sm dropdown-content bg-base-200 rounded-box z-1 mt-3 w-52 p-2 shadow">
                                <li onClick={handleLogout}><a>Log out</a></li>
                            </ul>
                        </div>
                    ) : (
                        <a className="btn" href={ROUTES.auth.login()}>Log in</a>
                    )
                )}
            </div>
        </div>
    );
}