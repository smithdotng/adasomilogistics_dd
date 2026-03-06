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
const providerRoutes = require('./routes/provider');
const operatorRoutes = require('./routes/operator');
const clientRoutes = require('./routes/client');
const guardianRoutes = require('./routes/guardian');
const apiRoutes = require('./routes/api');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

// Create upload directories if they don't exist
const createUploadDirectories = () => {
    const dirs = [
        'uploads',
        'uploads/cqc',
        'uploads/operators',
        'uploads/clients',
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
                const providers = await User.find({ 
                    role: 'service_provider',
                    'providerInfo.subscription.status': { $in: ['active', 'trial'] }
                });
                
                for (const provider of providers) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const completedVisits = await Interaction.countDocuments({
                        providerId: provider._id,
                        status: 'completed',
                        actualEnd: { $gte: today }
                    });
                    
                    const activeOperators = await User.countDocuments({
                        role: 'operator',
                        providerId: provider._id,
                        isActive: true
                    });
                    
                    const clientsSeen = await Interaction.distinct('clientId', {
                        providerId: provider._id,
                        actualEnd: { $gte: today }
                    });
                    
                    const recentInteractions = await Interaction.find({
                        providerId: provider._id,
                        actualEnd: { $gte: today }
                    })
                    .populate('clientId', 'firstName lastName')
                    .populate('operatorId', 'firstName lastName')
                    .limit(5);
                    
                    await sendDailySummary(provider.email, {
                        providerName: provider.providerInfo.companyName,
                        date: moment().format('MMMM D, YYYY'),
                        completedVisits,
                        activeOperators,
                        clientsSeen: clientsSeen.length,
                        recentInteractions: recentInteractions.map(i => ({
                            time: moment(i.actualEnd).format('h:mm A'),
                            client: i.clientId ? `${i.clientId.firstName || ''} ${i.clientId.lastName || ''}` : 'Unknown',
                            operator: i.operatorId ? `${i.operatorId.firstName || ''} ${i.operatorId.lastName || ''}` : 'Unknown',
                            type: i.type || 'Unknown'
                        })),
                        dashboardUrl: `${process.env.APP_URL || 'http://localhost:3000'}/provider/dashboard`
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
                case 'service_provider':
                    return res.redirect('/provider/dashboard');
                case 'operator':
                    return res.redirect('/operator/dashboard');
                case 'client':
                    return res.redirect('/client/dashboard');
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
        title: 'CareShed - Complete Care Management Platform for UK Providers'
    });
});

// Routes
app.use('/', authRoutes);
app.use('/', websiteRoutes);
app.use('/provider', providerRoutes);
app.use('/operator', operatorRoutes);
app.use('/client', clientRoutes);
app.use('/guardian', guardianRoutes);
app.use('/api', apiRoutes);
app.use('/provider/payments', paymentRoutes);

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