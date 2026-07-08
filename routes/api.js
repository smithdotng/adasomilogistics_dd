const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const { isAuthenticated } = require('../middleware/auth');

// Get dashboard statistics for API
router.get('/stats/dashboard', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.user._id;
        const userRole = req.session.user.role;
        
        let stats = {};
        
        if (userRole === 'care_provider') {
            const [totalServiceUsers, totalOperators, totalInteractions, activeSchedules] = await Promise.all([
                User.countDocuments({ role: 'service_user', careProviderId: userId, isActive: true }),
                User.countDocuments({ role: 'support_worker', careProviderId: userId, isActive: true }),
                Interaction.countDocuments({ careProviderId: userId }),
                Schedule.countDocuments({ careProviderId: userId, isActive: true })
            ]);
            
            stats = { totalServiceUsers, totalOperators, totalInteractions, activeSchedules };
        } else if (userRole === 'support_worker') {
            const [todayVisits, assignedServiceUsers, recentInteractions] = await Promise.all([
                Interaction.countDocuments({ 
                    supportWorkerId: userId,
                    scheduledStart: { 
                        $gte: new Date().setHours(0,0,0,0),
                        $lt: new Date().setHours(23,59,59,999)
                    }
                }),
                User.countDocuments({ 
                    'supportWorkerInfo.assignedServiceUsers': userId 
                }),
                Interaction.countDocuments({ 
                    supportWorkerId: userId,
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                })
            ]);
            
            stats = { todayVisits, assignedServiceUsers, recentInteractions };
        }
        
        res.json({ success: true, stats });
    } catch (error) {
        console.error('API Stats Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get service users list for API (for dropdowns, etc.)
router.get('/service-users', isAuthenticated, async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const serviceUsers = await User.find({ 
            role: 'service_user', 
            careProviderId,
            isActive: true 
        }).select('firstName lastName serviceUserInfo.nhsNumber');
        
        res.json({ success: true, serviceUsers });
    } catch (error) {
        console.error('API Service Users Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get support workers list for API
router.get('/support-workers', isAuthenticated, async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const supportWorkers = await User.find({ 
            role: 'support_worker', 
            careProviderId,
            isActive: true 
        }).select('firstName lastName supportWorkerInfo.employeeId');
        
        res.json({ success: true, supportWorkers });
    } catch (error) {
        console.error('API Support Workers Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get schedule for a specific date
router.get('/schedule/:date', isAuthenticated, async (req, res) => {
    try {
        const date = new Date(req.params.date);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0));
        const endOfDay = new Date(date.setHours(23, 59, 59, 999));
        
        let query = {};
        
        if (req.session.user.role === 'care_provider') {
            query.careProviderId = req.session.user._id;
        } else if (req.session.user.role === 'support_worker') {
            query.supportWorkerId = req.session.user._id;
        }
        
        const schedules = await Schedule.find({
            ...query,
            $or: [
                { 'recurrence.startDate': { $lte: endOfDay } },
                { createdAt: { $gte: startOfDay, $lte: endOfDay } }
            ]
        })
        .populate('serviceUserId', 'firstName lastName')
        .populate('supportWorkerId', 'firstName lastName')
        .sort('startTime');
        
        res.json({ success: true, schedules });
    } catch (error) {
        console.error('API Schedule Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get recent interactions
router.get('/interactions/recent', isAuthenticated, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        
        let query = {};
        
        if (req.session.user.role === 'care_provider') {
            query.careProviderId = req.session.user._id;
        } else if (req.session.user.role === 'support_worker') {
            query.supportWorkerId = req.session.user._id;
        } else if (req.session.user.role === 'service_user') {
            query.serviceUserId = req.session.user._id;
        }
        
        const interactions = await Interaction.find(query)
            .populate('serviceUserId', 'firstName lastName')
            .populate('supportWorkerId', 'firstName lastName')
            .sort('-createdAt')
            .limit(limit);
        
        res.json({ success: true, interactions });
    } catch (error) {
        console.error('API Interactions Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check-in/Check-out for visits
router.post('/visits/:id/checkin', isAuthenticated, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            supportWorkerId: req.session.user._id,
            status: 'scheduled'
        });
        
        if (!interaction) {
            return res.status(404).json({ success: false, error: 'Visit not found or not authorized' });
        }
        
        interaction.status = 'in_progress';
        interaction.actualStart = new Date();
        interaction.location.checkInTime = new Date();
        interaction.location.checkInLocation = req.body.location || null;
        
        await interaction.save();
        
        res.json({ success: true, interaction });
    } catch (error) {
        console.error('API Check-in Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/visits/:id/checkout', isAuthenticated, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            supportWorkerId: req.session.user._id,
            status: 'in_progress'
        });
        
        if (!interaction) {
            return res.status(404).json({ success: false, error: 'Visit not found or not authorized' });
        }
        
        interaction.status = 'completed';
        interaction.actualEnd = new Date();
        interaction.location.checkOutTime = new Date();
        interaction.location.checkOutLocation = req.body.location || null;
        interaction.duration = Math.round((interaction.actualEnd - interaction.actualStart) / 60000); // in minutes
        
        if (req.body.observations) {
            interaction.observations = req.body.observations;
        }
        
        await interaction.save();
        
        res.json({ success: true, interaction });
    } catch (error) {
        console.error('API Check-out Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;