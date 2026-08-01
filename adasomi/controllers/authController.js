const User = require('../models/User');
const Wallet = require('../models/Wallet');
const emailService = require('../services/emailService');
const { generateVerificationToken, hashToken } = require('../utils/codes');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

exports.getLogin = (req, res) => {
    res.render('login', { title: 'Login' });
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.isActive) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }
        const match = await user.comparePassword(password);
        if (!match) {
            req.flash('error', 'Invalid email or password.');
            return res.redirect('/login');
        }

        if (!user.isEmailVerified) {
            req.flash('error', 'Please verify your email address before logging in. Check your inbox for the verification link.');
            return res.redirect(`/verify-notice?email=${encodeURIComponent(user.email)}`);
        }

        req.session.user = {
            id: user._id.toString(),
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName} ${user.lastName}`,
            email: user.email,
            role: user.role,
            merchantInfo: user.merchantInfo,
            riderInfo: user.riderInfo
        };

        req.session.save(() => {
            switch (user.role) {
                case 'merchant': return res.redirect('/merchant/dashboard');
                case 'rider': return res.redirect('/rider/dashboard');
                case 'public_user': return res.redirect('/customer/dashboard');
                case 'admin': return res.redirect('/admin/dashboard');
                default: return res.redirect('/');
            }
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong logging you in.');
        res.redirect('/login');
    }
};

exports.getRegister = (req, res) => {
    res.render('register', { title: 'Create Account' });
};

exports.postRegister = async (req, res) => {
    try {
        const {
            firstName, lastName, email, phone, password, role,
            businessName, businessType, address,
            licenseNumber, vehicleType, vehiclePlate, kycNotes
        } = req.body;

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            req.flash('error', 'An account with that email already exists.');
            return res.redirect('/register');
        }

        if (!['merchant', 'rider', 'public_user'].includes(role)) {
            req.flash('error', 'Please select a valid account type.');
            return res.redirect('/register');
        }

        const { raw, hash } = generateVerificationToken();

        const userData = {
            firstName, lastName,
            email: normalizedEmail,
            phone, password, role,
            isEmailVerified: false,
            emailVerificationTokenHash: hash,
            emailVerificationExpires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)
        };

        if (role === 'merchant') {
            userData.merchantInfo = { businessName, businessType, address };
        }
        if (role === 'rider') {
            userData.riderInfo = {
                licenseNumber, vehicleType, vehiclePlate, kycNotes,
                kycStatus: 'submitted'
            };
        }

        const user = await User.create(userData);

        if (role === 'merchant' || role === 'rider') {
            await Wallet.create({ owner: user._id, role, balance: 0 });
        }

        await emailService.sendVerificationEmail(user, raw);

        req.flash('success', 'Account created! Check your email for a verification link before logging in.');
        res.redirect(`/verify-notice?email=${encodeURIComponent(user.email)}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong creating your account: ' + err.message);
        res.redirect('/register');
    }
};

exports.getVerifyNotice = (req, res) => {
    res.render('verify-notice', { title: 'Verify Your Email', email: req.query.email || '' });
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        req.flash('error', 'Missing verification token.');
        return res.redirect('/login');
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationTokenHash +emailVerificationExpires');

    if (!user) {
        req.flash('error', 'That verification link is invalid or has expired. Request a new one below.');
        return res.redirect('/verify-notice');
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    req.flash('success', 'Email verified! You can now log in.');
    res.redirect('/login');
};

exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (normalizedEmail) {
            const user = await User.findOne({ email: normalizedEmail });
            if (user && !user.isEmailVerified) {
                const { raw, hash } = generateVerificationToken();
                user.emailVerificationTokenHash = hash;
                user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
                await user.save();
                await emailService.sendVerificationEmail(user, raw);
            }
        }

        // Same message whether or not the account exists/was already verified,
        // so this endpoint can't be used to enumerate registered emails.
        req.flash('success', 'If that email needs verifying, a new link is on its way.');
        res.redirect(`/verify-notice?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (err) {
        console.error(err);
        req.flash('error', 'Something went wrong. Please try again.');
        res.redirect('/verify-notice');
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};
