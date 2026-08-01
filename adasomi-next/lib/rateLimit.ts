import { headers } from 'next/headers';

// Simple in-memory sliding-window limiter. Good enough for a single-instance
// deployment; on a multi-instance/serverless platform each instance keeps its
// own counters, so treat this as a best-effort guard, not a hard guarantee.
const attempts = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || now > entry.resetAt) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= max) return false;
    entry.count += 1;
    return true;
}

export async function getClientIp(): Promise<string> {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return h.get('x-real-ip') || 'unknown';
}

// Returns true if the request is within limits, false if it should be
// rejected. Deliberately does NOT throw, so callers (Server Actions) can
// `redirect()` on failure without a try/catch swallowing that redirect.
export async function enforceRateLimit(action: string, max = 20, windowMs = 15 * 60 * 1000): Promise<boolean> {
    const ip = await getClientIp();
    return checkRateLimit(`${action}:${ip}`, max, windowMs);
}

export const RATE_LIMIT_MESSAGE = 'Too many attempts from this device. Please wait a few minutes and try again.';
