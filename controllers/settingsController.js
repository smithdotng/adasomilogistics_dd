const User = require('../models/User');
const bcrypt = require('bcryptjs');
const moment = require('moment');

// Get settings page
exports.getSettings = async (req, res) => {
    try {
        const provider = await User.findById(req.session.user._id);
        
        res.render('provider/settings/index', {
            title: 'Profile Settings',
            user: req.session.user,
            provider,
            moment
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        req.flash('error', 'Error loading settings');
        res.redirect('/provider/dashboard');
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        
        const updateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            'providerInfo.companyName': req.body.companyName,
            'providerInfo.companyRegNumber': req.body.companyRegNumber,
            'providerInfo.cqcLocationId': req.body.cqcLocationId,
            'providerInfo.website': req.body.website,
            address: {
                street: req.body.addressStreet,
                city: req.body.addressCity,
                county: req.body.addressCounty,
                postcode: req.body.addressPostcode,
                country: 'UK'
            }
        };
        
        // Handle profile image upload if present
        if (req.files && req.files.profileImage) {
            const profileImage = req.files.profileImage;
            const uploadPath = path.join(__dirname, '../uploads/profiles/', `${providerId}_profile.${profileImage.name.split('.').pop()}`);
            
            // Ensure directory exists
            const uploadDir = path.join(__dirname, '../uploads/profiles/');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            await profileImage.mv(uploadPath);
            updateData.profileImage = `/uploads/profiles/${providerId}_profile.${profileImage.name.split('.').pop()}`;
        }
        
        // Update password if provided
        if (req.body.newPassword && req.body.currentPassword) {
            const provider = await User.findById(providerId);
            const isValid = await provider.comparePassword(req.body.currentPassword);
            
            if (!isValid) {
                req.flash('error', 'Current password is incorrect');
                return res.redirect('/provider/settings');
            }
            
            if (req.body.newPassword !== req.body.confirmPassword) {
                req.flash('error', 'New passwords do not match');
                return res.redirect('/provider/settings');
            }
            
            provider.password = req.body.newPassword;
            await provider.save();
        } else {
            await User.findByIdAndUpdate(providerId, updateData);
        }
        
        // Update session
        req.session.user = {
            ...req.session.user,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            providerInfo: {
                ...req.session.user.providerInfo,
                companyName: req.body.companyName
            }
        };
        
        req.flash('success', 'Settings updated successfully');
        res.redirect('/provider/settings');
    } catch (error) {
        console.error('Error updating settings:', error);
        req.flash('error', 'Error updating settings');
        res.redirect('/provider/settings');
    }
};

// Get billing page
exports.getBilling = async (req, res) => {
    try {
        const provider = await User.findById(req.session.user._id);
        
        if (!provider) {
            req.flash('error', 'Provider not found');
            return res.redirect('/provider/settings');
        }
        
        // Get usage statistics
        const [operatorCount, clientCount] = await Promise.all([
            User.countDocuments({ role: 'operator', providerId: provider._id }),
            User.countDocuments({ role: 'client', providerId: provider._id })
        ]);
        
        // Calculate percentages for progress bars based on plan limits
        const planLimits = {
            essential: { operators: 10, clients: 50 },
            professional: { operators: 30, clients: 200 },
            enterprise: { operators: 1000, clients: 5000 } // effectively unlimited
        };
        
        const currentPlan = provider.providerInfo.subscription.plan || 'essential';
        const limits = planLimits[currentPlan] || planLimits.essential;
        
        const operatorsPercentage = Math.min((operatorCount / limits.operators) * 100, 100);
        const clientsPercentage = Math.min((clientCount / limits.clients) * 100, 100);
        
        res.render('provider/settings/billing', {
            title: 'Billing & Subscription',
            user: req.session.user,
            provider,
            usage: {
                operators: operatorCount,
                clients: clientCount,
                operatorsLimit: limits.operators,
                clientsLimit: limits.clients,
                operatorsPercentage: operatorsPercentage,
                clientsPercentage: clientsPercentage
            },
            moment
        });
    } catch (error) {
        console.error('Error loading billing:', error);
        req.flash('error', 'Error loading billing information');
        res.redirect('/provider/settings');
    }
};

// Upgrade subscription
exports.upgradeSubscription = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        const { plan } = req.body;
        
        const plans = {
            essential: { 
                name: 'essential',
                maxOperators: 10, 
                maxClients: 50, 
                price: 99.99,
                features: ['basic_scheduling', 'interaction_logging', 'email_support']
            },
            professional: { 
                name: 'professional',
                maxOperators: 30, 
                maxClients: 200, 
                price: 159.99,
                features: ['advanced_scheduling', 'medication_management', 'guardian_portal', 'priority_support']
            },
            enterprise: { 
                name: 'enterprise',
                maxOperators: 1000, 
                maxClients: 5000, 
                price: 299.99,
                features: ['unlimited_everything', 'multi_location', 'api_access', 'dedicated_manager']
            }
        };
        
        const selectedPlan = plans[plan];
        if (!selectedPlan) {
            req.flash('error', 'Invalid plan selected');
            return res.redirect('/provider/settings/billing');
        }
        
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Monthly billing
        
        await User.findByIdAndUpdate(providerId, {
            'providerInfo.subscription': {
                plan: selectedPlan.name,
                status: 'active',
                startDate: new Date(),
                expiryDate,
                maxOperators: selectedPlan.maxOperators,
                maxClients: selectedPlan.maxClients,
                features: selectedPlan.features
            }
        });
        
        // Update session
        req.session.user.providerInfo.subscription.plan = selectedPlan.name;
        req.session.user.providerInfo.subscription.status = 'active';
        req.session.user.providerInfo.subscription.maxOperators = selectedPlan.maxOperators;
        req.session.user.providerInfo.subscription.maxClients = selectedPlan.maxClients;
        
        req.flash('success', `Successfully upgraded to ${plan} plan`);
        res.redirect('/provider/settings/billing');
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        req.flash('error', 'Error upgrading subscription');
        res.redirect('/provider/settings/billing');
    }
};

