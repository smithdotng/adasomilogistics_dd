import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { hashToken } from '@/lib/codes';

export const metadata = { title: 'Verify Email' };

export default async function VerifyEmailPage({
    searchParams
}: {
    searchParams: Promise<{ token?: string }>;
}) {
    const { token } = await searchParams;

    if (!token) {
        redirect(`/login?error=${encodeURIComponent('Missing verification token.')}`);
    }

    await connectDB();
    const tokenHash = hashToken(token);
    const user = await User.findOne({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationTokenHash +emailVerificationExpires');

    if (!user) {
        redirect(
            `/verify-notice?error=${encodeURIComponent(
                'That verification link is invalid or has expired. Request a new one below.'
            )}`
        );
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    redirect(`/login?success=${encodeURIComponent('Email verified! You can now log in.')}`);
}
