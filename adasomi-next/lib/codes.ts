import crypto from 'crypto';

export function generateNumericCode(length = 4): string {
    let code = '';
    for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
    return code;
}

export function generateOrderNumber(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ADS-${stamp}-${rand}`;
}

// Returns { raw, hash }. Send `raw` in the email link; store only `hash` in
// the database, so a database leak alone can't be used to verify accounts.
export function generateVerificationToken(): { raw: string; hash: string } {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
}

export function hashToken(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
}
