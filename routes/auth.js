const express = require('express');
const router = express.Router();
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { 
        title: 'Login - CareShed',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Login handler - FIXED WITH SESSION SAVE
router.post('/login', async (req, res) => {
    console.log('=========================================');
    console.log('LOGIN ATTEMPT at:', new Date().toISOString());
    console.log('Request body:', { ...req.body, password: '[REDACTED]' });
    console.log('IP:', req.ip);
    console.log('=========================================');
    
    try {
        const { email, password, remember } = req.body;
        
        if (!email || !password) {
            console.log('Missing email or password');
            req.flash('error', 'Please provide both email and password');
            return res.redirect('/login');
        }
        
        console.log('Looking for user with email:', email.toLowerCase());
        
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            console.log('❌ User not found for email:', email.toLowerCase());
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }
        
        console.log('✅ User found:', {
            id: user._id,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
        });
        
        if (user.isLocked && user.isLocked()) {
            console.log('❌ Account is locked until:', user.lockUntil);
            req.flash('error', 'Account is locked due to too many failed attempts. Please try again later.');
            return res.redirect('/login');
        }
        
        console.log('Comparing password...');
        const isValid = await user.comparePassword(password);
        console.log('Password valid:', isValid);
        
        if (!isValid) {
            console.log('❌ Invalid password for user:', user.email);
            
            if (user.incLoginAttempts) {
                await user.incLoginAttempts();
                console.log('Login attempts incremented');
            }
            
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }
        
        console.log('✅ Password correct! Logging in user...');
        
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();
        console.log('User login stats updated');
        
        req.session.user = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            providerId: user.providerId,
            providerInfo: user.providerInfo
        };
        
        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            console.log('Remember me set for 30 days');
        }
        
        req.flash('success', `Welcome back, ${user.firstName}!`);
        console.log('Login successful, redirecting based on role:', user.role);
        
        // Force session save before redirect
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
                req.flash('error', 'Session error. Please try again.');
                return res.redirect('/login');
            }
            
            console.log('Session saved successfully');
            
            switch(user.role) {
                case 'service_provider':
                    console.log('Redirecting to provider dashboard');
                    return res.redirect('/provider/dashboard');
                case 'operator':
                    console.log('Redirecting to operator dashboard');
                    return res.redirect('/operator/dashboard');
                case 'client':
                    console.log('Redirecting to client dashboard');
                    return res.redirect('/client/dashboard');
                case 'guardian':
                    console.log('Redirecting to guardian dashboard');
                    return res.redirect('/guardian/dashboard');
                case 'super_admin':
                    console.log('Redirecting to admin dashboard');
                    return res.redirect('/admin/dashboard');
                default:
                    console.log('Redirecting to home');
                    return res.redirect('/');
            }
        });
        
    } catch (error) {
        console.error('❌ Login error:', error);
        console.error('Error stack:', error.stack);
        req.flash('error', 'An error occurred during login. Please try again.');
        res.redirect('/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/login');
    });
});

// Forgot password page
router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
        title: 'Forgot Password - CareShed',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Forgot password handler
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            req.flash('error', 'No account found with that email address');
            return res.redirect('/forgot-password');
        }
        
        const resetToken = Math.random().toString(36).slice(-8) + 
                          Math.random().toString(36).slice(-8).toUpperCase();
        
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000;
        await user.save();
        
        req.flash('success', 'Password reset instructions have been sent to your email');
        res.redirect('/login');
    } catch (error) {
        console.error('Forgot password error:', error);
        req.flash('error', 'An error occurred');
        res.redirect('/forgot-password');
    }
});

