const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../controllers/authController');
const Interaction = require('../models/Interaction');
const Client = require('../models/Client');
const User = require('../models/User');
const moment = require('moment');

// Admin middleware - ensure user is admin
const adminMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        req.flash('error', 'Unauthorized access');
        return res.redirect('/login');
    }
    next();
};

// GET /admin/interactions - Admin view of all interactions
router.get('/admin/interactions', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const user = req.session.user;
        
        // Get filter parameters
        const { type, operator, client: filterClient, status, startDate, endDate } = req.query;
        
        let query = {};
        
        // Apply filters
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (filterClient && filterClient !== 'all') {
            query.client = filterClient;
        }
        
        if (operator && operator !== 'all') {
            query.operator = operator;
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
        
        // Fetch interactions with populated data
        const interactions = await Interaction.find(query)
            .populate('client', 'firstName lastName referenceId')
            .populate('operator', 'firstName lastName email')
            .sort({ startTime: -1 })
            .lean();
        
        // Get all clients for filter dropdown
        const clients = await Client.find({})
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 })
            .lean();
        
        // Get all operators for filter dropdown
        const operators = await User.find({ 
            role: { $in: ['operator', 'admin'] } 
        })
            .select('firstName lastName email')
            .sort({ lastName: 1 })
            .lean();
        
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
        
        // Render admin interactions template
        res.render('admin/interactions', {
            title: 'All Interactions || Care System Admin',
            interactions,
            clients,
            operators,
            user,
            type: type || 'all',
            operator: operator || 'all',
            filterClient: filterClient || 'all',
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
        console.error('Admin interactions error:', error);
        req.flash('error', 'Error loading interactions: ' + error.message);
        res.redirect('/admin/dashboard');
    }
});

// GET /admin/interactions/:id - Admin view of single interaction
router.get('/admin/interactions/:id', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const interactionId = req.params.id;
        
        const interaction = await Interaction.findById(interactionId)
            .populate('client', 'firstName lastName referenceId dateOfBirth medicalInfo address phone emergencyContact')
            .populate('operator', 'firstName lastName email phone role')
            .lean();
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/admin/interactions');
        }
        
        res.render('admin/interaction-details', {
            title: `Interaction Details: ${interaction.title}`,
            interaction,
            user: req.session.user,
            moment
        });
        
    } catch (error) {
        console.error('Admin view interaction error:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/admin/interactions');
    }
});

// GET /admin/interactions/:id/edit - Admin edit interaction form
router.get('/admin/interactions/:id/edit', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const interactionId = req.params.id;
        
        const interaction = await Interaction.findById(interactionId)
            .populate('client', 'firstName lastName referenceId')
            .lean();
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/admin/interactions');
        }
        
        // Get all clients
        const clients = await Client.find({})
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 })
            .lean();
        
        // Get all operators
        const operators = await User.find({ 
            role: { $in: ['operator', 'admin'] } 
        })
            .select('firstName lastName email')
            .sort({ lastName: 1 })
            .lean();
        
        res.render('admin/edit-interaction', {
            title: `Edit Interaction: ${interaction.title}`,
            interaction,
            clients,
            operators,
            user: req.session.user,
            interactionJSON: JSON.stringify(interaction)
        });
        
    } catch (error) {
        console.error('Admin edit interaction form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/admin/interactions');
    }
});

// PUT /admin/interactions/:id - Admin update interaction
router.put('/admin/interactions/:id', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const interactionId = req.params.id;
        const updateData = req.body;
        
        // Parse dates
        if (updateData.startTime) {
            updateData.startTime = new Date(updateData.startTime);
        }
        
        if (updateData.endTime) {
            updateData.endTime = new Date(updateData.endTime);
        }
        
        // Parse arrays if they come as strings
        if (updateData.tasks && typeof updateData.tasks === 'string') {
            try {
                updateData.tasks = JSON.parse(updateData.tasks);
            } catch (e) {
                updateData.tasks = [];
            }
        }
        
        if (updateData.medications && typeof updateData.medications === 'string') {
            try {
                updateData.medications = JSON.parse(updateData.medications);
            } catch (e) {
                updateData.medications = [];
            }
        }
        
        const interaction = await Interaction.findByIdAndUpdate(
            interactionId, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/admin/interactions');
        }
        
        req.flash('success', 'Interaction updated successfully');
        res.redirect(`/admin/interactions/${interactionId}`);
        
    } catch (error) {
        console.error('Admin update interaction error:', error);
        req.flash('error', 'Error updating interaction: ' + error.message);
        res.redirect(`/admin/interactions/${req.params.id}/edit`);
    }
});

