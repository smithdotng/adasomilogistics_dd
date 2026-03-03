const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, hasRole } = require('../controllers/authController');
const User = require('../models/User');
const Client = require('../models/Client');
const Interaction = require('../models/Interaction');
const moment = require('moment');
const bcrypt = require('bcryptjs');

// Middleware for admin routes
router.use(isAuthenticated);
router.use(hasRole(['admin']));

// Admin Dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// Operator Management
router.get('/operators', adminController.getOperators);

// Create Operator Form
router.get('/operators/create', (req, res) => {
    res.render('admin/create-operator', { title: 'Create Operator' });
});

// Create Operator
router.post('/operators', async (req, res) => {
    try {
        const { firstName, lastName, email, password, phone, role } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Operator with this email already exists');
            return res.redirect('/admin/operators/create');
        }
        
        // Create new operator
        const operator = new User({
            firstName,
            lastName,
            email,
            password,
            role: role || 'operator',
            phone,
            isActive: true
        });
        
        await operator.save();
        
        req.flash('success', 'Operator created successfully');
        res.redirect('/admin/operators');
        
    } catch (error) {
        console.error('Create operator error:', error);
        req.flash('error', 'Error creating operator');
        res.redirect('/admin/operators/create');
    }
});

// View Operator Details
router.get('/operators/:id', async (req, res) => {
    try {
        const operatorId = req.params.id;
        
        const operator = await User.findById(operatorId).select('-password');
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/admin/operators');
        }
        
        // Get operator statistics
        const assignedClients = await Client.countDocuments({ assignedOperator: operatorId });
        const totalInteractions = await Interaction.countDocuments({ operator: operatorId });
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ operator: operatorId })
            .populate('client', 'firstName lastName referenceId')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get assigned clients
        const clients = await Client.find({ assignedOperator: operatorId })
            .select('firstName lastName referenceId status')
            .sort({ lastName: 1 })
            .limit(10);
        
        res.render('admin/operator-detail', {
            title: `Operator: ${operator.fullName}`,
            operator,
            stats: {
                assignedClients,
                totalInteractions
            },
            recentInteractions,
            clients,
            moment
        });
        
    } catch (error) {
        console.error('Operator detail error:', error);
        req.flash('error', 'Error loading operator details');
        res.redirect('/admin/operators');
    }
});

// Edit Operator Form
router.get('/operators/:id/edit', async (req, res) => {
    try {
        const operatorId = req.params.id;
        
        const operator = await User.findById(operatorId).select('-password');
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/admin/operators');
        }
        
        res.render('admin/edit-operator', {
            title: `Edit Operator: ${operator.fullName}`,
            operator
        });
        
    } catch (error) {
        console.error('Edit operator form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/admin/operators');
    }
});

// Update Operator
router.put('/operators/:id', async (req, res) => {
    try {
        const operatorId = req.params.id;
        const { firstName, lastName, email, phone, role, isActive } = req.body;
        
        const updateData = {
            firstName,
            lastName,
            email,
            phone,
            role,
            isActive: isActive === 'on'
        };
        
        await User.findByIdAndUpdate(operatorId, updateData);
        
        req.flash('success', 'Operator updated successfully');
        res.redirect(`/admin/operators/${operatorId}`);
        
    } catch (error) {
        console.error('Update operator error:', error);
        req.flash('error', 'Error updating operator');
        res.redirect(`/admin/operators/${req.params.id}/edit`);
    }
});

// Delete Operator
router.delete('/operators/:id', async (req, res) => {
    try {
        const operatorId = req.params.id;
        
        // Check if operator has assigned clients
        const assignedClients = await Client.countDocuments({ assignedOperator: operatorId });
        
        if (assignedClients > 0) {
            req.flash('error', 'Cannot delete operator with assigned clients. Reassign clients first.');
            return res.redirect(`/admin/operators/${operatorId}`);
        }
        
        await User.findByIdAndDelete(operatorId);
        
        req.flash('success', 'Operator deleted successfully');
        res.redirect('/admin/operators');
        
    } catch (error) {
        console.error('Delete operator error:', error);
        req.flash('error', 'Error deleting operator');
        res.redirect(`/admin/operators/${req.params.id}`);
    }
});

// Reset Operator Password
router.post('/operators/:id/reset-password', async (req, res) => {
    try {
        const operatorId = req.params.id;
        const { newPassword } = req.body;
        
        if (!newPassword || newPassword.length < 6) {
            req.flash('error', 'Password must be at least 6 characters long');
            return res.redirect(`/admin/operators/${operatorId}`);
        }
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(operatorId, { password: hashedPassword });
        
        req.flash('success', 'Password reset successfully');
        res.redirect(`/admin/operators/${operatorId}`);
        
    } catch (error) {
        console.error('Reset password error:', error);
        req.flash('error', 'Error resetting password');
        res.redirect(`/admin/operators/${req.params.id}`);
    }
});

// Client Management (Admin view)
router.get('/clients', async (req, res) => {
    try {
        const { status, search, operator, careLevel } = req.query;
        
        let query = {};
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (operator && operator !== 'all') {
            query.assignedOperator = operator;
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
        
        const clients = await Client.find(query)
            .populate('assignedOperator', 'firstName lastName')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });
        
        const operators = await User.find({ 
            role: 'operator', 
            isActive: true 
        }).select('firstName lastName');
        
        res.render('admin/clients', {
            title: 'All Clients',
            clients,
            operators,
            moment
        });
        
    } catch (error) {
        console.error('Admin clients error:', error);
        req.flash('error', 'Error loading clients');
        res.redirect('/admin/dashboard');
    }
});

