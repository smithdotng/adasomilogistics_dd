const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, hasRole } = require('../controllers/authController');
const User = require('../models/User');
const ServiceUser = require('../models/ServiceUser');
const Interaction = require('../models/Interaction');
const moment = require('moment');
const bcrypt = require('bcryptjs');

// Middleware for admin routes
router.use(isAuthenticated);
router.use(hasRole(['admin']));

// Admin Dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// Support Worker Management
router.get('/support-workers', adminController.getOperators);

// Create Support Worker Form
router.get('/support-workers/create', (req, res) => {
    res.render('admin/create-supportWorker', { title: 'Create Support Worker' });
});

// Create Support Worker
router.post('/support-workers', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, role } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Support Worker with this email already exists');
            return res.redirect('/admin/support-workers/create');
        }
        
        // Create new support worker
        const supportWorker = new User({
            firstName,
            lastName,
            email,
            password,
            role: role || 'support_worker',
            phone,
            isActive: true
        });
        
        await supportWorker.save();
        
        req.flash('success', 'Support Worker created successfully');
        res.redirect('/admin/support-workers');
        
    } catch (error) {
        console.error('Create support worker error:', error);
        req.flash('error', 'Error creating support worker');
        res.redirect('/admin/support-workers/create');
    }
});

// View Support Worker Details
router.get('/support-workers/:id', async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        
        const supportWorker = await User.findById(supportWorkerId).select('-password');
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/admin/support-workers');
        }
        
        // Get support worker statistics
        const assignedServiceUsers = await ServiceUser.countDocuments({ assignedSupportWorker: supportWorkerId });
        const totalInteractions = await Interaction.countDocuments({ supportWorker: supportWorkerId });
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ supportWorker: supportWorkerId })
            .populate('service_user', 'firstName lastName referenceId')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get assigned service users
        const serviceUsers = await ServiceUser.find({ assignedSupportWorker: supportWorkerId })
            .select('firstName lastName referenceId status')
            .sort({ lastName: 1 })
            .limit(10);
        
        res.render('admin/support-worker-detail', {
            title: `Support Worker: ${supportWorker.fullName}`,
            supportWorker,
            stats: {
                assignedServiceUsers,
                totalInteractions
            },
            recentInteractions,
            serviceUsers,
            moment
        });
        
    } catch (error) {
        console.error('Support Worker detail error:', error);
        req.flash('error', 'Error loading support worker details');
        res.redirect('/admin/support-workers');
    }
});

// Edit Support Worker Form
router.get('/support-workers/:id/edit', async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        
        const supportWorker = await User.findById(supportWorkerId).select('-password');
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/admin/support-workers');
        }
        
        res.render('admin/edit-supportWorker', {
            title: `Edit Support Worker: ${supportWorker.fullName}`,
            supportWorker
        });
        
    } catch (error) {
        console.error('Edit support worker form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/admin/support-workers');
    }
});

// Update Support Worker
router.put('/support-workers/:id', async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        const { firstName, lastName, email, phone, role, isActive } = req.body;
        
        const updateData = {
            firstName,
            lastName,
            email,
            phone,
            role,
            isActive: isActive === 'on'
        };
        
        await User.findByIdAndUpdate(supportWorkerId, updateData);
        
        req.flash('success', 'Support Worker updated successfully');
        res.redirect(`/admin/support-workers/${supportWorkerId}`);
        
    } catch (error) {
        console.error('Update support worker error:', error);
        req.flash('error', 'Error updating support worker');
        res.redirect(`/admin/support-workers/${req.params.id}/edit`);
    }
});

// Delete Support Worker
router.delete('/support-workers/:id', async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        
        // Check if support worker has assigned service users
        const assignedServiceUsers = await ServiceUser.countDocuments({ assignedSupportWorker: supportWorkerId });
        
        if (assignedServiceUsers > 0) {
            req.flash('error', 'Cannot delete support worker with assigned service users. Reassign service users first.');
            return res.redirect(`/admin/support-workers/${supportWorkerId}`);
        }
        
        await User.findByIdAndDelete(supportWorkerId);
        
        req.flash('success', 'Support Worker deleted successfully');
        res.redirect('/admin/support-workers');
        
    } catch (error) {
        console.error('Delete support worker error:', error);
        req.flash('error', 'Error deleting support worker');
        res.redirect(`/admin/support-workers/${req.params.id}`);
    }
});

