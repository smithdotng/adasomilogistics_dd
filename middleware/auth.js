const User = require('../models/User');

// Check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) {
        return next();
    }
    req.flash('error', 'Please login to access this page');
    res.redirect('/login');
};

// Check if user is service provider
exports.isProvider = async (req, res, next) => {
    try {
        if (req.session.user && req.session.user.role === 'service_provider') {
            // Check if provider subscription is active
            const provider = await User.findById(req.session.user._id);
            if (provider.providerInfo.subscription.status === 'expired') {
                req.flash('error', 'Your subscription has expired. Please renew to continue.');
                return res.redirect('/provider/subscription');
            }
            return next();
        }
        req.flash('error', 'Unauthorized access');
        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
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

// Check if user has access to specific client
exports.canAccessClient = (clientId) => {
    return async (req, res, next) => {
        try {
            const user = req.session.user;
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
                if (operator.operatorInfo.assignedClients.includes(targetClientId)) {
                    return next();
                }
            }
            
            // Guardians can only access monitored clients
            if (user.role === 'guardian') {
                const guardian = await User.findById(user._id);
                if (guardian.guardianInfo.clientsMonitored.includes(targetClientId)) {
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
            console.error(error);
            req.flash('error', 'An error occurred');
            res.redirect('/dashboard');
        }
    };
};

// Check subscription limits
exports.checkSubscriptionLimit = (type) => {
    return async (req, res, next) => {
        try {
            const providerId = req.session.user.role === 'service_provider' 
                ? req.session.user._id 
                : req.session.user.providerId;
            
            const provider = await User.findById(providerId);
            
            if (!provider) {
                req.flash('error', 'Provider not found');
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
                    return res.redirect('/provider/subscription');
                }
            }
            
            if (type === 'client') {
                const clientCount = await User.countDocuments({
                    role: 'client',
                    providerId: providerId
                });
                
                if (clientCount >= subscription.maxClients) {
                    req.flash('error', `You have reached your maximum client limit (${subscription.maxClients}). Please upgrade your subscription.`);
                    return res.redirect('/provider/subscription');
                }
            }
            
            next();
        } catch (error) {
            console.error(error);
            req.flash('error', 'An error occurred');
            res.redirect('/dashboard');
        }
    };
};