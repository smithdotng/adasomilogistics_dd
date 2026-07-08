const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../controllers/authController');
const multer = require('multer');
const path = require('path');
const moment = require('moment');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image, PDF, and Word documents are allowed'));
        }
    }
});

// Middleware - only guardians can access these routes
router.use(isAuthenticated);
router.use(hasRole(['guardian']));

// Middleware to verify guardian has access to the service user
const verifyGuardianAccess = async (req, res, next) => {
    try {
        const user = req.session.user;
        
        if (!user.assignedClient) {
            req.flash('error', 'No service user assigned to your account');
            return res.redirect('/guardian/dashboard');
        }
        
        const ServiceUser = require('../models/ServiceUser');
        const serviceUser = await ServiceUser.findById(user.assignedClient);
        
        if (!serviceUser) {
            req.flash('error', 'Assigned service user not found');
            return res.redirect('/guardian/dashboard');
        }
        
        req.serviceUser = serviceUser; // Attach service user to request
        next();
    } catch (error) {
        console.error('Guardian access verification error:', error);
        req.flash('error', 'Error verifying access');
        res.redirect('/guardian/dashboard');
    }
};

// GET /guardian/interactions - Guardian view of service user's interactions
router.get('/interactions', verifyGuardianAccess, async (req, res) => {
    try {
        const user = req.session.user;
        const serviceUser = req.serviceUser;
        
        // Get filter parameters
        const { type, status, startDate, endDate } = req.query;
        
        let query = { serviceUser: serviceUser._id };
        
        // Apply filters
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (startDate && endDate) {
            query.startTime = {
                $gte: new Date(startDate),
                $lte: new Date(endDate + 'T23:59:59.999Z')
            };
        } else if (startDate) {
            query.startTime = { $gte: new Date(startDate) };
        } else if (endDate) {
            query.startTime = { $lte: new Date(endDate + 'T23:59:59.999Z') };
        }
        
        // Fetch interactions for this service user
        const interactions = await require('../models/Interaction').find(query)
            .populate('service_user', 'firstName lastName referenceId')
            .populate('support_worker', 'firstName lastName')
            .sort({ startTime: -1 });
        
        // Calculate statistics
        let completedInteractions = 0;
        let emergencyInteractions = 0;
        let todayInteractions = 0;
        let thisWeekInteractions = 0;
        
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        interactions.forEach(interaction => {
            const interactionDate = new Date(interaction.startTime);
            
            if (interaction.status === 'completed') {
                completedInteractions++;
            }
            
            if (interaction.type === 'emergency') {
                emergencyInteractions++;
            }
            
            if (interactionDate.toDateString() === today.toDateString()) {
                todayInteractions++;
            }
            
            if (interactionDate >= weekStart) {
                thisWeekInteractions++;
            }
        });
        
        res.render('guardian/interactions/index', {
            title: 'Service User Interactions',
            interactions,
            serviceUser,
            user,
            type: type || 'all',
            status: status || 'all',
            startDate: startDate || '',
            endDate: endDate || '',
            completedInteractions,
            emergencyInteractions,
            todayInteractions,
            thisWeekInteractions,
            moment
        });
        
    } catch (error) {
        console.error('Guardian interactions error:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/guardian/dashboard');
    }
});

// GET /guardian/interactions/create - Guardian create interaction form
router.get('/interactions/create', verifyGuardianAccess, async (req, res) => {
    try {
        const user = req.session.user;
        const serviceUser = req.serviceUser;
        
        // Get assigned support worker for this service user
        const supportWorker = serviceUser.assignedSupportWorker;
        let operatorDetails = null;
        
        if (supportWorker) {
            const User = require('../models/User');
            operatorDetails = await User.findById(supportWorker).select('firstName lastName');
        }
        
        res.render('guardian/interactions/create', {
            title: 'Log Interaction',
            serviceUser,
            supportWorker: operatorDetails,
            user,
            moment
        });
        
    } catch (error) {
        console.error('Guardian create interaction form error:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/guardian/interactions');
    }
});

