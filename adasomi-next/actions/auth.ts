'use server';

import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db';
import { User, type UserRole } from '@/models/User';
import { Wallet } from '@/models/Wallet';
import { getSession, dashboardPathForRole } from '@/lib/session';
import { sendVerificationEmail } from '@/lib/email';
import { generateVerificationToken, hashToken } from '@/lib/codes';
import { loginSchema, registerSchema, resendVerificationSchema } from '@/lib/validation';
import { enforceRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rateLimit';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function err(path: string, message: string): never {
    redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData): Promise<void> {
    const okRate = await enforceRateLimit('login', 20, 15 * 60 * 1000);
    if (!okRate) err('/login', RATE_LIMIT_MESSAGE);

    const parsed = loginSchema.safeParse({
        email: String(formData.get('email') || ''),
        password: String(formData.get('password') || '')
    });
    if (!parsed.success) err('/login', parsed.error.issues[0].message);

    await connectDB();
    const email = parsed.data.email.toLowerCase().trim();
    const user = await User.findOne({ email });

    if (!user || !user.isActive) err('/login', 'Invalid email or password.');

    const match = await user.comparePassword(parsed.data.password);
    if (!match) err('/login', 'Invalid email or password.');

    if (!user.isEmailVerified) {
        redirect(
            `/verify-notice?email=${encodeURIComponent(user.email)}&error=${encodeURIComponent(
                'Please verify your email address before logging in.'
            )}`
        );
    }

    const session = await getSession();
    session.user = {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        merchantInfo: user.merchantInfo,
        riderInfo: user.riderInfo
            ? {
                  licenseNumber: user.riderInfo.licenseNumber,
                  vehicleType: user.riderInfo.vehicleType,
                  vehiclePlate: user.riderInfo.vehiclePlate,
                  kycStatus: user.riderInfo.kycStatus,
                  isAvailable: user.riderInfo.isAvailable
              }
            : undefined
    };
    await session.save();

    redirect(dashboardPathForRole(user.role));
}

export async function registerAction(formData: FormData): Promise<void> {
    const okRate = await enforceRateLimit('register', 20, 15 * 60 * 1000);
    if (!okRate) err('/register', RATE_LIMIT_MESSAGE);

    const raw = {
        firstName: String(formData.get('firstName') || ''),
        lastName: String(formData.get('lastName') || ''),
        email: String(formData.get('email') || ''),
        phone: String(formData.get('phone') || ''),
        password: String(formData.get('password') || ''),
        role: String(formData.get('role') || ''),
        businessName: String(formData.get('businessName') || ''),
        businessType: String(formData.get('businessType') || ''),
        address: String(formData.get('address') || ''),
        licenseNumber: String(formData.get('licenseNumber') || ''),
        vehicleType: String(formData.get('vehicleType') || ''),
        vehiclePlate: String(formData.get('vehiclePlate') || ''),
        kycNotes: String(formData.get('kycNotes') || '')
    };

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) err('/register', parsed.error.issues[0].message);
    const data = parsed.data;

    await connectDB();
    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) err('/register', 'An account with that email already exists.');

    const { raw: rawToken, hash } = generateVerificationToken();

    const userData: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: normalizedEmail,
        phone: data.phone,
        password: data.password,
        role: data.role as UserRole,
        isEmailVerified: false,
        emailVerificationTokenHash: hash,
        emailVerificationExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
    };

    if (data.role === 'merchant') {
        userData.merchantInfo = {
            businessName: data.businessName,
            businessType: data.businessType,
            address: data.address
        };
    }
    if (data.role === 'rider') {
        userData.riderInfo = {
            licenseNumber: data.licenseNumber,
            vehicleType: data.vehicleType,
            vehiclePlate: data.vehiclePlate,
            kycNotes: data.kycNotes,
            kycStatus: 'submitted'
        };
    }

    const user = await User.create(userData);

    if (data.role === 'merchant' || data.role === 'rider') {
        await Wallet.create({ owner: user._id, role: data.role, balance: 0 });
    }

    await sendVerificationEmail(user, rawToken);

    redirect(`/verify-notice?email=${encodeURIComponent(user.email)}`);
}

export async function logoutAction(): Promise<void> {
    const session = await getSession();
    session.destroy();
    redirect('/login');
}

export async function resendVerificationAction(formData: FormData): Promise<void> {
    const okRate = await enforceRateLimit('resend-verification', 20, 15 * 60 * 1000);
    if (!okRate) err('/verify-notice', RATE_LIMIT_MESSAGE);

    const parsed = resendVerificationSchema.safeParse({
        email: String(formData.get('email') || '')
    });
    if (!parsed.success) err('/verify-notice', parsed.error.issues[0].message);

    await connectDB();
    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (user && !user.isEmailVerified) {
        const { raw, hash } = generateVerificationToken();
        user.emailVerificationTokenHash = hash;
        user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
        await user.save();
        await sendVerificationEmail(user, raw);
    }

    // Same message whether or not the account exists/was already verified,
    // so this endpoint can't be used to enumerate registered emails.
    redirect(
        `/verify-notice?email=${encodeURIComponent(normalizedEmail)}&success=${encodeURIComponent(
            "If that email needs verifying, a new link is on its way."
        )}`
    );
}