// Register page
router.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register - CareShed',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Register handler
router.post('/register', async (req, res) => {
    console.log('POST /register called');
    console.log('Request body:', req.body);
    
    try {
        const { 
            email, password, confirmPassword, 
            firstName, lastName, phone,
            companyName, companyRegNumber, companyType, website,
            addressStreet, addressCity, addressCounty, addressPostcode,
            serviceTypes, otherServices,
            cqcRegistered, cqcLocationId, cqcRating,
            insuranceProvider, insurancePolicyNumber, insuranceExpiryDate,
            dataProtection, icoNumber,
            termsAccepted, marketingEmails
        } = req.body;
        
        console.log('Processing registration for:', email);
        
        if (password !== confirmPassword) {
            console.log('Password mismatch');
            req.flash('error', 'Passwords do not match');
            return res.redirect('/register');
        }

        if (password.length < 8) {
            console.log('Password too short');
            req.flash('error', 'Password must be at least 8 characters long');
            return res.redirect('/register');
        }
        
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('User already exists:', email);
            req.flash('error', 'Email already registered');
            return res.redirect('/register');
        }

        if (!termsAccepted) {
            console.log('Terms not accepted');
            req.flash('error', 'You must accept the Terms and Conditions');
            return res.redirect('/register');
        }
        
        let serviceTypesArray = [];
        if (serviceTypes) {
            serviceTypesArray = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
        }
        if (otherServices) {
            serviceTypesArray.push(otherServices);
        }

        let formattedPhone = phone;
        if (phone && !phone.startsWith('+44')) {
            const digits = phone.replace(/\D/g, '');
            if (digits.startsWith('0')) {
                formattedPhone = '+44' + digits.substring(1);
            } else {
                formattedPhone = '+44' + digits;
            }
        }

        console.log('Creating user...');
        
        const user = new User({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName,
            phone: formattedPhone,
            role: 'service_provider',
            address: {
                street: addressStreet,
                city: addressCity,
                county: addressCounty || '',
                postcode: addressPostcode,
                country: 'UK'
            },
            providerInfo: {
                companyName,
                companyRegNumber,
                companyType: companyType || 'limited_company',
                website: website || '',
                serviceTypes: serviceTypesArray,
                cqcLocationId: cqcRegistered === 'yes' ? cqcLocationId : null,
                cqcRating: cqcRating || null,
                insuranceDetails: {
                    provider: insuranceProvider || '',
                    policyNumber: insurancePolicyNumber || '',
                    expiryDate: insuranceExpiryDate ? new Date(insuranceExpiryDate) : null
                },
                icoNumber: icoNumber || '',
                subscription: {
                    plan: 'professional',
                    status: 'trial',
                    startDate: new Date(),
                    expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                    maxOperators: 20,
                    maxClients: 100
                }
            },
            emailVerified: false,
            notificationSettings: {
                email: true,
                marketing: marketingEmails === 'on'
            }
        });
        
        await user.save();
        console.log('User created successfully with ID:', user._id);

        if (req.files && req.files.cqcCertificate) {
            console.log('Processing CQC certificate upload');
            
            try {
                const cqcCertificate = req.files.cqcCertificate;
                
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
                if (!allowedTypes.includes(cqcCertificate.mimetype)) {
                    console.log('Invalid file type:', cqcCertificate.mimetype);
                    req.flash('error', 'Invalid file type. Please upload PDF, JPG, or PNG files only.');
                    return res.redirect('/register');
                }
                
                const fileExtension = cqcCertificate.name.split('.').pop();
                const fileName = `${user._id}_cqc.${fileExtension}`;
                const uploadPath = path.join(__dirname, '../uploads/cqc/', fileName);
                
                const uploadDir = path.join(__dirname, '../uploads/cqc/');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                    console.log('Created upload directory:', uploadDir);
                }
                
                await cqcCertificate.mv(uploadPath);
                console.log('File uploaded to:', uploadPath);
                
                user.providerInfo.cqcCertificate = `/uploads/cqc/${fileName}`;
                await user.save();
                console.log('CQC certificate path saved to user record');
                
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                req.flash('info', 'Registration successful but file upload failed. You can upload your CQC certificate later from your dashboard.');
            }
        }

        console.log('Registration successful, redirecting to login');
        req.flash('success', 'Registration successful! Please check your email to verify your account, then login.');
        res.redirect('/login');
        
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 11000) {
            req.flash('error', 'Email already registered');
        } else if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error', 'Validation error: ' + messages.join(', '));
        } else {
            req.flash('error', 'Error during registration. Please try again.');
        }
        
        res.redirect('/register');
    }
});

module.exports = router;