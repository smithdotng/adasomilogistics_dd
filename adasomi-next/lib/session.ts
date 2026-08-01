import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserRole } from '@/models/User';

export interface SessionUser {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    role: UserRole;
    merchantInfo?: {
        businessName?: string;
        businessType?: string;
        address?: string;
    };
    riderInfo?: {
        licenseNumber?: string;
        vehicleType?: string;
        vehiclePlate?: string;
        kycStatus?: string;
        isAvailable?: boolean;
    };
}

export interface SessionData {
    user?: SessionUser;
}

const DEV_SESSION_SECRET = 'adasomi-dev-secret-change-in-production-please-32-chars-min';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    // A missing SESSION_SECRET in production would silently fall back to a
    // secret that's checked into source control, letting anyone forge a
    // signed-in session (including admin). Fail loudly instead.
    throw new Error(
        'SESSION_SECRET environment variable is required in production. Set it in your hosting provider (e.g. Vercel ' +
        'Project Settings -> Environment Variables) to a random string at least 32 characters long.'
    );
}

const SESSION_PASSWORD = process.env.SESSION_SECRET || DEV_SESSION_SECRET;

export const sessionOptions: SessionOptions = {
    password: SESSION_PASSWORD,
    cookieName: 'adasomi_session',
    cookieOptions: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 1 day
    }
};

export async function getSession() {
    const cookieStore = await cookies();
    return getIronSession<SessionData>(cookieStore, sessionOptions);
}

/** Read the current user without redirecting. Safe to call anywhere. */
export async function getCurrentUser(): Promise<SessionUser | null> {
    const session = await getSession();
    return session.user ?? null;
}

/** Use in Server Components/Actions/Route Handlers that require any logged-in user. */
export async function requireAuth(): Promise<SessionUser> {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    return user;
}

/** Use in Server Components/Actions/Route Handlers restricted to specific roles. */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
    const user = await requireAuth();
    if (!roles.includes(user.role)) redirect('/');
    return user;
}

export function dashboardPathForRole(role: UserRole): string {
    switch (role) {
        case 'merchant':
            return '/merchant/dashboard';
        case 'rider':
            return '/rider/dashboard';
        case 'public_user':
            return '/customer/dashboard';
        case 'admin':
            return '/admin/dashboard';
        default:
            return '/login';
    }
}
