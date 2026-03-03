const express = require('express');
const router = express.Router();
const { isAuthenticated, isClient } = require('../middleware/auth');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const CarePlan = require('../models/CarePlan');
const moment = require('moment');

// Client Dashboard
router.get('/dashboard', isAuthenticated, isClient, async (req, res) => {
    try {
        const clientId = req.session.user._id;
        
        const client = await User.findById(clientId)
            .populate('clientInfo.primaryCarer')
            .populate('clientInfo.secondaryCarers')
            .populate('clientInfo.guardians');
        
        const carePlan = await CarePlan.findOne({ clientId });
        
        // Get upcoming visits
        const upcomingVisits = await Interaction.find({
            clientId,
            scheduledStart: { $gte: new Date() },
            status: 'scheduled'
        })
        .populate('operatorId', 'firstName lastName')
        .sort('scheduledStart')
        .limit(5);
        
        // Get recent visits
        const recentVisits = await Interaction.find({
            clientId,
            status: 'completed'
        })
        .populate('operatorId', 'firstName lastName')
        .sort('-scheduledStart')
        .limit(10);
        
        // Calculate stats
        const totalVisits = await Interaction.countDocuments({ clientId });
        const upcomingCount = await Interaction.countDocuments({
            clientId,
            scheduledStart: { $gte: new Date() }
        });
        
        // Get today's medications (simplified)
        const todaysMeds = client.clientInfo?.medications?.slice(0, 3) || [];
        
        res.render('client/dashboard', {
            title: 'My Dashboard',
            user: req.session.user,
            clientInfo: client.clientInfo,
            carePlan,
            upcomingVisits,
            recentVisits,
            primaryCarer: client.clientInfo?.primaryCarer,
            secondaryCarers: client.clientInfo?.secondaryCarers,
            emergencyContacts: client.clientInfo?.emergencyContacts,
            todaysMeds,
            stats: {
                totalVisits,
                upcomingVisits: upcomingCount
            },
            moment
        });
    } catch (error) {
        console.error('Error loading client dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Care Plan
router.get('/care-plan', isAuthenticated, isClient, async (req, res) => {
    try {
        const clientId = req.session.user._id;
        
        const client = await User.findById(clientId);
        const carePlan = await CarePlan.findOne({ clientId });
        
        res.render('client/care-plan', {
            title: 'My Care Plan',
            user: req.session.user,
            clientInfo: client.clientInfo,
            carePlan,
            moment
        });
    } catch (error) {
        console.error('Error loading care plan:', error);
        req.flash('error', 'Error loading care plan');
        res.redirect('/client/dashboard');
    }
});

// Visits List
router.get('/visits', isAuthenticated, isClient, async (req, res) => {
    try {
        const clientId = req.session.user._id;
        const { filter, sort } = req.query;
        
        let query = { clientId };
        
        if (filter === 'upcoming') {
            query.scheduledStart = { $gte: new Date() };
        } else if (filter === 'past') {
            query.scheduledStart = { $lt: new Date() };
        }
        
        let sortOption = { scheduledStart: -1 };
        if (sort === 'oldest') {
            sortOption = { scheduledStart: 1 };
        }
        
        const visits = await Interaction.find(query)
            .populate('operatorId', 'firstName lastName')
            .sort(sortOption);
        
        res.render('client/visits', {
            title: 'My Visits',
            user: req.session.user,
            visits,
            filter: filter || 'all',
            sort: sort || 'newest',
            moment
        });
    } catch (error) {
        console.error('Error loading visits:', error);
        req.flash('error', 'Error loading visits');
        res.redirect('/client/dashboard');
    }
});

// Single Visit
router.get('/visits/:id', isAuthenticated, isClient, async (req, res) => {
    try {
        const visit = await Interaction.findOne({
            _id: req.params.id,
            clientId: req.session.user._id
        }).populate('operatorId', 'firstName lastName phone');
        
        if (!visit) {
            req.flash('error', 'Visit not found');
            return res.redirect('/client/visits');
        }
        
        res.render('client/visit-details', {
            title: 'Visit Details',
            user: req.session.user,
            visit,
            moment
        });
    } catch (error) {
        console.error('Error loading visit:', error);
        req.flash('error', 'Error loading visit');
        res.redirect('/client/visits');
    }
});

// Care Team
router.get('/care-team', isAuthenticated, isClient, async (req, res) => {
    try {
        const clientId = req.session.user._id;
        
        const client = await User.findById(clientId)
            .populate('clientInfo.primaryCarer')
            .populate('clientInfo.secondaryCarers');
        
        res.render('client/care-team', {
            title: 'My Care Team',
            user: req.session.user,
            primaryCarer: client.clientInfo?.primaryCarer,
            secondaryCarers: client.clientInfo?.secondaryCarers,
            gp: client.clientInfo?.gpDetails
        });
    } catch (error) {
        console.error('Error loading care team:', error);
        req.flash('error', 'Error loading care team');
        res.redirect('/client/dashboard');
    }
});

// Medications
router.get('/medications', isAuthenticated, isClient, async (req, res) => {
    try {
        const clientId = req.session.user._id;
        
        const client = await User.findById(clientId);
        
        res.render('client/medications', {
            title: 'My Medications',
            user: req.session.user,
            medications: client.clientInfo?.medications || [],
            moment
        });
    } catch (error) {
        console.error('Error loading medications:', error);
        req.flash('error', 'Error loading medications');
        res.redirect('/client/dashboard');
    }
});

// Profile
router.get('/profile', isAuthenticated, isClient, async (req, res) => {
    try {
        const client = await User.findById(req.session.user._id);
        
        res.render('client/profile', {
            title: 'My Profile',
            user: req.session.user,
            client,
            moment
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/client/dashboard');
    }
});

// Emergency Information
router.get('/emergency', isAuthenticated, isClient, async (req, res) => {
    try {
        const client = await User.findById(req.session.user._id);
        
        res.render('client/emergency', {
            title: 'Emergency Information',
            user: req.session.user,
            clientInfo: client.clientInfo,
            moment
        });
    } catch (error) {
        console.error('Error loading emergency info:', error);
        req.flash('error', 'Error loading emergency information');
        res.redirect('/client/dashboard');
    }
});

module.exports = router;