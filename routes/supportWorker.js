const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { isAuthenticated, isSupportWorker, canAccessServiceUser } = require('../middleware/auth');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const Timesheet = require('../models/Timesheet');
const moment = require('moment');

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

// Saves any uploaded interaction photos to disk and returns Interaction.attachments entries
async function saveInteractionPhotos(req, interactionId) {
    if (!req.files || !req.files.photos) return [];

    const photos = Array.isArray(req.files.photos) ? req.files.photos : [req.files.photos];
    const uploadDir = path.join(__dirname, '../uploads/interactions');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const attachments = [];
    for (const photo of photos) {
        if (!ALLOWED_PHOTO_TYPES.includes(photo.mimetype)) {
            continue; // silently skip non-image files; form already restricts via accept="image/*"
        }
        const ext = path.extname(photo.name) || '';
        const fileName = `${interactionId}_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
        await photo.mv(path.join(uploadDir, fileName));
        attachments.push({
            filename: fileName,
            originalName: photo.name,
            mimeType: photo.mimetype,
            size: photo.size,
            url: `/uploads/interactions/${fileName}`,
            uploadedBy: req.session.user._id,
            uploadedAt: new Date()
        });
    }
    return attachments;
}

// Support Worker Dashboard
router.get('/dashboard', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        
        // Get today's visits
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayVisits = await Interaction.find({
            supportWorkerId,
            scheduledStart: { $gte: today, $lt: tomorrow }
        })
        .populate('serviceUserId', 'firstName lastName serviceUserInfo.address')
        .sort('scheduledStart');
        
        // Get assigned service users
        const supportWorker = await User.findById(supportWorkerId)
            .populate('supportWorkerInfo.assignedServiceUsers', 'firstName lastName serviceUserInfo.address phone');
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ supportWorkerId })
            .populate('serviceUserId', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);
        
        // Get weekly stats
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        
        const weeklyStats = await Interaction.aggregate([
            { 
                $match: { 
                    supportWorkerId: require('../utils/dbHelpers').toObjectId(supportWorkerId),
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
        
        res.render('supportWorker/dashboard', {
            title: 'Support Worker Dashboard',
            user: req.session.user,
            todayVisits,
            assignedServiceUsers: supportWorker.supportWorkerInfo?.assignedServiceUsers || [],
            recentInteractions,
            weeklyStats,
            moment
        });
    } catch (error) {
        console.error('Error loading support worker dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
});

// My Schedule
router.get('/schedule', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
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
            supportWorkerId,
            scheduledStart: { $gte: startDate, $lte: endDate }
        })
        .populate('serviceUserId', 'firstName lastName serviceUserInfo.address')
        .sort('scheduledStart');
        
        res.render('supportWorker/schedule', {
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
        res.redirect('/support-worker/dashboard');
    }
});

// My Service Users
router.get('/service-users', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        const { search, sort } = req.query;
        
        const supportWorker = await User.findById(supportWorkerId)
            .populate({
                path: 'supportWorkerInfo.assignedServiceUsers',
                match: search ? {
                    $or: [
                        { firstName: { $regex: search, $options: 'i' } },
                        { lastName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } }
                    ]
                } : {},
                populate: {
                    path: 'serviceUserInfo.carePlan'
                }
            });
        
        let serviceUsers = supportWorker.supportWorkerInfo?.assignedServiceUsers || [];
        
        // Sort service users
        if (sort === 'name') {
            serviceUsers.sort((a, b) => a.firstName.localeCompare(b.firstName));
        } else if (sort === 'recent') {
            // This would need last visit date - implement as needed
        }
        
        res.render('supportWorker/service-users', {
            title: 'My Service Users',
            user: req.session.user,
            serviceUsers,
            filters: { search, sort },
            moment
        });
    } catch (error) {
        console.error('Error loading service users:', error);
        req.flash('error', 'Error loading service users');
        res.redirect('/support-worker/dashboard');
    }
});

// View Single Service User
router.get('/service-users/:id', isAuthenticated, isSupportWorker, canAccessServiceUser('id'), async (req, res) => {
    try {
        const serviceUserId = req.params.id;
        
        const serviceUser = await User.findById(serviceUserId)
            .populate('serviceUserInfo.carePlan')
            .populate('serviceUserInfo.gpDetails')
            .populate('serviceUserInfo.emergencyContacts');
        
        const recentInteractions = await Interaction.find({
            serviceUserId,
            supportWorkerId: req.session.user._id
        })
        .sort('-createdAt')
        .limit(10);
        
        res.render('supportWorker/service-user-details', {
            title: 'Service User Details',
            user: req.session.user,
            serviceUser,
            recentInteractions,
            moment
        });
    } catch (error) {
        console.error('Error loading service user:', error);
        req.flash('error', 'Error loading service user');
        res.redirect('/support-worker/service-users');
    }
});

// =============== INTERACTION ROUTES ===============

// List all interactions (with filters)
router.get('/interactions', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        const { status, period, serviceUser } = req.query;
        
        let query = { supportWorkerId };
        
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
        
        // Filter by service user
        if (serviceUser) {
            query.serviceUserId = serviceUser;
        }
        
        const interactions = await Interaction.find(query)
            .populate('serviceUserId', 'firstName lastName')
            .sort('-scheduledStart');
        
        // Get unique service users for filter dropdown
        const serviceUsers = await User.find({
            'supportWorkerInfo.assignedServiceUsers': supportWorkerId
        }).select('firstName lastName');
        
        res.render('supportWorker/interactions', {
            title: 'My Visits',
            user: req.session.user,
            interactions,
            serviceUsers,
            filters: { status, period, serviceUser },
            moment
        });
    } catch (error) {
        console.error('Error loading interactions:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/support-worker/dashboard');
    }
});

// Form to create new interaction
router.get('/interactions/create/:serviceUserId', isAuthenticated, isSupportWorker, canAccessServiceUser('serviceUserId'), async (req, res) => {
    try {
        const serviceUserId = req.params.serviceUserId;
        
        const serviceUser = await User.findById(serviceUserId)
            .select('firstName lastName serviceUserInfo');
        
        res.render('supportWorker/interactions/create', {
            title: 'Log New Visit',
            user: req.session.user,
            serviceUser,
            moment
        });
    } catch (error) {
        console.error('Error loading create form:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/support-worker/service-users');
    }
});

// Create new interaction
router.post('/interactions', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const {
            serviceUserId,
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
            serviceUserId,
            supportWorkerId: req.session.user._id,
            careProviderId: req.session.user.careProviderId,
            type,
            title: title || `${type.replace('_', ' ')} with ${serviceUserId}`,
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

        interaction.attachments = await saveInteractionPhotos(req, interaction._id);

        await interaction.save();

        req.flash('success', 'Visit logged successfully');
        res.redirect(`/support-worker/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error creating interaction:', error);
        req.flash('error', 'Error logging visit');
        res.redirect('/support-worker/dashboard');
    }
});

