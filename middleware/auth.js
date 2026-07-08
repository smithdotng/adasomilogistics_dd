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

// Check if user is service care provider - FIXED null check
exports.isCareProvider = async (req, res, next) => {
    try {
        if (req.session.user && req.session.user.role === 'care_provider') {
            // Check if care provider subscription is active
            const careProvider = await User.findById(req.session.user._id);
            
            // Add null check for care provider
            if (!careProvider) {
                req.flash('error', 'Care Provider account not found');
                return res.redirect('/logout');
            }
            
            // Add null check for subscription
            if (careProvider.careProviderInfo && 
                careProvider.careProviderInfo.subscription && 
                careProvider.careProviderInfo.subscription.status === 'expired') {
                req.flash('error', 'Your subscription has expired. Please renew to continue.');
                return res.redirect('/care-provider/settings/billing'); // Fixed redirect path
            }
            return next();
        }
        req.flash('error', 'Unauthorized access');
        res.redirect('/dashboard');
    } catch (error) {
        console.error('isCareProvider error:', error);
        req.flash('error', 'An error occurred');
        res.redirect('/dashboard');
    }
};

// Check if user is support worker
exports.isSupportWorker = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'support_worker') {
        return next();
    }
    req.flash('error', 'Unauthorized access');
    res.redirect('/dashboard');
};

// Check if user is service user
exports.isServiceUser = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'service_user') {
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

// Check if user has access to specific service user - FIXED null checks
exports.canAccessServiceUser = (serviceUserId) => {
    return async (req, res, next) => {
        try {
            const user = req.session.user;
            
            // Check if user exists in session
            if (!user) {
                req.flash('error', 'Please login to access this page');
                return res.redirect('/login');
            }
            
            const targetServiceUserId = req.params[serviceUserId] || req.body.serviceUserId;
            
            if (!targetServiceUserId) {
                return next();
            }
            
            // Super admin and care provider can access all service users under them
            if (user.role === 'super_admin') {
                return next();
            }
            
            if (user.role === 'care_provider') {
                const serviceUser = await User.findOne({
                    _id: targetServiceUserId,
                    careProviderId: user._id
                });
                if (serviceUser) return next();
            }
            
            // Support Workers can only access assigned service users
            if (user.role === 'support_worker') {
                const supportWorker = await User.findById(user._id);
                if (supportWorker && 
                    supportWorker.supportWorkerInfo && 
                    supportWorker.supportWorkerInfo.assignedServiceUsers && 
                    supportWorker.supportWorkerInfo.assignedServiceUsers.includes(targetServiceUserId)) {
                    return next();
                }
            }
            
            // Guardians can only access monitored service users
            if (user.role === 'guardian') {
                const guardian = await User.findById(user._id);
                if (guardian && 
                    guardian.guardianInfo && 
                    guardian.guardianInfo.serviceUsersMonitored && 
                    guardian.guardianInfo.serviceUsersMonitored.includes(targetServiceUserId)) {
                    return next();
                }
            }
            
            // Service Users can only access themselves
            if (user.role === 'service_user' && user._id.toString() === targetServiceUserId) {
                return next();
            }
            
            req.flash('error', 'You do not have permission to access this service user');
            res.redirect('/dashboard');
        } catch (error) {
            console.error('canAccessServiceUser error:', error);
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
            
            const careProviderId = req.session.user.role === 'care_provider' 
                ? req.session.user._id 
                : req.session.user.careProviderId;
            
            if (!careProviderId) {
                req.flash('error', 'Care Provider information not found');
                return res.redirect('/dashboard');
            }
            
            const careProvider = await User.findById(careProviderId);
            
            if (!careProvider) {
                req.flash('error', 'Care Provider not found');
                return res.redirect('/dashboard');
            }
            
            // Check if subscription exists
            if (!careProvider.careProviderInfo || !careProvider.careProviderInfo.subscription) {
                req.flash('error', 'Subscription information not found');
                return res.redirect('/dashboard');
            }
            
            const subscription = careProvider.careProviderInfo.subscription;
            
            if (type === 'support_worker') {
                const supportWorkerCount = await User.countDocuments({
                    role: 'support_worker',
                    careProviderId: careProviderId
                });
                
                if (supportWorkerCount >= subscription.maxSupportWorkers) {
                    req.flash('error', `You have reached your maximum support worker limit (${subscription.maxSupportWorkers}). Please upgrade your subscription.`);
                    return res.redirect('/care-provider/settings/billing'); // Fixed redirect path
                }
            }
            
            if (type === 'service_user') {
                const clientCount = await User.countDocuments({
                    role: 'service_user',
                    careProviderId: careProviderId
                });
                
                if (clientCount >= subscription.maxServiceUsers) {
                    req.flash('error', `You have reached your maximum service user limit (${subscription.maxServiceUsers}). Please upgrade your subscription.`);
                    return res.redirect('/care-provider/settings/billing'); // Fixed redirect path
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