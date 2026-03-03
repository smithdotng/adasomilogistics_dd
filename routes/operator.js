const express = require('express');
const router = express.Router();
const { isAuthenticated, isOperator, canAccessClient } = require('../middleware/auth');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const Timesheet = require('../models/Timesheet');
const moment = require('moment');

// Operator Dashboard
router.get('/dashboard', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        
        // Get today's visits
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayVisits = await Interaction.find({
            operatorId,
            scheduledStart: { $gte: today, $lt: tomorrow }
        })
        .populate('clientId', 'firstName lastName clientInfo.address')
        .sort('scheduledStart');
        
        // Get assigned clients
        const operator = await User.findById(operatorId)
            .populate('operatorInfo.assignedClients', 'firstName lastName clientInfo.address phone');
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ operatorId })
            .populate('clientId', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);
        
        // Get weekly stats
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weeklyStats = await Interaction.aggregate([
            { 
                $match: { 
                    operatorId: require('../utils/dbHelpers').toObjectId(operatorId),
                    createdAt: { $gte: weekAgo }
                }
            },
            { 
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    completed: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]);
        
        res.render('operator/dashboard', {
            title: 'Operator Dashboard',
            user: req.session.user,
            todayVisits,
            assignedClients: operator.operatorInfo?.assignedClients || [],
            recentInteractions,
            weeklyStats,
            moment
        });
    } catch (error) {
        console.error('Error loading operator dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// My Schedule
router.get('/schedule', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        const { view = 'week', date } = req.query;
        const selectedDate = date ? new Date(date) : new Date();
        
        let startDate, endDate;
        
        if (view === 'day') {
            startDate = new Date(selectedDate);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(selectedDate);
            endDate.setHours(23, 59, 59, 999);
        } else if (view === 'week') {
            startDate = moment(selectedDate).startOf('week').toDate();
            endDate = moment(selectedDate).endOf('week').toDate();
        } else if (view === 'month') {
            startDate = moment(selectedDate).startOf('month').toDate();
            endDate = moment(selectedDate).endOf('month').toDate();
        } else {
            // List view - get upcoming
            startDate = new Date();
            endDate = moment().add(30, 'days').toDate();
        }
        
        const interactions = await Interaction.find({
            operatorId,
            scheduledStart: { $gte: startDate, $lte: endDate }
        })
        .populate('clientId', 'firstName lastName clientInfo.address')
        .sort('scheduledStart');
        
        res.render('operator/schedule', {
            title: 'My Schedule',
            user: req.session.user,
            interactions,
            view,
            selectedDate,
            moment
        });
    } catch (error) {
        console.error('Error loading schedule:', error);
        req.flash('error', 'Error loading schedule');
        res.redirect('/operator/dashboard');
    }
});

// My Clients
router.get('/clients', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        const { search, sort } = req.query;
        
        const operator = await User.findById(operatorId)
            .populate({
                path: 'operatorInfo.assignedClients',
                match: search ? {
                    $or: [
                        { firstName: { $regex: search, $options: 'i' } },
                        { lastName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                } : {},
                populate: {
                    path: 'clientInfo.carePlan'
                }
            });
        
        let clients = operator.operatorInfo?.assignedClients || [];
        
        // Sort clients
        if (sort === 'name') {
            clients.sort((a, b) => a.firstName.localeCompare(b.firstName));
        } else if (sort === 'recent') {
            // This would need last visit date - implement as needed
        }
        
        res.render('operator/clients', {
            title: 'My Clients',
            user: req.session.user,
            clients,
            filters: { search, sort },
            moment
        });
    } catch (error) {
        console.error('Error loading clients:', error);
        req.flash('error', 'Error loading clients');
        res.redirect('/operator/dashboard');
    }
});

// View Single Client
router.get('/clients/:id', isAuthenticated, isOperator, canAccessClient('id'), async (req, res) => {
    try {
        const clientId = req.params.id;
        
        const client = await User.findById(clientId)
            .populate('clientInfo.carePlan')
            .populate('clientInfo.gpDetails')
            .populate('clientInfo.emergencyContacts');
        
        const recentInteractions = await Interaction.find({
            clientId,
            operatorId: req.session.user._id
        })
        .sort('-createdAt')
        .limit(10);
        
        res.render('operator/client-details', {
            title: 'Client Details',
            user: req.session.user,
            client,
            recentInteractions,
            moment
        });
    } catch (error) {
        console.error('Error loading client:', error);
        req.flash('error', 'Error loading client');
        res.redirect('/operator/clients');
    }
});

// =============== INTERACTION ROUTES ===============

