const User = require('../models/User');
const bcrypt = require('bcryptjs');
const moment = require('moment');

// Get settings page
exports.getSettings = async (req, res) => {
    try {
        const careProvider = await User.findById(req.session.user._id);
        
        res.render('careProvider/settings/index', {
            title: 'Profile Settings',
            user: req.session.user,
            careProvider,
            moment
        });
    } catch (error) {
        console.error('Error loading settings:', error);
        req.flash('error', 'Error loading settings');
        res.redirect('/care-provider/dashboard');
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        
        const updateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            'careProviderInfo.companyName': req.body.companyName,
            'careProviderInfo.companyRegNumber': req.body.companyRegNumber,
            'careProviderInfo.cqcLocationId': req.body.cqcLocationId,
            'careProviderInfo.website': req.body.website,
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
            const uploadPath = path.join(__dirname, '../uploads/profiles/', `${careProviderId}_profile.${profileImage.name.split('.').pop()}`);
            
            // Ensure directory exists
            const uploadDir = path.join(__dirname, '../uploads/profiles/');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            await profileImage.mv(uploadPath);
            updateData.profileImage = `/uploads/profiles/${careProviderId}_profile.${profileImage.name.split('.').pop()}`;
        }
        
        // Update password if provided
        if (req.body.newPassword && req.body.currentPassword) {
            const careProvider = await User.findById(careProviderId);
            const isValid = await careProvider.comparePassword(req.body.currentPassword);
            
            if (!isValid) {
                req.flash('error', 'Current password is incorrect');
                return res.redirect('/care-provider/settings');
            }
            
            if (req.body.newPassword !== req.body.confirmPassword) {
                req.flash('error', 'New passwords do not match');
                return res.redirect('/care-provider/settings');
            }
            
            careProvider.password = req.body.newPassword;
            await careProvider.save();
        } else {
            await User.findByIdAndUpdate(careProviderId, updateData);
        }
        
        // Update session
        req.session.user = {
            ...req.session.user,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            careProviderInfo: {
                ...req.session.user.careProviderInfo,
                companyName: req.body.companyName
            }
        };
        
        req.flash('success', 'Settings updated successfully');
        res.redirect('/care-provider/settings');
    } catch (error) {
        console.error('Error updating settings:', error);
        req.flash('error', 'Error updating settings');
        res.redirect('/care-provider/settings');
    }
};

// Get billing page
exports.getBilling = async (req, res) => {
    try {
        const careProvider = await User.findById(req.session.user._id);
        
        if (!careProvider) {
            req.flash('error', 'Care Provider not found');
            return res.redirect('/care-provider/settings');
        }
        
        // Get usage statistics
        const [supportWorkerCount, clientCount] = await Promise.all([
            User.countDocuments({ role: 'support_worker', careProviderId: careProvider._id }),
            User.countDocuments({ role: 'service_user', careProviderId: careProvider._id })
        ]);
        
        // Calculate percentages for progress bars based on plan limits
        const planLimits = {
            essential: { supportWorkers: 10, serviceUsers: 50 },
            professional: { supportWorkers: 30, serviceUsers: 200 },
            enterprise: { supportWorkers: 1000, serviceUsers: 5000 } // effectively unlimited
        };
        
        const currentPlan = careProvider.careProviderInfo.subscription.plan || 'essential';
        const limits = planLimits[currentPlan] || planLimits.essential;
        
        const operatorsPercentage = Math.min((supportWorkerCount / limits.supportWorkers) * 100, 100);
        const clientsPercentage = Math.min((clientCount / limits.serviceUsers) * 100, 100);
        
        res.render('careProvider/settings/billing', {
            title: 'Billing & Subscription',
            user: req.session.user,
            careProvider,
            usage: {
                supportWorkers: supportWorkerCount,
                serviceUsers: clientCount,
                operatorsLimit: limits.supportWorkers,
                clientsLimit: limits.serviceUsers,
                operatorsPercentage: operatorsPercentage,
                clientsPercentage: clientsPercentage
            },
            moment
        });
    } catch (error) {
        console.error('Error loading billing:', error);
        req.flash('error', 'Error loading billing information');
        res.redirect('/care-provider/settings');
    }
};

