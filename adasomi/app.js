require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const flash = require('express-flash');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const methodOverride = require('method-override');
const moment = require('moment');

const authRoutes = require('./routes/auth');
const websiteRoutes = require('./routes/website');
const merchantRoutes = require('./routes/merchant');
const riderRoutes = require('./routes/rider');
const customerRoutes = require('./routes/customer');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');

const app = express();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adasomi';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Startup checks: warn loudly on common production misconfigurations rather
// than fail silently later. These are warnings, not hard stops, so the app
// still boots for first-time setup.
if (IS_PRODUCTION) {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'adasomi-secret-key-change-in-production') {
        console.warn('[WARNING] SESSION_SECRET is missing or using the default placeholder. Set a strong, unique SESSION_SECRET before running in production.');
    }
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('[WARNING] SMTP_USER / SMTP_PASS are not set. Email verification links will only be logged to the console, not delivered.');
    }
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.includes('127.0.0.1') || process.env.MONGODB_URI.includes('localhost')) {
        console.warn('[WARNING] MONGODB_URI points at localhost while NODE_ENV=production. Confirm this is intentional.');
    }
    if (process.env.USE_HTTPS !== 'true') {
        console.warn('[WARNING] USE_HTTPS is not set to "true". Session cookies will not be marked Secure, which is unsafe if this app is reachable over the public internet.');
    }
}

// Required when running behind a reverse proxy / load balancer (Nginx, Render,
// Railway, etc.) so secure cookies and rate-limiting see the real client IP.
app.set('trust proxy', 1);

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected (Adasomi)'))
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'adasomi-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGODB_URI,
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    },
    name: 'adasomi.sid'
}));

app.use(flash());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.currentUrl = req.originalUrl;
    res.locals.moment = moment;
    next();
});

app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        switch (req.session.user.role) {
            case 'merchant': return res.redirect('/merchant/dashboard');
            case 'rider': return res.redirect('/rider/dashboard');
            case 'public_user': return res.redirect('/customer/dashboard');
            case 'admin': return res.redirect('/admin/dashboard');
            default: return res.redirect('/login');
        }
    }
    res.render('index', { title: 'Adasomi Logistics Dispatch & Delivery Platform' });
});

app.use('/', authRoutes);
app.use('/', websiteRoutes);
app.use('/merchant', merchantRoutes);
app.use('/rider', riderRoutes);
app.use('/customer', customerRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.'
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    if (err.name === 'ValidationError') {
        req.flash('error', 'Validation error: ' + err.message);
        return res.redirect('back');
    }
    if (err.code === 11000) {
        req.flash('error', 'Duplicate entry: This record already exists.');
        return res.redirect('back');
    }
    res.status(err.status || 500).render('error', {
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'Something went wrong on our end. Please try again later.'
            : err.message
    });
});

const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
    console.log(`Adasomi server running on port ${PORT}`);
});

module.exports = app;