// List all interactions (with filters)
router.get('/interactions', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        const { status, period, client } = req.query;
        
        let query = { operatorId };
        
        // Filter by status
        if (status && status !== 'all') {
            query.status = status;
        }
        
        // Filter by period
        if (period) {
            const now = new Date();
            if (period === 'today') {
                const start = new Date(now.setHours(0, 0, 0, 0));
                const end = new Date(now.setHours(23, 59, 59, 999));
                query.scheduledStart = { $gte: start, $lte: end };
            } else if (period === 'week') {
                const start = moment().startOf('week').toDate();
                const end = moment().endOf('week').toDate();
                query.scheduledStart = { $gte: start, $lte: end };
            } else if (period === 'month') {
                const start = moment().startOf('month').toDate();
                const end = moment().endOf('month').toDate();
                query.scheduledStart = { $gte: start, $lte: end };
            }
        }
        
        // Filter by client
        if (client) {
            query.clientId = client;
        }
        
        const interactions = await Interaction.find(query)
            .populate('clientId', 'firstName lastName')
            .sort('-scheduledStart');
        
        // Get unique clients for filter dropdown
        const clients = await User.find({
            'operatorInfo.assignedClients': operatorId
        }).select('firstName lastName');
        
        res.render('operator/interactions', {
            title: 'My Visits',
            user: req.session.user,
            interactions,
            clients,
            filters: { status, period, client },
            moment
        });
    } catch (error) {
        console.error('Error loading interactions:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/operator/dashboard');
    }
});

// Form to create new interaction
router.get('/interactions/create/:clientId', isAuthenticated, isOperator, canAccessClient('clientId'), async (req, res) => {
    try {
        const clientId = req.params.clientId;
        
        const client = await User.findById(clientId)
            .select('firstName lastName clientInfo');
        
        res.render('operator/interactions/create', {
            title: 'Log New Visit',
            user: req.session.user,
            client,
            moment
        });
    } catch (error) {
        console.error('Error loading create form:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/operator/clients');
    }
});

