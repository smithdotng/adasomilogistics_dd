const express = require('express');
const router = express.Router();
const { isAuthenticated, isServiceUser } = require('../middleware/auth');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const CarePlan = require('../models/CarePlan');
const moment = require('moment');

// Service User Dashboard
router.get('/dashboard', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUserId = req.session.user._id;
        
        const serviceUser = await User.findById(serviceUserId)
            .populate('serviceUserInfo.primarySupportWorker')
            .populate('serviceUserInfo.secondarySupportWorkers')
            .populate('serviceUserInfo.guardians');
        
        const carePlan = await CarePlan.findOne({ serviceUserId });
        
        // Get upcoming visits
        const upcomingVisits = await Interaction.find({
            serviceUserId,
            scheduledStart: { $gte: new Date() },
            status: 'scheduled'
        })
        .populate('supportWorkerId', 'firstName lastName')
        .sort('scheduledStart')
        .limit(5);
        
        // Get recent visits
        const recentVisits = await Interaction.find({
            serviceUserId,
            status: 'completed'
        })
        .populate('supportWorkerId', 'firstName lastName')
        .sort('-scheduledStart')
        .limit(10);
        
        // Calculate stats
        const totalVisits = await Interaction.countDocuments({ serviceUserId });
        const upcomingCount = await Interaction.countDocuments({
            serviceUserId,
            scheduledStart: { $gte: new Date() }
        });
        
        // Get today's medications (simplified)
        const todaysMeds = serviceUser.serviceUserInfo?.medications?.slice(0, 3) || [];
        
        res.render('serviceUser/dashboard', {
            title: 'My Dashboard',
            user: req.session.user,
            serviceUserInfo: serviceUser.serviceUserInfo,
            carePlan,
            upcomingVisits,
            recentVisits,
            primarySupportWorker: serviceUser.serviceUserInfo?.primarySupportWorker,
            secondarySupportWorkers: serviceUser.serviceUserInfo?.secondarySupportWorkers,
            emergencyContacts: serviceUser.serviceUserInfo?.emergencyContacts,
            todaysMeds,
            stats: {
                totalVisits,
                upcomingVisits: upcomingCount
            },
            moment
        });
    } catch (error) {
        console.error('Error loading service user dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// Care Plan
router.get('/care-plan', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUserId = req.session.user._id;
        
        const serviceUser = await User.findById(serviceUserId);
        const carePlan = await CarePlan.findOne({ serviceUserId });
        
        res.render('serviceUser/care-plan', {
            title: 'My Care Plan',
            user: req.session.user,
            serviceUserInfo: serviceUser.serviceUserInfo,
            carePlan,
            moment
        });
    } catch (error) {
        console.error('Error loading care plan:', error);
        req.flash('error', 'Error loading care plan');
        res.redirect('/service-user/dashboard');
    }
});

// Visits List
router.get('/visits', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUserId = req.session.user._id;
        const { filter, sort } = req.query;
        
        let query = { serviceUserId };
        
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
            .populate('supportWorkerId', 'firstName lastName')
            .sort(sortOption);
        
        res.render('serviceUser/visits', {
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
        res.redirect('/service-user/dashboard');
    }
});

// Single Visit
router.get('/visits/:id', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const visit = await Interaction.findOne({
            _id: req.params.id,
            serviceUserId: req.session.user._id
        }).populate('supportWorkerId', 'firstName lastName phone');
        
        if (!visit) {
            req.flash('error', 'Visit not found');
            return res.redirect('/service-user/visits');
        }
        
        res.render('serviceUser/visit-details', {
            title: 'Visit Details',
            user: req.session.user,
            visit,
            moment
        });
    } catch (error) {
        console.error('Error loading visit:', error);
        req.flash('error', 'Error loading visit');
        res.redirect('/service-user/visits');
    }
});

// Care Team
router.get('/care-team', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUserId = req.session.user._id;
        
        const serviceUser = await User.findById(serviceUserId)
            .populate('serviceUserInfo.primarySupportWorker')
            .populate('serviceUserInfo.secondarySupportWorkers');
        
        res.render('serviceUser/care-team', {
            title: 'My Care Team',
            user: req.session.user,
            primarySupportWorker: serviceUser.serviceUserInfo?.primarySupportWorker,
            secondarySupportWorkers: serviceUser.serviceUserInfo?.secondarySupportWorkers,
            gp: serviceUser.serviceUserInfo?.gpDetails
        });
    } catch (error) {
        console.error('Error loading care team:', error);
        req.flash('error', 'Error loading care team');
        res.redirect('/service-user/dashboard');
    }
});

// Medications
router.get('/medications', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUserId = req.session.user._id;
        
        const serviceUser = await User.findById(serviceUserId);
        
        res.render('serviceUser/medications', {
            title: 'My Medications',
            user: req.session.user,
            medications: serviceUser.serviceUserInfo?.medications || [],
            moment
        });
    } catch (error) {
        console.error('Error loading medications:', error);
        req.flash('error', 'Error loading medications');
        res.redirect('/service-user/dashboard');
    }
});

// Profile
router.get('/profile', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUser = await User.findById(req.session.user._id);
        
        res.render('serviceUser/profile', {
            title: 'My Profile',
            user: req.session.user,
            serviceUser,
            moment
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/service-user/dashboard');
    }
});

// Emergency Information
router.get('/emergency', isAuthenticated, isServiceUser, async (req, res) => {
    try {
        const serviceUser = await User.findById(req.session.user._id);
        
        res.render('serviceUser/emergency', {
            title: 'Emergency Information',
            user: req.session.user,
            serviceUserInfo: serviceUser.serviceUserInfo,
            moment
        });
    } catch (error) {
        console.error('Error loading emergency info:', error);
        req.flash('error', 'Error loading emergency information');
        res.redirect('/service-user/dashboard');
    }
});

module.exports = router;