// POST /guardian/interactions - Guardian create interaction
router.post('/interactions', verifyGuardianAccess, upload.array('attachments', 5), async (req, res) => {
    try {
        const user = req.session.user;
        const serviceUser = req.serviceUser;
        const interactionData = req.body;
        
        // Validate data
        if (!interactionData.title || !interactionData.description) {
            req.flash('error', 'Title and description are required');
            return res.redirect('/guardian/interactions/create');
        }
        
        // Set required fields
        interactionData.serviceUser = serviceUser._id;
        interactionData.supportWorker = user.id; // Guardian is logging the interaction
        
        // Set type to a guardian-friendly type
        if (!interactionData.type) {
            interactionData.type = 'family_meeting'; // Default type for guardian interactions
        }
        
        // Parse dates - FIXED: Ensure endTime is always set
        if (interactionData.startTime) {
            interactionData.startTime = new Date(interactionData.startTime);
        } else {
            interactionData.startTime = new Date();
        }
        
        if (interactionData.endTime) {
            interactionData.endTime = new Date(interactionData.endTime);
        } else {
            // If no end time provided, set it to 1 hour after start time
            const startTime = new Date(interactionData.startTime);
            interactionData.endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // +1 hour
        }
        
        // Set default location if not provided
        if (!interactionData.location) {
            interactionData.location = 'client_home';
        }
        
        // Set default status
        if (!interactionData.status) {
            interactionData.status = 'completed';
        }
        
        // Handle file uploads
        if (req.files && req.files.length > 0) {
            interactionData.attachments = req.files.map(file => ({
                name: file.originalname,
                fileType: path.extname(file.originalname).substring(1),
                url: `/uploads/${file.filename}`,
                uploadedAt: new Date()
            }));
        }
        
        // Add verification notes for guardian interactions
        interactionData.verificationNotes = `Interaction logged by guardian: ${user.firstName} ${user.lastName}`;
        interactionData.verifiedByGuardian = true;
        
        // Create the interaction
        const Interaction = require('../models/Interaction');
        const interaction = new Interaction(interactionData);
        await interaction.save();
        
        req.flash('success', 'Interaction logged successfully');
        res.redirect(`/guardian/interactions/${interaction._id}`);
        
    } catch (error) {
        console.error('Guardian create interaction error:', error);
        req.flash('error', 'Error creating interaction: ' + error.message);
        res.redirect('/guardian/interactions/create');
    }
});

// GET /guardian/interactions/:id - Guardian view single interaction
router.get('/interactions/:id', verifyGuardianAccess, async (req, res) => {
    try {
        const interactionId = req.params.id;
        const serviceUser = req.serviceUser;
        
        // Find interaction and verify it belongs to this guardian's service user
        const interaction = await require('../models/Interaction').findOne({
            _id: interactionId,
            serviceUser: serviceUser._id
        })
        .populate('service_user', 'firstName lastName referenceId dateOfBirth medicalInfo')
        .populate('support_worker', 'firstName lastName email phone');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/guardian/interactions');
        }
        
        res.render('guardian/interactions/show', {
            title: `Interaction: ${interaction.title}`,
            interaction,
            serviceUser,
            user: req.session.user,
            moment
        });
        
    } catch (error) {
        console.error('Guardian view interaction error:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/guardian/interactions');
    }
});

// GET /guardian/interactions/:id/edit - Guardian edit interaction form
router.get('/interactions/:id/edit', verifyGuardianAccess, async (req, res) => {
    try {
        const interactionId = req.params.id;
        const serviceUser = req.serviceUser;
        
        // Find interaction and verify it belongs to this guardian's service user
        const interaction = await require('../models/Interaction').findOne({
            _id: interactionId,
            serviceUser: serviceUser._id,
            supportWorker: req.session.user.id // Guardian can only edit their own interactions
        });
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized to edit');
            return res.redirect('/guardian/interactions');
        }
        
        // Guardians can only edit interactions that are in draft status
        if (interaction.status !== 'draft') {
            req.flash('error', 'Only draft interactions can be edited');
            return res.redirect(`/guardian/interactions/${interactionId}`);
        }
        
        res.render('guardian/interactions/edit', {
            title: `Edit Interaction: ${interaction.title}`,
            interaction,
            serviceUser,
            user: req.session.user,
            moment,
            interactionJSON: JSON.stringify(interaction.toObject())
        });
        
    } catch (error) {
        console.error('Guardian edit interaction form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/guardian/interactions');
    }
});

// PUT /guardian/interactions/:id - Guardian update interaction
router.put('/interactions/:id', verifyGuardianAccess, upload.array('attachments', 5), async (req, res) => {
    try {
        const interactionId = req.params.id;
        const serviceUser = req.serviceUser;
        const user = req.session.user;
        const updateData = req.body;
        
        // Verify interaction exists and belongs to guardian's service user
        const Interaction = require('../models/Interaction');
        const interaction = await Interaction.findOne({
            _id: interactionId,
            serviceUser: serviceUser._id,
            supportWorker: user.id // Guardian can only update their own interactions
        });
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/guardian/interactions');
        }
        
        // Guardians can only update interactions that are in draft status
        if (interaction.status !== 'draft') {
            req.flash('error', 'Only draft interactions can be updated');
            return res.redirect(`/guardian/interactions/${interactionId}`);
        }
        
        // Handle file uploads
        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(file => ({
                name: file.originalname,
                fileType: path.extname(file.originalname).substring(1),
                url: `/uploads/${file.filename}`,
                uploadedAt: new Date()
            }));
            
            updateData.attachments = [...(interaction.attachments || []), ...newAttachments];
        }
        
        // Parse dates - FIXED: Ensure endTime is always set
        if (updateData.startTime) {
            updateData.startTime = new Date(updateData.startTime);
        }
        
        if (updateData.endTime) {
            updateData.endTime = new Date(updateData.endTime);
        } else if (updateData.startTime) {
            // If no end time provided but start time is updated, set end time to 1 hour after start
            const startTime = new Date(updateData.startTime);
            updateData.endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
        }
        // If neither startTime nor endTime are provided, leave the existing ones
        
        await Interaction.findByIdAndUpdate(interactionId, updateData, { new: true });
        
        req.flash('success', 'Interaction updated successfully');
        res.redirect(`/guardian/interactions/${interactionId}`);
        
    } catch (error) {
        console.error('Guardian update interaction error:', error);
        req.flash('error', 'Error updating interaction');
        res.redirect(`/guardian/interactions/${req.params.id}/edit`);
    }
});

