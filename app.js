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
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');
const moment = require('moment');
const { sendDailySummary } = require('./services/emailService');
const websiteRoutes = require('./routes/website');

// Import routes
const authRoutes = require('./routes/auth');
const careProviderRoutes = require('./routes/careProvider');
const supportWorkerRoutes = require('./routes/supportWorker');
const serviceUserRoutes = require('./routes/serviceUser');
const guardianRoutes = require('./routes/guardian');
const apiRoutes = require('./routes/api');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Create upload directories if they don't exist
const createUploadDirectories = () => {
    const dirs = [
        'uploads',
        'uploads/cqc',
        'uploads/support-workers',
        'uploads/service-users',
        'uploads/documents',
        'uploads/temp'
    ];
    
    dirs.forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }
    });
};

// Database connection - FIXED: Removed deprecated options
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('MongoDB Connected');
        createUploadDirectories();
        
        // Schedule daily summary emails at 8 PM every day
        cron.schedule('0 20 * * *', async () => {
            console.log('Sending daily summaries...');
            try {
                const User = require('./models/User');
                const Interaction = require('./models/Interaction');
                const careProviders = await User.find({ 
                    role: 'care_provider',
                    'careProviderInfo.subscription.status': { $in: ['active', 'trial'] }
                });
                
                for (const careProvider of careProviders) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const completedVisits = await Interaction.countDocuments({
                        careProviderId: careProvider._id,
                        status: 'completed',
                        actualEnd: { $gte: today }
                    });
                    
                    const activeSupportWorkers = await User.countDocuments({
                        role: 'support_worker',
                        careProviderId: careProvider._id,
                        isActive: true
                    });
                    
                    const serviceUsersSeen = await Interaction.distinct('serviceUserId', {
                        careProviderId: careProvider._id,
                        actualEnd: { $gte: today }
                    });
                    
                    const recentInteractions = await Interaction.find({
                        careProviderId: careProvider._id,
                        actualEnd: { $gte: today }
                    })
                    .populate('serviceUserId', 'firstName lastName')
                    .populate('supportWorkerId', 'firstName lastName')
                    .limit(5);
                    
                    await sendDailySummary(careProvider.email, {
                        careProviderName: careProvider.careProviderInfo.companyName,
                        date: moment().format('MMMM D, YYYY'),
                        completedVisits,
                        activeSupportWorkers,
                        serviceUsersSeen: serviceUsersSeen.length,
                        recentInteractions: recentInteractions.map(i => ({
                            time: moment(i.actualEnd).format('h:mm A'),
                            serviceUser: i.serviceUserId ? `${i.serviceUserId.firstName || ''} ${i.serviceUserId.lastName || ''}` : 'Unknown',
                            supportWorker: i.supportWorkerId ? `${i.supportWorkerId.firstName || ''} ${i.supportWorkerId.lastName || ''}` : 'Unknown',
                            type: i.type || 'Unknown'
                        })),
                        dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/care-provider/dashboard`
                    });
                }
            } catch (error) {
                console.error('Error sending daily summaries:', error);
            }
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration - FIXED for connect-mongo
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60,
        autoRemove: 'native',
        touchAfter: 24 * 3600
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    },
    name: 'careshed.sid',
    proxy: process.env.NODE_ENV === 'production'
}));

app.use(flash());

// File upload middleware
const fileUpload = require('express-fileupload');
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 },
    abortOnLimit: true,
    responseOnLimit: 'File size limit exceeded'
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global variables middleware
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    res.locals.currentUrl = req.originalUrl;
    res.locals.moment = moment;
    next();
});

// Root route
app.get('/', (req, res) => {
    console.log('ROOT ROUTE - Session user:', req.session?.user ? 'exists' : 'null');
    
    if (req.session && req.session.user) {
        console.log('User logged in, redirecting to dashboard for role:', req.session.user.role);
        
        req.session.save((err) => {
            if (err) {
                console.error('Error saving session:', err);
            }
            
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
        });
        return;
    }
    
    console.log('No user in session, showing landing page');
    res.render('index', { 
        title: 'CareShed - Complete Care Management Platform for UK Care Providers'
    });
});

// Routes
app.use('/', authRoutes);
app.use('/', websiteRoutes);
app.use('/care-provider', careProviderRoutes);
app.use('/support-worker', supportWorkerRoutes);
app.use('/service-user', serviceUserRoutes);
app.use('/guardian', guardianRoutes);
app.use('/api', apiRoutes);
app.use('/care-provider/payments', paymentRoutes);

// Backward-compatible redirects for old role-based URLs
// (kept so existing bookmarks/emailed links continue to work)
app.get(['/provider', '/provider/*'], (req, res) => {
    res.redirect(308, req.originalUrl.replace('/provider', '/care-provider'));
});
app.post(['/provider', '/provider/*'], (req, res) => {
    res.redirect(307, req.originalUrl.replace('/provider', '/care-provider'));
});
app.get(['/operator', '/operator/*'], (req, res) => {
    res.redirect(308, req.originalUrl.replace('/operator', '/support-worker'));
});
app.post(['/operator', '/operator/*'], (req, res) => {
    res.redirect(307, req.originalUrl.replace('/operator', '/support-worker'));
});
app.get(['/client', '/client/*'], (req, res) => {
    res.redirect(308, req.originalUrl.replace('/client', '/service-user'));
});
app.post(['/client', '/client/*'], (req, res) => {
    res.redirect(307, req.originalUrl.replace('/client', '/service-user'));
});

// Session test route
app.get('/session-test', (req, res) => {
    if (!req.session.views) {
        req.session.views = 1;
        req.session.save((err) => {
            if (err) {
                return res.send('Error saving session: ' + err.message);
            }
            res.send(`Session created! Session ID: ${req.session.id}. Refresh the page to see the counter increase.`);
        });
    } else {
        req.session.views++;
        req.session.save((err) => {
            if (err) {
                return res.send('Error updating session: ' + err.message);
            }
            res.send(`You have visited this page ${req.session.views} times. Session ID: ${req.session.id}`);
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist.',
        error: process.env.NODE_ENV === 'development' ? { status: 404, stack: 'Not Found' } : {}
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'File too large. Maximum file size is 5MB.');
            return res.redirect('back');
        }
        req.flash('error', 'File upload error: ' + err.message);
        return res.redirect('back');
    }
    
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
            : err.message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Visit http://localhost:${PORT} to access the application`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false)
            .then(() => {
                console.log('MongoDB connection closed');
                process.exit(0);
            })
            .catch(err => {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false)
            .then(() => {
                console.log('MongoDB connection closed');
                process.exit(0);
            })
            .catch(err => {
                console.error('Error closing MongoDB connection:', err);
                process.exit(1);
            });
    });
});

module.exports = app;