// Reset Support Worker Password
router.post('/support-workers/:id/reset-password', async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect(`/admin/support-workers/${supportWorkerId}`);
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(supportWorkerId, { password: hashedPassword });
        
        req.flash('success', 'Password reset successfully');
        res.redirect(`/admin/support-workers/${supportWorkerId}`);
        
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error', 'Error resetting password');
        res.redirect(`/admin/support-workers/${req.params.id}`);
    }
});

// Service User Management (Admin view)
router.get('/service-users', async (req, res) => {
    try {
        const { status, search, supportWorker, careLevel } = req.query;
        
        let query = {};
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (supportWorker && supportWorker !== 'all') {
            query.assignedSupportWorker = supportWorker;
        }
        
        if (careLevel && careLevel !== 'all') {
            query['careInfo.careLevel'] = careLevel;
        }
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { referenceId: { $regex: search, $options: 'i' } },
                { 'contact.email': { $regex: search, $options: 'i' } },
                { 'contact.phone.primary': { $regex: search, $options: 'i' } }
            ];
        }
        
        const serviceUsers = await ServiceUser.find(query)
            .populate('assignedSupportWorker', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });
        
        const supportWorkers = await User.find({ 
            role: 'support_worker', 
            isActive: true 
        }).select('firstName lastName');
        
        res.render('admin/service-users', {
            title: 'All Service Users',
            serviceUsers,
            supportWorkers,
            moment
        });
        
    } catch (error) {
        console.error('Admin service users error:', error);
        req.flash('error', 'Error loading service users');
        res.redirect('/admin/dashboard');
    }
});

// Service User Detail (Admin view)
router.get('/service-users/:id', async (req, res) => {
    try {
        const serviceUserId = req.params.id;
        
        const serviceUser = await ServiceUser.findById(serviceUserId)
            .populate('assignedSupportWorker', 'firstName lastName email phone')
            .populate('createdBy', 'firstName lastName');
        
        if (!serviceUser) {
            req.flash('error', 'Service User not found');
            return res.redirect('/admin/service-users');
        }
        
        // Get all interactions for this service user
        const interactions = await Interaction.find({ serviceUser: serviceUserId })
            .populate('support_worker', 'firstName lastName')
            .sort({ startTime: -1 })
            .limit(20);
        
        // Get service user statistics
        const interactionStats = await Interaction.aggregate([
            { $match: { serviceUser: serviceUser._id } },
            { $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalDuration: { $sum: { $subtract: ['$endTime', '$startTime'] } }
            }}
        ]);
        
        res.render('admin/service-user-detail', {
            title: `Service User: ${serviceUser.fullName}`,
            serviceUser,
            interactions,
            interactionStats,
            moment
        });
        
    } catch (error) {
        console.error('Admin service user detail error:', error);
        req.flash('error', 'Error loading service user details');
        res.redirect('/admin/service-users');
    }
});

// All Interactions (Admin view)
router.get('/interactions', async (req, res) => {
    try {
        const { type, startDate, endDate, supportWorker, serviceUser } = req.query;
        
        let query = {};
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (supportWorker && supportWorker !== 'all') {
            query.supportWorker = supportWorker;
        }
        
        if (serviceUser && serviceUser !== 'all') {
            query.serviceUser = serviceUser;
        }
        
        if (startDate && endDate) {
            query.startTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const interactions = await Interaction.find(query)
            .populate('service_user', 'firstName lastName referenceId')
            .populate('support_worker', 'firstName lastName')
            .sort({ startTime: -1 })
            .limit(50);
        
        const supportWorkers = await User.find({ 
            role: 'support_worker', 
            isActive: true 
        }).select('firstName lastName');
        
        const serviceUsers = await ServiceUser.find()
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 })
            .limit(100);
        
        res.render('admin/interactions', {
            title: 'All Interactions',
            interactions,
            supportWorkers,
            serviceUsers,
            moment
        });
        
    } catch (error) {
        console.error('Admin interactions error:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/admin/dashboard');
    }
});