// DELETE /guardian/interactions/:id - Guardian delete interaction
router.delete('/interactions/:id', verifyGuardianAccess, async (req, res) => {
    try {
        const interactionId = req.params.id;
        const serviceUser = req.serviceUser;
        const user = req.session.user;
        
        // Verify interaction exists and belongs to guardian's service user
        const Interaction = require('../models/Interaction');
        const interaction = await Interaction.findOne({
            _id: interactionId,
            serviceUser: serviceUser._id,
            supportWorker: user.id // Guardian can only delete their own interactions
        });
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/guardian/interactions');
        }
        
        // Guardians can only delete interactions that are in draft status
        if (interaction.status !== 'draft') {
            req.flash('error', 'Only draft interactions can be deleted');
            return res.redirect(`/guardian/interactions/${interactionId}`);
        }
        
        await Interaction.findByIdAndDelete(interactionId);
        
        req.flash('success', 'Interaction deleted successfully');
        res.redirect('/guardian/interactions');
        
    } catch (error) {
        console.error('Guardian delete interaction error:', error);
        req.flash('error', 'Error deleting interaction');
        res.redirect(`/guardian/interactions/${req.params.id}`);
    }
});

// GET /guardian/interactions/calendar - Guardian view of interactions calendar
router.get('/interactions/calendar', verifyGuardianAccess, async (req, res) => {
    try {
        const serviceUser = req.serviceUser;
        
        // Get interactions for the calendar view (last 30 days and next 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const thirtyDaysAhead = new Date();
        thirtyDaysAhead.setDate(today.getDate() + 30);
        
        const interactions = await require('../models/Interaction').find({
            serviceUser: serviceUser._id,
            startTime: {
                $gte: thirtyDaysAgo,
                $lte: thirtyDaysAhead
            }
        })
        .select('title type startTime endTime status location')
        .sort({ startTime: 1 });
        
        // Format for fullCalendar
        const calendarEvents = interactions.map(interaction => ({
            id: interaction._id,
            title: interaction.title,
            start: interaction.startTime,
            end: interaction.endTime,
            type: interaction.type,
            status: interaction.status,
            location: interaction.location,
            className: `event-type-${interaction.type} event-status-${interaction.status}`
        }));
        
        res.render('guardian/interactions/calendar', {
            title: 'Interaction Calendar',
            serviceUser,
            user: req.session.user,
            calendarEvents: JSON.stringify(calendarEvents),
            moment
        });
        
    } catch (error) {
        console.error('Guardian calendar error:', error);
        req.flash('error', 'Error loading calendar');
        res.redirect('/guardian/interactions');
    }
});

// GET /guardian/interactions/export - Export interactions as CSV
router.get('/interactions/export', verifyGuardianAccess, async (req, res) => {
    try {
        const serviceUser = req.serviceUser;
        
        const interactions = await require('../models/Interaction').find({
            serviceUser: serviceUser._id
        })
        .populate('support_worker', 'firstName lastName')
        .sort({ startTime: -1 });
        
        // Convert to CSV
        const csvData = [];
        
        // Header row
        csvData.push([
            'Date',
            'Time',
            'Title',
            'Type',
            'Support Worker',
            'Status',
            'Duration',
            'Location'
        ]);
        
        // Data rows
        interactions.forEach(interaction => {
            const startDate = new Date(interaction.startTime);
            const dateStr = startDate.toISOString().split('T')[0];
            const timeStr = startDate.toTimeString().split(' ')[0].substring(0, 5);
            
            let duration = 'N/A';
            if (interaction.endTime) {
                const endDate = new Date(interaction.endTime);
                const durationMs = endDate - startDate;
                const hours = Math.floor(durationMs / (1000 * 60 * 60));
                const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                duration = `${hours}h ${minutes}m`;
            }
            
            csvData.push([
                dateStr,
                timeStr,
                interaction.title,
                interaction.type.replace('_', ' '),
                interaction.supportWorker ? `${interaction.supportWorker.firstName} ${interaction.supportWorker.lastName}` : 'N/A',
                interaction.status,
                duration,
                interaction.location || 'N/A'
            ]);
        });
        
        // Convert to CSV string
        const csvString = csvData.map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=interactions-${serviceUser.firstName}-${serviceUser.lastName}-${Date.now()}.csv`);
        
        res.send(csvString);
        
    } catch (error) {
        console.error('Guardian export error:', error);
        req.flash('error', 'Error exporting interactions');
        res.redirect('/guardian/interactions');
    }
});

module.exports = router;