require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('express-flash');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const methodOverride = require('method-override');
const multer = require('multer');
const fs = require('fs');
const cron = require('node-cron');
const moment = require('moment'); // ADD THIS LINE - Import moment
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

// Database connection - SINGLE CONNECTION (removed duplicate)
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB Connected');
    createUploadDirectories(); // Create upload directories
    
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
                // Get provider's daily stats
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
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
}));
app.use(compression());
app.use(methodOverride('_method'));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

app.use(flash());

// File upload middleware
const fileUpload = require('express-fileupload');
app.use(fileUpload({
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
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
    res.locals.moment = moment; // Use the imported moment
    next();
});

// Routes - ORDER MATTERS! Place more specific routes first
app.use('/', authRoutes); // Login, register, etc.
app.use('/', websiteRoutes); // Landing pages
app.use('/provider', providerRoutes);
app.use('/operator', operatorRoutes);
app.use('/client', clientRoutes);
app.use('/guardian', guardianRoutes);
app.use('/api', apiRoutes);
app.use('/provider/payments', paymentRoutes);

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
    
    // Handle multer file upload errors
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            req.flash('error', 'File too large. Maximum file size is 5MB.');
            return res.redirect('back');
        }
        req.flash('error', 'File upload error: ' + err.message);
        return res.redirect('back');
    }
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        req.flash('error', 'Validation error: ' + err.message);
        return res.redirect('back');
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
        req.flash('error', 'Duplicate entry: This record already exists.');
        return res.redirect('back');
    }
    
    // Handle other errors
    res.status(err.status || 500).render('error', { 
        title: 'Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong on our end. Please try again later.' 
            : err.message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Add this after your routes but before 404 handler


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
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;