// Interaction Detail (Admin view)
router.get('/interactions/:id', async (req, res) => {
    try {
        const interactionId = req.params.id;
        
        const interaction = await Interaction.findById(interactionId)
            .populate('service_user', 'firstName lastName referenceId dateOfBirth medicalInfo')
            .populate('support_worker', 'firstName lastName email phone');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/admin/interactions');
        }
        
        res.render('admin/interaction-detail', {
            title: `Interaction: ${interaction.title}`,
            interaction,
            moment
        });
        
    } catch (error) {
        console.error('Admin interaction detail error:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/admin/interactions');
    }
});

// Reports
router.get('/reports', async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.query;
        
        // Default to current month if no dates provided
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date();
        
        let reportData = {};
        
        if (reportType === 'client_interactions') {
            // Get service user interaction report
            reportData = await Interaction.aggregate([
                {
                    $match: {
                        startTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: '$service user',
                        totalInteractions: { $sum: 1 },
                        avgDuration: { $avg: { $subtract: ['$endTime', '$startTime'] } },
                        byType: { $push: '$type' }
                    }
                },
                {
                    $lookup: {
                        from: 'service users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'serviceUserInfo'
                    }
                },
                { $unwind: '$serviceUserInfo' },
                { $sort: { totalInteractions: -1 } }
            ]);
            
            // Transform data
            reportData = reportData.map(item => ({
                serviceUser: `${item.serviceUserInfo.firstName} ${item.serviceUserInfo.lastName}`,
                totalInteractions: item.totalInteractions,
                avgDuration: item.avgDuration ? Math.round(item.avgDuration / (1000 * 60)) : 0, // Convert to minutes
                byType: item.byType.reduce((acc, type) => {
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {})
            }));
            
        } else if (reportType === 'operator_performance') {
            // Get support worker performance report
            reportData = await Interaction.aggregate([
                {
                    $match: {
                        startTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: '$support worker',
                        totalInteractions: { $sum: 1 },
                        totalDuration: { $sum: { $subtract: ['$endTime', '$startTime'] } },
                        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
                    }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'supportWorkerInfo'
                    }
                },
                { $unwind: '$supportWorkerInfo' },
                { $sort: { totalInteractions: -1 } }
            ]);
            
            // Transform data
            reportData = reportData.map(item => ({
                supportWorker: `${item.supportWorkerInfo.firstName} ${item.supportWorkerInfo.lastName}`,
                totalInteractions: item.totalInteractions,
                totalDuration: item.totalDuration ? Math.round(item.totalDuration / (1000 * 60 * 60)) : 0, // Convert to hours
                completionRate: item.totalInteractions > 0 ? Math.round((item.completed / item.totalInteractions) * 100) : 0
            }));
            
        } else if (reportType === 'client_care_levels') {
            // Get service user care levels report
            reportData = await ServiceUser.aggregate([
                {
                    $group: {
                        _id: '$careInfo.careLevel',
                        count: { $sum: 1 },
                        avgAge: { $avg: { $subtract: [new Date(), '$dateOfBirth'] } }
                    }
                },
                { $sort: { count: -1 } }
            ]);
            
            // Transform data
            reportData = reportData.map(item => ({
                careLevel: item._id || 'Not specified',
                count: item.count,
                avgAge: item.avgAge ? Math.floor(item.avgAge / (1000 * 60 * 60 * 24 * 365.25)) : 0 // Convert to years
            }));
        }
        
        const supportWorkers = await User.find({ role: 'support_worker', isActive: true })
            .select('firstName lastName');
        
        res.render('admin/reports', {
            title: 'Reports',
            reportType: reportType || '',
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            reportData,
            supportWorkers,
            moment
        });
        
    } catch (error) {
        console.error('Reports error:', error);
        req.flash('error', 'Error generating reports');
        res.redirect('/admin/dashboard');
    }
});