// DELETE /admin/interactions/:id - Admin delete interaction
router.delete('/admin/interactions/:id', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const interactionId = req.params.id;
        
        const interaction = await Interaction.findById(interactionId);
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/admin/interactions');
        }
        
        await Interaction.findByIdAndDelete(interactionId);
        
        req.flash('success', 'Interaction deleted successfully');
        res.redirect('/admin/interactions');
        
    } catch (error) {
        console.error('Admin delete interaction error:', error);
        req.flash('error', 'Error deleting interaction: ' + error.message);
        res.redirect(`/admin/interactions/${req.params.id}`);
    }
});

// Add these routes to your adminInteractions.js file

// GET /admin/interactions/create - Admin create interaction form
router.get('/admin/interactions/create', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const user = req.session.user;
        
        // Get all clients for dropdown
        const clients = await Client.find({})
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 })
            .lean();
        
        // Get all operators for dropdown
        const operators = await User.find({ 
            role: { $in: ['operator', 'admin'] } 
        })
            .select('firstName lastName email')
            .sort({ lastName: 1 })
            .lean();
        
        res.render('admin/create-interaction', {
            title: 'Create New Interaction',
            clients,
            operators,
            user,
            moment
        });
        
    } catch (error) {
        console.error('Admin create interaction form error:', error);
        req.flash('error', 'Error loading create form');
        res.redirect('/admin/interactions');
    }
});

// POST /admin/interactions - Admin create new interaction
router.post('/admin/interactions', isAuthenticated, adminMiddleware, async (req, res) => {
    try {
        const user = req.session.user;
        const interactionData = req.body;
        
        // Validate required fields
        if (!interactionData.title || !interactionData.description || 
            !interactionData.client || !interactionData.operator || 
            !interactionData.type || !interactionData.startTime) {
            req.flash('error', 'Title, description, client, operator, type, and start time are required');
            return res.redirect('/admin/interactions/create');
        }
        
        // Validate type is in allowed enum values
        const allowedTypes = ['visit', 'phone_call', 'video_call', 'email', 'assessment', 
                             'medication', 'emergency', 'routine_check', 'family_meeting'];
        if (!allowedTypes.includes(interactionData.type)) {
            req.flash('error', 'Invalid interaction type');
            return res.redirect('/admin/interactions/create');
        }
        
        // Validate location is in allowed enum values or set default
        const allowedLocations = ['client_home', 'office', 'hospital', 'community', 'other'];
        if (interactionData.location && !allowedLocations.includes(interactionData.location)) {
            // If invalid location, set to 'other'
            interactionData.location = 'other';
        } else if (!interactionData.location) {
            interactionData.location = 'client_home';
        }
        
        // Parse dates
        interactionData.startTime = new Date(interactionData.startTime);
        
        if (interactionData.endTime) {
            interactionData.endTime = new Date(interactionData.endTime);
        } else {
            // Set default end time (1 hour after start)
            const endTime = new Date(interactionData.startTime);
            endTime.setHours(endTime.getHours() + 1);
            interactionData.endTime = endTime;
        }
        
        // Parse arrays if they exist and are strings
        if (interactionData.tasks && typeof interactionData.tasks === 'string') {
            try {
                interactionData.tasks = JSON.parse(interactionData.tasks);
            } catch (e) {
                interactionData.tasks = [];
            }
        } else if (!interactionData.tasks) {
            interactionData.tasks = [];
        }
        
        if (interactionData.medications && typeof interactionData.medications === 'string') {
            try {
                interactionData.medications = JSON.parse(interactionData.medications);
            } catch (e) {
                interactionData.medications = [];
            }
        } else if (!interactionData.medications) {
            interactionData.medications = [];
        }
        
        // Set default status if not provided
        if (!interactionData.status) {
            interactionData.status = 'completed';
        }
        
        // Create the interaction
        const interaction = new Interaction(interactionData);
        await interaction.save();
        
        req.flash('success', 'Interaction created successfully');
        res.redirect(`/admin/interactions/${interaction._id}`);
        
    } catch (error) {
        console.error('Admin create interaction error:', error);
        
        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            let errorMessages = [];
            for (let field in error.errors) {
                errorMessages.push(error.errors[field].message);
            }
            req.flash('error', errorMessages.join(', '));
        } else {
            req.flash('error', 'Error creating interaction: ' + error.message);
        }
        
        res.redirect('/admin/interactions/create');
    }
});

module.exports = router;