// Client Detail (Admin view)
router.get('/clients/:id', async (req, res) => {
    try {
        const clientId = req.params.id;
        
        const client = await Client.findById(clientId)
            .populate('assignedOperator', 'firstName lastName email phone')
            .populate('createdBy', 'firstName lastName');
        
        if (!client) {
            req.flash('error', 'Client not found');
            return res.redirect('/admin/clients');
        }
        
        // Get all interactions for this client
        const interactions = await Interaction.find({ client: clientId })
            .populate('operator', 'firstName lastName')
            .sort({ startTime: -1 })
            .limit(20);
        
        // Get client statistics
        const interactionStats = await Interaction.aggregate([
            { $match: { client: client._id } },
            { $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalDuration: { $sum: { $subtract: ['$endTime', '$startTime'] } }
            }}
        ]);
        
        res.render('admin/client-detail', {
            title: `Client: ${client.fullName}`,
            client,
            interactions,
            interactionStats,
            moment
        });
        
    } catch (error) {
        console.error('Admin client detail error:', error);
        req.flash('error', 'Error loading client details');
        res.redirect('/admin/clients');
    }
});

// All Interactions (Admin view)
router.get('/interactions', async (req, res) => {
    try {
        const { type, startDate, endDate, operator, client } = req.query;
        
        let query = {};
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (operator && operator !== 'all') {
            query.operator = operator;
        }
        
        if (client && client !== 'all') {
            query.client = client;
        }
        
        if (startDate && endDate) {
            query.startTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        const interactions = await Interaction.find(query)
            .populate('client', 'firstName lastName referenceId')
            .populate('operator', 'firstName lastName')
            .sort({ startTime: -1 })
            .limit(50);
        
        const operators = await User.find({ 
            role: 'operator', 
            isActive: true 
        }).select('firstName lastName');
        
        const clients = await Client.find()
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 })
            .limit(100);
        
        res.render('admin/interactions', {
            title: 'All Interactions',
            interactions,
            operators,
            clients,
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
            .populate('client', 'firstName lastName referenceId dateOfBirth medicalInfo')
            .populate('operator', 'firstName lastName email phone');
        
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
            // Get client interaction report
            reportData = await Interaction.aggregate([
                {
                    $match: {
                        startTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: '$client',
                        totalInteractions: { $sum: 1 },
                        avgDuration: { $avg: { $subtract: ['$endTime', '$startTime'] } },
                        byType: { $push: '$type' }
                    }
                },
                {
                    $lookup: {
                        from: 'clients',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'clientInfo'
                    }
                },
                { $unwind: '$clientInfo' },
                { $sort: { totalInteractions: -1 } }
            ]);
            
            // Transform data
            reportData = reportData.map(item => ({
                client: `${item.clientInfo.firstName} ${item.clientInfo.lastName}`,
                totalInteractions: item.totalInteractions,
                avgDuration: item.avgDuration ? Math.round(item.avgDuration / (1000 * 60)) : 0, // Convert to minutes
                byType: item.byType.reduce((acc, type) => {
                    acc[type] = (acc[type] || 0) + 1;
                    return acc;
                }, {})
            }));
            
        } else if (reportType === 'operator_performance') {
            // Get operator performance report
            reportData = await Interaction.aggregate([
                {
                    $match: {
                        startTime: { $gte: start, $lte: end }
                    }
                },
                {
                    $group: {
                        _id: '$operator',
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
                        as: 'operatorInfo'
                    }
                },
                { $unwind: '$operatorInfo' },
                { $sort: { totalInteractions: -1 } }
            ]);
            
            // Transform data
            reportData = reportData.map(item => ({
                operator: `${item.operatorInfo.firstName} ${item.operatorInfo.lastName}`,
                totalInteractions: item.totalInteractions,
                totalDuration: item.totalDuration ? Math.round(item.totalDuration / (1000 * 60 * 60)) : 0, // Convert to hours
                completionRate: item.totalInteractions > 0 ? Math.round((item.completed / item.totalInteractions) * 100) : 0
            }));
            
        } else if (reportType === 'client_care_levels') {
            // Get client care levels report
            reportData = await Client.aggregate([
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
        
        const operators = await User.find({ role: 'operator', isActive: true })
            .select('firstName lastName');
        
        res.render('admin/reports', {
            title: 'Reports',
            reportType: reportType || '',
            startDate: start.toISOString().split('T')[0],
            endDate: end.toISOString().split('T')[0],
            reportData,
            operators,
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
        
        if (type === 'clients') {
            const clients = await Client.find()
                .populate('assignedOperator', 'firstName lastName')
                .select('-password -documents -medicalInfo -careInfo -guardians -financialInfo');
            
            data = clients.map(client => ({
                ReferenceID: client.referenceId,
                FirstName: client.firstName,
                LastName: client.lastName,
                DateOfBirth: client.dateOfBirth ? moment(client.dateOfBirth).format('YYYY-MM-DD') : '',
                Age: client.age,
                Status: client.status,
                AssignedOperator: client.assignedOperator ? `${client.assignedOperator.firstName} ${client.assignedOperator.lastName}` : '',
                Created: moment(client.createdAt).format('YYYY-MM-DD HH:mm:ss'),
                Email: client.contact?.email || '',
                Phone: client.contact?.phone?.primary || ''
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
                .populate('client', 'firstName lastName referenceId')
                .populate('operator', 'firstName lastName');
            
            data = interactions.map(interaction => ({
                ID: interaction._id,
                Title: interaction.title,
                Type: interaction.type,
                Client: interaction.client ? `${interaction.client.firstName} ${interaction.client.lastName}` : '',
                ClientReference: interaction.client?.referenceId || '',
                Operator: interaction.operator ? `${interaction.operator.firstName} ${interaction.operator.lastName}` : '',
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
            .populate('client', 'firstName lastName')
            .populate('operator', 'firstName lastName')
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