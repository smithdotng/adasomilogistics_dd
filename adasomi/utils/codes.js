const crypto = require('crypto');

function generateNumericCode(length = 4) {
    let code = '';
    for (let i = 0; i < length; i++) code += Math.floor(Math.random() * 10);
    return code;
}

function generateOrderNumber() {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ADS-${stamp}-${rand}`;
}

// Returns { raw, hash }. Send `raw` in the email link; store only `hash` in
// the database, so a database leak alone can't be used to verify accounts.
function generateVerificationToken() {
    const raw = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, hash };
}

function hashToken(raw) {
    return crypto.createHash('sha256').update(raw).digest('hex');
}

module.exports = { generateNumericCode, generateOrderNumber, generateVerificationToken, hashToken };
