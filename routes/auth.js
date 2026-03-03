const express = require('express');
const router = express.Router();
const User = require('../models/User');
const path = require('path'); // Add this line
const fs = require('fs'); // Add this for file system operations

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { 
        title: 'Login',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Login handler
router.post('/login', async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        
        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        
        if (!user) {
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }
        
        // Check if account is locked
        if (user.isLocked()) {
            req.flash('error', 'Account is locked due to too many failed attempts. Please try again later.');
            return res.redirect('/login');
        }
        
        // Verify password
        const isValid = await user.comparePassword(password);
        
        if (!isValid) {
            await user.incLoginAttempts();
            req.flash('error', 'Invalid email or password');
            return res.redirect('/login');
        }
        
        // Reset login attempts on successful login
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        user.lastLogin = new Date();
        user.lastLoginIp = req.ip;
        await user.save();
        
        // Set session
        req.session.user = {
            _id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            providerId: user.providerId,
            providerInfo: user.providerInfo
        };
        
        // Set session expiry if remember me is checked
        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        }
        
        req.flash('success', `Welcome back, ${user.firstName}!`);
        
        // Redirect based on role
        switch(user.role) {
            case 'service_provider':
                res.redirect('/provider/dashboard');
                break;
            case 'operator':
                res.redirect('/operator/dashboard');
                break;
            case 'client':
                res.redirect('/client/dashboard');
                break;
            case 'guardian':
                res.redirect('/guardian/dashboard');
                break;
            case 'super_admin':
                res.redirect('/admin/dashboard');
                break;
            default:
                res.redirect('/');
        }
    } catch (error) {
        console.error('Login error:', error);
        req.flash('error', 'An error occurred during login');
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
        title: 'Forgot Password',
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
        
        // Generate reset token
        const resetToken = Math.random().toString(36).slice(-8) + 
                          Math.random().toString(36).slice(-8).toUpperCase();
        
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        await user.save();
        
        // TODO: Send email with reset link
        
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
        title: 'Register',
        error: req.flash('error'),
        success: req.flash('success')
    });
});

// Register handler
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
        
        // Validation
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
        
        // Check if user exists
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
        
        // Process service types
        let serviceTypesArray = [];
        if (serviceTypes) {
            serviceTypesArray = Array.isArray(serviceTypes) ? serviceTypes : [serviceTypes];
        }
        if (otherServices) {
            serviceTypesArray.push(otherServices);
        }

        // Format phone number
        let formattedPhone = phone;
        if (phone && !phone.startsWith('+44')) {
            // Remove any non-digit characters
            const digits = phone.replace(/\D/g, '');
            if (digits.startsWith('0')) {
                formattedPhone = '+44' + digits.substring(1);
            } else {
                formattedPhone = '+44' + digits;
            }
        }

        console.log('Creating user...');
        
        // Create provider account
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
                    expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
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

        // Handle file upload if present
        if (req.files && req.files.cqcCertificate) {
            console.log('Processing CQC certificate upload');
            
            try {
                const cqcCertificate = req.files.cqcCertificate;
                
                // Validate file type
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
                if (!allowedTypes.includes(cqcCertificate.mimetype)) {
                    console.log('Invalid file type:', cqcCertificate.mimetype);
                    req.flash('error', 'Invalid file type. Please upload PDF, JPG, or PNG files only.');
                    return res.redirect('/register');
                }
                
                // Generate safe filename
                const fileExtension = cqcCertificate.name.split('.').pop();
                const fileName = `${user._id}_cqc.${fileExtension}`;
                const uploadPath = path.join(__dirname, '../uploads/cqc/', fileName);
                
                // Ensure directory exists
                const uploadDir = path.join(__dirname, '../uploads/cqc/');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                    console.log('Created upload directory:', uploadDir);
                }
                
                // Move file to upload directory
                await cqcCertificate.mv(uploadPath);
                console.log('File uploaded to:', uploadPath);
                
                // Save file path to user record
                user.providerInfo.cqcCertificate = `/uploads/cqc/${fileName}`;
                await user.save();
                console.log('CQC certificate path saved to user record');
                
            } catch (uploadError) {
                console.error('File upload error:', uploadError);
                // Don't fail registration if file upload fails, just log it
                req.flash('info', 'Registration successful but file upload failed. You can upload your CQC certificate later from your dashboard.');
            }
        }

        // TODO: Send welcome email
        // await sendWelcomeEmail(user.email, { firstName, companyName });
        
        console.log('Registration successful, redirecting to login');
        req.flash('success', 'Registration successful! Please check your email to verify your account, then login.');
        res.redirect('/login');
        
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle specific MongoDB errors
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