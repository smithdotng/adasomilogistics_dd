import Image from 'next/image';
import Link from 'next/link';
import { resendVerificationAction } from '@/actions/auth';
import FlashMessage from '@/components/FlashMessage';

export const metadata = { title: 'Verify Your Email' };

export default async function VerifyNoticePage({
    searchParams
}: {
    searchParams: Promise<{ email?: string; success?: string; error?: string; info?: string }>;
}) {
    const params = await searchParams;
    const email = params.email || '';

    return (
        <div className="auth-wrapper">
            <div className="container">
                <div className="auth-card" style={{ maxWidth: 560 }}>
                    <div className="auth-right" style={{ padding: '55px 50px' }}>
                        <div className="text-center mb-4">
                            <Image src="/images/logo.png" alt="Adasomi Logistics" width={160} height={64} className="brand-logo mb-3" />
                            <div className="stat-icon mx-auto mb-3" style={{ width: 64, height: 64, fontSize: 26 }}>
                                <i className="fa-solid fa-envelope-circle-check"></i>
                            </div>
                            <h3 className="mb-2">Check your inbox</h3>
                            <p className="text-muted mb-0">
                                We&apos;ve sent a verification link to {email ? <strong>{email}</strong> : 'your email address'}.
                                Click it to activate your account, then come back and log in.
                            </p>
                        </div>

                        <FlashMessage success={params.success} error={params.error} info={params.info} />

                        <form action={resendVerificationAction}>
                            <label className="form-label" htmlFor="resend-email">Didn&apos;t get it? Resend the link</label>
                            <div className="d-flex gap-2">
                                <input
                                    type="email"
                                    className="form-control"
                                    id="resend-email"
                                    name="email"
                                    defaultValue={email}
                                    required
                                    placeholder="you@example.com"
                                />
                                <button type="submit" className="btn btn-peach">Resend</button>
                            </div>
                        </form>

                        <div className="text-center mt-4 text-muted">
                            <Link href="/login">Back to login</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