// View single interaction
router.get('/interactions/:id', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            supportWorkerId: req.session.user._id
        })
        .populate('serviceUserId', 'firstName lastName serviceUserInfo.address phone')
        .populate('supportWorkerId', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/support-worker/interactions');
        }
        
        res.render('supportWorker/interactions/show', {
            title: 'Visit Details',
            user: req.session.user,
            interaction,
            moment
        });
    } catch (error) {
        console.error('Error loading interaction:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/support-worker/interactions');
    }
});

// Edit interaction form
router.get('/interactions/:id/edit', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const interaction = await Interaction.findOne({
            _id: req.params.id,
            supportWorkerId: req.session.user._id
        }).populate('serviceUserId', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/support-worker/interactions');
        }
        
        res.render('supportWorker/interactions/edit', {
            title: 'Edit Visit',
            user: req.session.user,
            interaction,
            moment
        });
    } catch (error) {
        console.error('Error loading interaction:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/support-worker/interactions');
    }
});

// Update interaction
router.put('/interactions/:id', isAuthenticated, isSupportWorker, async (req, res) => {
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
            { _id: req.params.id, supportWorkerId: req.session.user._id },
            updateData,
            { new: true }
        );
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/support-worker/interactions');
        }
        
        req.flash('success', 'Visit updated successfully');
        res.redirect(`/support-worker/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error updating interaction:', error);
        req.flash('error', 'Error updating visit');
        res.redirect(`/support-worker/interactions/${req.params.id}/edit`);
    }
});

// Start a visit (change status to in-progress)
router.post('/interactions/:id/start', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const interaction = await Interaction.findOneAndUpdate(
            { _id: req.params.id, supportWorkerId: req.session.user._id, status: 'scheduled' },
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
            return res.redirect('/support-worker/schedule');
        }
        
        req.flash('success', 'Visit started');
        res.redirect(`/support-worker/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error starting visit:', error);
        req.flash('error', 'Error starting visit');
        res.redirect('/support-worker/schedule');
    }
});

