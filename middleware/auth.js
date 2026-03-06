const User = require('../models/User');

// Check if user is authenticated - ADDED DEBUGGING
exports.isAuthenticated = (req, res, next) => {
    console.log('isAuthenticated check:', { 
        hasSession: !!req.session, 
        hasUser: !!req.session?.user,
        url: req.url 
    });
    
    if (req.session && req.session.user) {
        return next();
    }
    
    console.log('Authentication failed, redirecting to login');
    req.flash('error', 'Please login to access this page');
    res.redirect('/login');
};

// Check if user is service provider - FIXED null check
exports.isProvider = async (req, res, next) => {
    try {
        if (req.session.user && req.session.user.role === 'service_provider') {
            // Check if provider subscription is active
            const provider = await User.findById(req.session.user._id);
            
            // Add null check for provider
            if (!provider) {
                req.flash('error', 'Provider account not found');
                return res.redirect('/logout');
            }
            
            // Add null check for subscription
            if (provider.providerInfo && 
                provider.providerInfo.subscription && 
                provider.providerInfo.subscription.status === 'expired') {
                req.flash('error', 'Your subscription has expired. Please renew to continue.');
                return res.redirect('/provider/settings/billing'); // Fixed redirect path
            }
            return next();
        }
        req.flash('error', 'Unauthorized access');
        res.redirect('/dashboard');
    } catch (error) {
        console.error('isProvider error:', error);
        req.flash('error', 'An error occurred');
        res.redirect('/dashboard');
    }
};

// Check if user is operator
exports.isOperator = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'operator') {
        return next();
    }
    req.flash('error', 'Unauthorized access');
    res.redirect('/dashboard');
};

// Check if user is client
exports.isClient = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'client') {
        return next();
    }
    req.flash('error', 'Unauthorized access');
    res.redirect('/dashboard');
};

// Check if user is guardian
exports.isGuardian = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'guardian') {
        return next();
    }
    req.flash('error', 'Unauthorized access');
    res.redirect('/dashboard');
};

// Check if user has access to specific client - FIXED null checks
exports.canAccessClient = (clientId) => {
    return async (req, res, next) => {
        try {
            const user = req.session.user;
            
            // Check if user exists in session
            if (!user) {
                req.flash('error', 'Please login to access this page');
                return res.redirect('/login');
            }
            
            const targetClientId = req.params[clientId] || req.body.clientId;
            
            if (!targetClientId) {
                return next();
            }
            
            // Super admin and provider can access all clients under them
            if (user.role === 'super_admin') {
                return next();
            }
            
            if (user.role === 'service_provider') {
                const client = await User.findOne({
                    _id: targetClientId,
                    providerId: user._id
                });
                if (client) return next();
            }
            
            // Operators can only access assigned clients
            if (user.role === 'operator') {
                const operator = await User.findById(user._id);
                if (operator && 
                    operator.operatorInfo && 
                    operator.operatorInfo.assignedClients && 
                    operator.operatorInfo.assignedClients.includes(targetClientId)) {
                    return next();
                }
            }
            
            // Guardians can only access monitored clients
            if (user.role === 'guardian') {
                const guardian = await User.findById(user._id);
                if (guardian && 
                    guardian.guardianInfo && 
                    guardian.guardianInfo.clientsMonitored && 
                    guardian.guardianInfo.clientsMonitored.includes(targetClientId)) {
                    return next();
                }
            }
            
            // Clients can only access themselves
            if (user.role === 'client' && user._id.toString() === targetClientId) {
                return next();
            }
            
            req.flash('error', 'You do not have permission to access this client');
            res.redirect('/dashboard');
        } catch (error) {
            console.error('canAccessClient error:', error);
            req.flash('error', 'An error occurred');
            res.redirect('/dashboard');
        }
    };
};

// Check subscription limits - FIXED null checks and redirect path
exports.checkSubscriptionLimit = (type) => {
    return async (req, res, next) => {
        try {
            // Check if user exists in session
            if (!req.session.user) {
                req.flash('error', 'Please login to access this page');
                return res.redirect('/login');
            }
            
            const providerId = req.session.user.role === 'service_provider' 
                ? req.session.user._id 
                : req.session.user.providerId;
            
            if (!providerId) {
                req.flash('error', 'Provider information not found');
                return res.redirect('/dashboard');
            }
            
            const provider = await User.findById(providerId);
            
            if (!provider) {
                req.flash('error', 'Provider not found');
                return res.redirect('/dashboard');
            }
            
            // Check if subscription exists
            if (!provider.providerInfo || !provider.providerInfo.subscription) {
                req.flash('error', 'Subscription information not found');
                return res.redirect('/dashboard');
            }
            
            const subscription = provider.providerInfo.subscription;
            
            if (type === 'operator') {
                const operatorCount = await User.countDocuments({
                    role: 'operator',
                    providerId: providerId
                });
                
                if (operatorCount >= subscription.maxOperators) {
                    req.flash('error', `You have reached your maximum operator limit (${subscription.maxOperators}). Please upgrade your subscription.`);
                    return res.redirect('/provider/settings/billing'); // Fixed redirect path
                }
            }
            
            if (type === 'client') {
                const clientCount = await User.countDocuments({
                    role: 'client',
                    providerId: providerId
                });
                
                if (clientCount >= subscription.maxClients) {
                    req.flash('error', `You have reached your maximum client limit (${subscription.maxClients}). Please upgrade your subscription.`);
                    return res.redirect('/provider/settings/billing'); // Fixed redirect path
                }
            }
            
            next();
        } catch (error) {
            console.error('checkSubscriptionLimit error:', error);
            req.flash('error', 'An error occurred');
            res.redirect('/dashboard');
        }
    };
};