// Export Data (CSV)
router.get('/export/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { startDate, endDate } = req.query;
        
        let data = [];
        let filename = '';
        
        if (type === 'service users') {
            const serviceUsers = await ServiceUser.find()
                .populate('assignedSupportWorker', 'firstName lastName')
                .select('-password -documents -medicalInfo -careInfo -guardians -financialInfo');
            
            data = serviceUsers.map(serviceUser => ({
                ReferenceID: serviceUser.referenceId,
                FirstName: serviceUser.firstName,
                LastName: serviceUser.lastName,
                DateOfBirth: serviceUser.dateOfBirth ? moment(serviceUser.dateOfBirth).format('YYYY-MM-DD') : '',
                Age: serviceUser.age,
                Status: serviceUser.status,
                AssignedOperator: serviceUser.assignedSupportWorker ? `${serviceUser.assignedSupportWorker.firstName} ${serviceUser.assignedSupportWorker.lastName}` : '',
                Created: moment(serviceUser.createdAt).format('YYYY-MM-DD HH:mm:ss'),
                Email: serviceUser.contact?.email || '',
                Phone: serviceUser.contact?.phone?.primary || ''
            }));
            
            filename = `clients_${moment().format('YYYYMMDD_HHmmss')}.csv`;
            
        } else if (type === 'interactions') {
            let query = {};
            if (startDate && endDate) {
                query.startTime = {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                };
            }
            
            const interactions = await Interaction.find(query)
                .populate('service_user', 'firstName lastName referenceId')
                .populate('support_worker', 'firstName lastName');
            
            data = interactions.map(interaction => ({
                ID: interaction._id,
                Title: interaction.title,
                Type: interaction.type,
                ServiceUser: interaction.serviceUser ? `${interaction.serviceUser.firstName} ${interaction.serviceUser.lastName}` : '',
                ClientReference: interaction.serviceUser?.referenceId || '',
                SupportWorker: interaction.supportWorker ? `${interaction.supportWorker.firstName} ${interaction.supportWorker.lastName}` : '',
                StartTime: moment(interaction.startTime).format('YYYY-MM-DD HH:mm:ss'),
                EndTime: moment(interaction.endTime).format('YYYY-MM-DD HH:mm:ss'),
                Duration: interaction.duration ? `${interaction.duration.hours}h ${interaction.duration.minutes}m` : '',
                Location: interaction.location,
                Status: interaction.status,
                Created: moment(interaction.createdAt).format('YYYY-MM-DD HH:mm:ss')
            }));
            
            filename = `interactions_${moment().format('YYYYMMDD_HHmmss')}.csv`;
        }
        
        // Convert to CSV
        const headers = Object.keys(data[0] || {}).join(',');
        const rows = data.map(row => Object.values(row).map(value => 
            `"${String(value).replace(/"/g, '""')}"`
        ).join(','));
        
        const csv = [headers, ...rows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
        
    } catch (error) {
        console.error('Export error:', error);
        req.flash('error', 'Error exporting data');
        res.redirect('/admin/dashboard');
    }
});

// System Settings
router.get('/settings', (req, res) => {
    res.render('admin/settings', {
        title: 'System Settings'
    });
});

// Activity Log
router.get('/activity', async (req, res) => {
    try {
        // For now, we'll show recent interactions as activity log
        // In a production system, you would have a separate Activity model
        const recentActivities = await Interaction.find()
            .populate('service_user', 'firstName lastName')
            .populate('support_worker', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(50);
        
        res.render('admin/activity', {
            title: 'Activity Log',
            activities: recentActivities,
            moment
        });
        
    } catch (error) {
        console.error('Activity log error:', error);
        req.flash('error', 'Error loading activity log');
        res.redirect('/admin/dashboard');
    }
});

module.exports = router;