// Complete a visit
router.post('/interactions/:id/complete', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const {
            observations,
            medications,
            activities,
            notes
        } = req.body;
        
        const interaction = await Interaction.findOneAndUpdate(
            { _id: req.params.id, supportWorkerId: req.session.user._id, status: 'in-progress' },
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
            return res.redirect('/support-worker/schedule');
        }
        
        req.flash('success', 'Visit completed successfully');
        res.redirect(`/support-worker/interactions/${interaction._id}`);
    } catch (error) {
        console.error('Error completing visit:', error);
        req.flash('error', 'Error completing visit');
        res.redirect('/support-worker/schedule');
    }
});

// =============== TIMESHEET ROUTES ===============

// My Timesheets
router.get('/timesheets', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        
        const timesheets = await Timesheet.find({ supportWorkerId })
            .sort('-periodEnd');
        
        res.render('supportWorker/timesheets', {
            title: 'My Timesheets',
            user: req.session.user,
            timesheets,
            moment
        });
    } catch (error) {
        console.error('Error loading timesheets:', error);
        req.flash('error', 'Error loading timesheets');
        res.redirect('/support-worker/dashboard');
    }
});

// View Single Timesheet
router.get('/timesheets/:id', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        const timesheet = await Timesheet.findOne({
            _id: req.params.id,
            supportWorkerId
        }).populate('entries.serviceUserId', 'firstName lastName');
        
        if (!timesheet) {
            req.flash('error', 'Timesheet not found');
            return res.redirect('/support-worker/timesheets');
        }
        
        res.render('supportWorker/timesheet-details', {
            title: 'Timesheet Details',
            user: req.session.user,
            timesheet,
            moment
        });
    } catch (error) {
        console.error('Error loading timesheet:', error);
        req.flash('error', 'Error loading timesheet');
        res.redirect('/support-worker/timesheets');
    }
});

// =============== PROFILE ROUTES ===============

// Profile
router.get('/profile', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const supportWorker = await User.findById(req.session.user._id);
        
        res.render('supportWorker/profile', {
            title: 'My Profile',
            user: req.session.user,
            supportWorker,
            moment
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        req.flash('error', 'Error loading profile');
        res.redirect('/support-worker/dashboard');
    }
});

// Update Profile
router.post('/profile', isAuthenticated, isSupportWorker, async (req, res) => {
    try {
        const { phone, address, emergencyContact } = req.body;
        
        await User.findByIdAndUpdate(req.session.user._id, {
            phone,
            address,
            'supportWorkerInfo.emergencyContact': emergencyContact
        });
        
        req.flash('success', 'Profile updated successfully');
        res.redirect('/support-worker/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', 'Error updating profile');
        res.redirect('/support-worker/profile');
    }
});

module.exports = router;