// Create new interaction
router.post('/interactions', isAuthenticated, isOperator, async (req, res) => {
    try {
        const {
            clientId,
            type,
            title,
            description,
            scheduledStart,
            scheduledEnd,
            actualStart,
            actualEnd,
            status,
            activities,
            mood,
            appetite,
            energy,
            pain,
            notes,
            medications
        } = req.body;
        
        // Calculate duration if actual times provided
        let duration = null;
        if (actualStart && actualEnd) {
            duration = Math.round((new Date(actualEnd) - new Date(actualStart)) / 60000);
        }
        
        const interaction = new Interaction({
            clientId,
            operatorId: req.session.user._id,
            providerId: req.session.user.providerId,
            type,
            title: title || `${type.replace('_', ' ')} with ${clientId}`,
            description,
            scheduledStart: scheduledStart || new Date(),
            scheduledEnd: scheduledEnd || new Date(),
            actualStart: actualStart || null,
            actualEnd: actualEnd || null,
            duration,
            status: status || 'completed',
            activities: activities ? JSON.parse(activities) : [],
            observations: {
                wellbeing: {
                    mood,
                    appetite,
                    energy,
                    pain: parseInt(pain) || 0
                },
                notes
            },
            medications: medications ? JSON.parse(medications) : [],
            createdBy: req.session.user._id
        });
        
        await interaction.save();
        
        req.flash('success', 'Visit logged successfully');
        res.redirect(`/operator/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error creating interaction:', error);
        req.flash('error', 'Error logging visit');
        res.redirect('/operator/dashboard');
    }
});

// View single interaction
router.get('/interactions/:id', isAuthenticated, isOperator, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            operatorId: req.session.user._id
        })
        .populate('clientId', 'firstName lastName clientInfo.address phone')
        .populate('operatorId', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/operator/interactions');
        }
        
        res.render('operator/interactions/show', {
            title: 'Visit Details',
            user: req.session.user,
            interaction,
            moment
        });
    } catch (error) {
        console.error('Error loading interaction:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/operator/interactions');
    }
});

// Edit interaction form
router.get('/interactions/:id/edit', isAuthenticated, isOperator, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            operatorId: req.session.user._id
        }).populate('clientId', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/operator/interactions');
        }
        
        res.render('operator/interactions/edit', {
            title: 'Edit Visit',
            user: req.session.user,
            interaction,
            moment
        });
    } catch (error) {
        console.error('Error loading interaction:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/operator/interactions');
    }
});

// Update interaction
router.put('/interactions/:id', isAuthenticated, isOperator, async (req, res) => {
    try {
        const {
            type,
            title,
            description,
            actualStart,
            actualEnd,
            status,
            mood,
            appetite,
            energy,
            pain,
            notes
        } = req.body;
        
        const updateData = {
            type,
            title,
            description,
            actualStart: actualStart || null,
            actualEnd: actualEnd || null,
            status,
            'observations.wellbeing': {
                mood,
                appetite,
                energy,
                pain: parseInt(pain) || 0
            },
            'observations.notes': notes,
            updatedAt: new Date()
        };
        
        // Recalculate duration if times updated
        if (actualStart && actualEnd) {
            updateData.duration = Math.round((new Date(actualEnd) - new Date(actualStart)) / 60000);
        }
        
        const interaction = await Interaction.findOneAndUpdate(
            { _id: req.params.id, operatorId: req.session.user._id },
            updateData,
            { new: true }
        );
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/operator/interactions');
        }
        
        req.flash('success', 'Visit updated successfully');
        res.redirect(`/operator/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error updating interaction:', error);
        req.flash('error', 'Error updating visit');
        res.redirect(`/operator/interactions/${req.params.id}/edit`);
    }
});

// Start a visit (change status to in-progress)
router.post('/interactions/:id/start', isAuthenticated, isOperator, async (req, res) => {
    try {
        const interaction = await Interaction.findOneAndUpdate(
            { _id: req.params.id, operatorId: req.session.user._id, status: 'scheduled' },
            {
                status: 'in-progress',
                actualStart: new Date(),
                'location.checkInTime': new Date(),
                'location.checkInLocation': req.body.location || null
            },
            { new: true }
        );
        
        if (!interaction) {
            req.flash('error', 'Cannot start this visit');
            return res.redirect('/operator/schedule');
        }
        
        req.flash('success', 'Visit started');
        res.redirect(`/operator/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error starting visit:', error);
        req.flash('error', 'Error starting visit');
        res.redirect('/operator/schedule');
    }
});

// Complete a visit
router.post('/interactions/:id/complete', isAuthenticated, isOperator, async (req, res) => {
    try {
        const {
            observations,
            medications,
            activities,
            notes
        } = req.body;
        
        const interaction = await Interaction.findOneAndUpdate(
            { _id: req.params.id, operatorId: req.session.user._id, status: 'in-progress' },
            {
                status: 'completed',
                actualEnd: new Date(),
                'observations.wellbeing': observations?.wellbeing,
                'observations.notes': notes || observations?.notes,
                medications: medications ? JSON.parse(medications) : [],
                activities: activities ? JSON.parse(activities) : [],
                'location.checkOutTime': new Date(),
                'location.checkOutLocation': req.body.location || null
            },
            { new: true }
        );
        
        // Calculate duration
        if (interaction && interaction.actualStart) {
            const duration = Math.round((interaction.actualEnd - interaction.actualStart) / 60000);
            interaction.duration = duration;
            await interaction.save();
        }
        
        if (!interaction) {
            req.flash('error', 'Cannot complete this visit');
            return res.redirect('/operator/schedule');
        }
        
        req.flash('success', 'Visit completed successfully');
        res.redirect(`/operator/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error completing visit:', error);
        req.flash('error', 'Error completing visit');
        res.redirect('/operator/schedule');
    }
});

// =============== TIMESHEET ROUTES ===============

// My Timesheets
router.get('/timesheets', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        
        const timesheets = await Timesheet.find({ operatorId })
            .sort('-periodEnd');
        
        res.render('operator/timesheets', {
            title: 'My Timesheets',
            user: req.session.user,
            timesheets,
            moment
        });
    } catch (error) {
        console.error('Error loading timesheets:', error);
        req.flash('error', 'Error loading timesheets');
        res.redirect('/operator/dashboard');
    }
});

// View Single Timesheet
router.get('/timesheets/:id', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        const timesheet = await Timesheet.findOne({
            _id: req.params.id,
            operatorId
        }).populate('entries.clientId', 'firstName lastName');
        
        if (!timesheet) {
            req.flash('error', 'Timesheet not found');
            return res.redirect('/operator/timesheets');
        }
        
        res.render('operator/timesheet-details', {
            title: 'Timesheet Details',
            user: req.session.user,
            timesheet,
            moment
        });
    } catch (error) {
        console.error('Error loading timesheet:', error);
        req.flash('error', 'Error loading timesheet');
        res.redirect('/operator/timesheets');
    }
});

// =============== PROFILE ROUTES ===============

// Profile
router.get('/profile', isAuthenticated, isOperator, async (req, res) => {
    try {
        const operator = await User.findById(req.session.user._id);
        
        res.render('operator/profile', {
            title: 'My Profile',
            user: req.session.user,
            operator,
            moment
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/operator/dashboard');
    }
});

// Update Profile
router.post('/profile', isAuthenticated, isOperator, async (req, res) => {
    try {
        const { phone, address, emergencyContact } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            phone,
            address,
            'operatorInfo.emergencyContact': emergencyContact
        });
        
        req.flash('success', 'Profile updated successfully');
        res.redirect('/operator/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', 'Error updating profile');
        res.redirect('/operator/profile');
    }
});

module.exports = router;