// Upgrade subscription
exports.upgradeSubscription = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { plan } = req.body;
        
        const plans = {
            essential: { 
                name: 'essential',
                maxSupportWorkers: 10, 
                maxServiceUsers: 50, 
                price: 99.99,
                features: ['basic_scheduling', 'interaction_logging', 'email_support']
            },
            professional: { 
                name: 'professional',
                maxSupportWorkers: 30, 
                maxServiceUsers: 200, 
                price: 159.99,
                features: ['advanced_scheduling', 'medication_management', 'guardian_portal', 'priority_support']
            },
            enterprise: { 
                name: 'enterprise',
                maxSupportWorkers: 1000, 
                maxServiceUsers: 5000, 
                price: 299.99,
                features: ['unlimited_everything', 'multi_location', 'api_access', 'dedicated_manager']
            }
        };
        
        const selectedPlan = plans[plan];
        if (!selectedPlan) {
            req.flash('error', 'Invalid plan selected');
            return res.redirect('/care-provider/settings/billing');
        }
        
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + 1); // Monthly billing
        
        await User.findByIdAndUpdate(careProviderId, {
            'careProviderInfo.subscription': {
                plan: selectedPlan.name,
                status: 'active',
                startDate: new Date(),
                expiryDate,
                maxSupportWorkers: selectedPlan.maxSupportWorkers,
                maxServiceUsers: selectedPlan.maxServiceUsers,
                features: selectedPlan.features
            }
        });
        
        // Update session
        req.session.user.careProviderInfo.subscription.plan = selectedPlan.name;
        req.session.user.careProviderInfo.subscription.status = 'active';
        req.session.user.careProviderInfo.subscription.maxSupportWorkers = selectedPlan.maxSupportWorkers;
        req.session.user.careProviderInfo.subscription.maxServiceUsers = selectedPlan.maxServiceUsers;
        
        req.flash('success', `Successfully upgraded to ${plan} plan`);
        res.redirect('/care-provider/settings/billing');
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        req.flash('error', 'Error upgrading subscription');
        res.redirect('/care-provider/settings/billing');
    }
};

// Get team settings
exports.getTeam = async (req, res) => {
    try {
        // Get team members (support workers and admins) for this care provider
        const teamMembers = await User.find({
            careProviderId: req.session.user._id,
            role: { $in: ['support_worker', 'admin'] }
        }).select('firstName lastName email role isActive');
        
        res.render('careProvider/settings/team', {
            title: 'Team Settings',
            user: req.session.user,
            teamMembers,
            moment
        });
    } catch (error) {
        console.error('Error loading team settings:', error);
        req.flash('error', 'Error loading team settings');
        res.redirect('/care-provider/settings');
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
            return res.redirect('/care-provider/settings/team');
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
            role: role || 'support_worker',
            careProviderId: req.session.user._id,
            isActive: true,
            emailVerified: false
        });
        
        await newUser.save();
        
        // TODO: Send invitation email with tempPassword
        
        req.flash('success', `Invitation sent to ${email}`);
        res.redirect('/care-provider/settings/team');
    } catch (error) {
        console.error('Error inviting team member:', error);
        req.flash('error', 'Error sending invitation');
        res.redirect('/care-provider/settings/team');
    }
};

// Get notifications settings
exports.getNotifications = async (req, res) => {
    try {
        const careProvider = await User.findById(req.session.user._id);
        
        res.render('careProvider/settings/notifications', {
            title: 'Notification Settings',
            user: req.session.user,
            careProvider,
            moment
        });
    } catch (error) {
        console.error('Error loading notification settings:', error);
        req.flash('error', 'Error loading notification settings');
        res.redirect('/care-provider/settings');
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
        res.redirect('/care-provider/settings/notifications');
    } catch (error) {
        console.error('Error updating notification settings:', error);
        req.flash('error', 'Error updating notification settings');
        res.redirect('/care-provider/settings/notifications');
    }
};

// Get security settings
exports.getSecurity = async (req, res) => {
    try {
        res.render('careProvider/settings/security', {
            title: 'Security Settings',
            user: req.session.user,
            moment
        });
    } catch (error) {
        console.error('Error loading security settings:', error);
        req.flash('error', 'Error loading security settings');
        res.redirect('/care-provider/settings');
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
        res.redirect('/care-provider/settings/security');
    } catch (error) {
        console.error('Error updating security settings:', error);
        req.flash('error', 'Error updating security settings');
        res.redirect('/care-provider/settings/security');
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
        
        res.render('careProvider/settings/api', {
            title: 'API Settings',
            user: req.session.user,
            apiKey,
            moment
        });
    } catch (error) {
        console.error('Error loading API settings:', error);
        req.flash('error', 'Error loading API settings');
        res.redirect('/care-provider/settings');
    }
};

// Regenerate API key
exports.regenerateApiKey = async (req, res) => {
    try {
        const newApiKey = generateApiKey();
        await User.findByIdAndUpdate(req.session.user._id, { apiKey: newApiKey });
        
        req.flash('success', 'API key regenerated successfully');
        res.redirect('/care-provider/settings/api');
    } catch (error) {
        console.error('Error regenerating API key:', error);
        req.flash('error', 'Error regenerating API key');
        res.redirect('/care-provider/settings/api');
    }
};

// Helper function to generate API key
function generateApiKey() {
    const crypto = require('crypto');
    return 'csh_' + crypto.randomBytes(32).toString('hex');
}