// Get team settings
exports.getTeam = async (req, res) => {
    try {
        // Get team members (operators and admins) for this provider
        const teamMembers = await User.find({
            providerId: req.session.user._id,
            role: { $in: ['operator', 'admin'] }
        }).select('firstName lastName email role isActive');
        
        res.render('provider/settings/team', {
            title: 'Team Settings',
            user: req.session.user,
            teamMembers,
            moment
        });
    } catch (error) {
        console.error('Error loading team settings:', error);
        req.flash('error', 'Error loading team settings');
        res.redirect('/provider/settings');
    }
};

// Invite team member
exports.inviteTeamMember = async (req, res) => {
    try {
        const { firstName, lastName, email, role } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'User with this email already exists');
            return res.redirect('/provider/settings/team');
        }
        
        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 
                           Math.random().toString(36).slice(-8).toUpperCase();
        
        // Create new team member
        const newUser = new User({
            email,
            password: tempPassword,
            firstName,
            lastName,
            role: role || 'operator',
            providerId: req.session.user._id,
            isActive: true,
            emailVerified: false
        });
        
        await newUser.save();
        
        // TODO: Send invitation email with tempPassword
        
        req.flash('success', `Invitation sent to ${email}`);
        res.redirect('/provider/settings/team');
    } catch (error) {
        console.error('Error inviting team member:', error);
        req.flash('error', 'Error sending invitation');
        res.redirect('/provider/settings/team');
    }
};

// Get notifications settings
exports.getNotifications = async (req, res) => {
    try {
        const provider = await User.findById(req.session.user._id);
        
        res.render('provider/settings/notifications', {
            title: 'Notification Settings',
            user: req.session.user,
            provider,
            moment
        });
    } catch (error) {
        console.error('Error loading notification settings:', error);
        req.flash('error', 'Error loading notification settings');
        res.redirect('/provider/settings');
    }
};

// Update notifications settings
exports.updateNotifications = async (req, res) => {
    try {
        const { emailNotifications, smsNotifications, pushNotifications } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            notificationSettings: {
                email: emailNotifications === 'on',
                sms: smsNotifications === 'on',
                push: pushNotifications === 'on'
            }
        });
        
        req.flash('success', 'Notification settings updated');
        res.redirect('/provider/settings/notifications');
    } catch (error) {
        console.error('Error updating notification settings:', error);
        req.flash('error', 'Error updating notification settings');
        res.redirect('/provider/settings/notifications');
    }
};

// Get security settings
exports.getSecurity = async (req, res) => {
    try {
        res.render('provider/settings/security', {
            title: 'Security Settings',
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error('Error loading security settings:', error);
        req.flash('error', 'Error loading security settings');
        res.redirect('/provider/settings');
    }
};

// Update security settings
exports.updateSecurity = async (req, res) => {
    try {
        const { twoFactorEnabled, sessionTimeout } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            twoFactorEnabled: twoFactorEnabled === 'on',
            'settings.sessionTimeout': sessionTimeout || 30
        });
        
        req.flash('success', 'Security settings updated');
        res.redirect('/provider/settings/security');
    } catch (error) {
        console.error('Error updating security settings:', error);
        req.flash('error', 'Error updating security settings');
        res.redirect('/provider/settings/security');
    }
};

// Get API settings
exports.getApi = async (req, res) => {
    try {
        // Generate API key if not exists
        let apiKey = req.session.user.apiKey;
        if (!apiKey) {
            apiKey = generateApiKey();
            await User.findByIdAndUpdate(req.session.user._id, { apiKey });
        }
        
        res.render('provider/settings/api', {
            title: 'API Settings',
            user: req.session.user,
            apiKey,
            moment
        });
    } catch (error) {
        console.error('Error loading API settings:', error);
        req.flash('error', 'Error loading API settings');
        res.redirect('/provider/settings');
    }
};

// Regenerate API key
exports.regenerateApiKey = async (req, res) => {
    try {
        const newApiKey = generateApiKey();
        await User.findByIdAndUpdate(req.session.user._id, { apiKey: newApiKey });
        
        req.flash('success', 'API key regenerated successfully');
        res.redirect('/provider/settings/api');
    } catch (error) {
        console.error('Error regenerating API key:', error);
        req.flash('error', 'Error regenerating API key');
        res.redirect('/provider/settings/api');
    }
};

// Helper function to generate API key
function generateApiKey() {
    const crypto = require('crypto');
    return 'csh_' + crypto.randomBytes(32).toString('hex');
}