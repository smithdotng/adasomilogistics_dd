import Image from 'next/image';
import Link from 'next/link';
import { loginAction } from '@/actions/auth';
import FlashMessage from '@/components/FlashMessage';
import Scooter from '@/components/illustrations/Scooter';

export const metadata = { title: 'Login' };

export default async function LoginPage({
    searchParams
}: {
    searchParams: Promise<{ success?: string; error?: string; info?: string }>;
}) {
    const params = await searchParams;

    return (
        <div className="auth-wrapper">
            <div className="container">
                <div className="auth-card">
                    <div className="row g-0">
                        <div className="col-lg-6">
                            <div className="auth-left">
                                <h2>Welcome back to Adasomi</h2>
                                <p>Sign in to dispatch orders, accept deliveries, or track your request in real time.</p>
                                <ul className="feature-list">
                                    <li><i className="fa-solid fa-check"></i><span>Escrow-secured payments</span></li>
                                    <li><i className="fa-solid fa-check"></i><span>Verified rider fleets</span></li>
                                    <li><i className="fa-solid fa-check"></i><span>Live GPS delivery tracking</span></li>
                                    <li><i className="fa-solid fa-check"></i><span>Instant payout settlement</span></li>
                                </ul>
                                <div className="auth-role-badges">
                                    <span className="auth-role-badge">Merchants</span>
                                    <span className="auth-role-badge">Riders</span>
                                    <span className="auth-role-badge">Public Users</span>
                                </div>
                                <p className="small mt-2 mb-0" style={{ opacity: 0.85 }}>
                                    Merchants = restaurant owners, food processors, food vendors &amp; produce aggregators.
                                </p>
                                <div className="auth-illust">
                                    <Scooter />
                                </div>
                            </div>
                        </div>
                        <div className="col-lg-6">
                            <div className="auth-right">
                                <div className="text-center mb-4">
                                    <Image src="/images/logo.png" alt="Adasomi Logistics" width={160} height={64} className="brand-logo mb-2" />
                                    <p className="text-muted">Sign in to your account</p>
                                </div>

                                <FlashMessage success={params.success} error={params.error} info={params.info} />

                                <form action={loginAction}>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="email">Email Address</label>
                                        <input type="email" className="form-control" id="email" name="email" required autoFocus placeholder="you@example.com" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="password">Password</label>
                                        <input type="password" className="form-control" id="password" name="password" required placeholder="••••••••" />
                                    </div>
                                    <button type="submit" className="btn btn-peach w-100 mt-2">
                                        <i className="fa-solid fa-right-to-bracket me-2"></i>Sign In
                                    </button>
                                </form>

                                <div className="text-center mt-4 text-muted">
                                    Don&apos;t have an account? <Link href="/register">Create one</Link>
                                </div>
                                <div className="text-center mt-2 text-muted small">
                                    Need to verify your email? <Link href="/verify-notice">Resend the link</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
