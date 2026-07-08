const express = require('express');
const router = express.Router();
const moment = require('moment');

// Home/Landing page
router.get('/', (req, res) => {
    // If user is logged in, redirect to their dashboard
    if (req.session.user) {
        switch(req.session.user.role) {
            case 'care_provider':
                return res.redirect('/care-provider/dashboard');
            case 'support_worker':
                return res.redirect('/support-worker/dashboard');
            case 'service_user':
                return res.redirect('/service-user/dashboard');
            case 'guardian':
                return res.redirect('/guardian/dashboard');
            case 'super_admin':
                return res.redirect('/admin/dashboard');
            default:
                return res.redirect('/login');
        }
    }
    
    res.render('index', { 
        title: 'Care System - Complete Care Management Platform for UK Care Providers',
        path: '/',
        moment
    });
});

// How It Works page
router.get('/how-it-works', (req, res) => {
    res.render('how-it-works', { 
        title: 'How It Works - Care Management Platform for UK Care Providers',
        path: '/how-it-works',
        moment
    });
});

// Features page
router.get('/features', (req, res) => {
    res.render('features', { 
        title: 'Features - Complete Care Management Platform',
        path: '/features',
        moment
    });
});

// Pricing page
router.get('/pricing', (req, res) => {
    res.render('pricing', { 
        title: 'Pricing - Simple, Transparent Plans for UK Care Providers',
        path: '/pricing',
        moment
    });
});

// About Us page
router.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us - Care System',
        path: '/about',
        moment
    });
});

// Contact page
router.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us - Care System',
        path: '/contact',
        moment
    });
});

// Privacy Policy page
router.get('/privacy', (req, res) => {
    res.render('privacy', { 
        title: 'Privacy Policy - Care System',
        path: '/privacy',
        moment
    });
});

// Terms of Use page
router.get('/terms', (req, res) => {
    res.render('terms', { 
        title: 'Terms of Use - Care System',
        path: '/terms',
        moment
    });
});

// Cookie Policy page
router.get('/cookies', (req, res) => {
    res.render('cookies', { 
        title: 'Cookie Policy - Care System',
        path: '/cookies',
        moment
    });
});

// CQC Compliance page
router.get('/compliance', (req, res) => {
    res.render('compliance', { 
        title: 'CQC Compliance - Care System',
        path: '/compliance',
        moment
    });
});

// Contact form submission handler
router.post('/contact', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { name, email, phone, company, message } = req.body;
        
        // Here you would typically:
        // 1. Validate the input
        // 2. Save to database
        // 3. Send email notification
        // 4. Log the inquiry
        
        console.log('Contact form submission:', { name, email, phone, company, message });
        
        // For now, just flash a success message
        req.flash('success', 'Thank you for contacting us! We\'ll get back to you within 24 hours.');
        res.redirect('/contact');
    } catch (error) {
        console.error('Contact form error:', error);
        req.flash('error', 'There was an error sending your message. Please try again.');
        res.redirect('/contact');
    }
});

// Newsletter subscription
router.post('/newsletter', express.urlencoded({ extended: true }), async (req, res) => {
    try {
        const { email } = req.body;
        
        // Here you would add email to newsletter list
        console.log('Newsletter subscription:', email);
        
        req.flash('success', 'Thank you for subscribing to our newsletter!');
        res.redirect('back');
    } catch (error) {
        console.error('Newsletter error:', error);
        req.flash('error', 'There was an error subscribing. Please try again.');
        res.redirect('back');
    }
});

module.exports = router;