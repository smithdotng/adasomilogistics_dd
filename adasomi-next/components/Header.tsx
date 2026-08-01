'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/actions/auth';
import type { SessionUser } from '@/lib/session';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
    const pathname = usePathname();
    const active = pathname === href || pathname.startsWith(href + '/');
    return (
        <li className="nav-item">
            <Link className={`nav-link ${active ? 'active' : ''}`} href={href}>
                {children}
            </Link>
        </li>
    );
}

export default function Header({ user }: { user: SessionUser | null }) {
    return (
        <header className="app-header">
            <nav className="navbar navbar-expand-lg">
                <div className="container">
                    <Link className="navbar-brand" href="/">
                        <Image src="/images/logo.png" alt="Adasomi Logistics" width={144} height={58} className="navbar-logo" priority />
                    </Link>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#appNav">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="appNav">
                        {user ? (
                            <>
                                <ul className="navbar-nav me-auto">
                                    {user.role === 'merchant' && (
                                        <>
                                            <NavLink href="/merchant/dashboard">Dashboard</NavLink>
                                            <NavLink href="/merchant/riders">Fleet &amp; Riders</NavLink>
                                            <NavLink href="/merchant/orders">Orders</NavLink>
                                            <NavLink href="/merchant/wallet">Wallet</NavLink>
                                        </>
                                    )}
                                    {user.role === 'rider' && (
                                        <>
                                            <NavLink href="/rider/dashboard">Dashboard</NavLink>
                                            <NavLink href="/rider/verification">Verification</NavLink>
                                            <NavLink href="/rider/orders">Available Deliveries</NavLink>
                                            <NavLink href="/rider/my-deliveries">My Deliveries</NavLink>
                                            <NavLink href="/rider/wallet">Wallet</NavLink>
                                        </>
                                    )}
                                    {user.role === 'public_user' && (
                                        <>
                                            <NavLink href="/customer/dashboard">My Requests</NavLink>
                                            <NavLink href="/customer/orders/new">Request a Rider</NavLink>
                                        </>
                                    )}
                                    {user.role === 'admin' && (
                                        <>
                                            <NavLink href="/admin/dashboard">Dashboard</NavLink>
                                            <NavLink href="/admin/riders">Rider KYC</NavLink>
                                            <NavLink href="/admin/orders">Orders</NavLink>
                                            <NavLink href="/admin/disputes">Disputes</NavLink>
                                            <NavLink href="/admin/config">Config</NavLink>
                                        </>
                                    )}
                                </ul>
                                <div className="d-flex align-items-center gap-3">
                                    <span className="role-chip">{user.role.replace('_', ' ')}</span>
                                    <span className="text-muted small d-none d-md-inline">{user.fullName}</span>
                                    <form action={logoutAction}>
                                        <button className="btn btn-outline-peach btn-sm" type="submit">
                                            <i className="fa-solid fa-right-from-bracket me-1"></i>Logout
                                        </button>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <ul className="navbar-nav ms-auto align-items-lg-center gap-lg-2">
                                <li className="nav-item">
                                    <Link className="nav-link" href="/how-it-works">
                                        How It Works
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="nav-link" href="/login">
                                        Login
                                    </Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="btn btn-peach btn-sm" href="/register">
                                        Get Started
                                    </Link>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </nav>
        </header>
    );
}
