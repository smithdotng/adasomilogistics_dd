const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../controllers/authController');
const multer = require('multer');
const path = require('path');

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

// Middleware
router.use(isAuthenticated);
router.use(hasRole(['admin', 'operator']));

// GET /interactions - Regular user view
router.get('/', async (req, res) => {
    try {
        const user = req.session.user;
        let query = {};
        
        // Operators can only see their own interactions
        if (user.role === 'operator') {
            query.operator = user.id;
        }
        
        // Get filter parameters
        const { type, startDate, endDate, client, status } = req.query;
        
        if (type && type !== 'all') {
            query.type = type;
        }
        
        if (client && client !== 'all') {
            query.client = client;
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
        
        const interactions = await require('../models/Interaction').find(query)
            .populate('client', 'firstName lastName referenceId')
            .populate('operator', 'firstName lastName')
            .sort({ startTime: -1 });
        
        // Get clients (only assigned clients for operators)
        let clientQuery = {};
        if (user.role === 'operator') {
            clientQuery.assignedOperator = user.id;
        }
        
        const clients = await require('../models/Client').find(clientQuery)
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 });
        
        res.render('interactions/index', {
            title: 'My Interactions',
            interactions,
            clients,
            user,
            type: type || 'all',
            client: client || 'all',
            status: status || 'all',
            startDate: startDate || '',
            endDate: endDate || '',
            moment: require('moment')
        });
        
    } catch (error) {
        console.error('Get interactions error:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/dashboard');
    }
});

// GET /interactions/create - Create interaction form
router.get('/create', async (req, res) => {
    try {
        const user = req.session.user;
        let clientQuery = {};
        
        if (user.role === 'operator') {
            clientQuery.assignedOperator = user.id;
        }
        
        const clients = await require('../models/Client').find(clientQuery)
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 });
        
        res.render('interactions/create', {
            title: 'Create New Interaction',
            clients,
            user
        });
        
    } catch (error) {
        console.error('Create interaction form error:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/interactions');
    }
});



// POST /interactions - Create new interaction
router.post('/', isAuthenticated, hasRole(['operator', 'admin']), upload.array('attachments', 5), async (req, res) => {
    try {
        const user = req.session.user;
        const interactionData = req.body;
        
        // Validate required fields
        if (!interactionData.title || !interactionData.description || !interactionData.client) {
            req.flash('error', 'Title, description, and client are required');
            return res.redirect('/interactions/create');
        }
        
        // Set operator
        interactionData.operator = user.id;
        
        // Validate and set type
        if (!interactionData.type) {
            interactionData.type = 'visit'; // Default
        }
        
        const allowedTypes = ['visit', 'phone_call', 'video_call', 'email', 'assessment', 
                             'medication', 'emergency', 'routine_check', 'family_meeting'];
        if (!allowedTypes.includes(interactionData.type)) {
            req.flash('error', 'Invalid interaction type selected');
            return res.redirect('/interactions/create');
        }
        
        // Validate and set location
        if (interactionData.location) {
            // Map common values to allowed values
            const locationMap = {
                'Clinic': 'office',
                'clinic': 'office',
                'Remote': 'other',
                'remote': 'other',
                'Kubwa': 'other'
            };
            
            if (locationMap[interactionData.location]) {
                interactionData.location = locationMap[interactionData.location];
            }
            
            const allowedLocations = ['client_home', 'office', 'hospital', 'community', 'other'];
            if (!allowedLocations.includes(interactionData.location)) {
                interactionData.location = 'other';
            }
        } else {
            interactionData.location = 'client_home';
        }
        
        // Parse dates
        if (interactionData.startTime) {
            interactionData.startTime = new Date(interactionData.startTime);
        } else {
            interactionData.startTime = new Date();
        }
        
        if (interactionData.endTime) {
            interactionData.endTime = new Date(interactionData.endTime);
        } else {
            // Set default end time (1 hour after start)
            const endTime = new Date(interactionData.startTime);
            endTime.setHours(endTime.getHours() + 1);
            interactionData.endTime = endTime;
        }
        
        // Fix tasks array
        if (interactionData.tasks && typeof interactionData.tasks === 'string') {
            try {
                interactionData.tasks = JSON.parse(interactionData.tasks);
            } catch (e) {
                interactionData.tasks = interactionData.tasks.trim() ? [interactionData.tasks] : [];
            }
        } else if (!interactionData.tasks) {
            interactionData.tasks = [];
        }
        
        // Fix medications array
        if (interactionData.medications && typeof interactionData.medications === 'string') {
            try {
                interactionData.medications = JSON.parse(interactionData.medications);
            } catch (e) {
                interactionData.medications = interactionData.medications.trim() ? [interactionData.medications] : [];
            }
        } else if (!interactionData.medications) {
            interactionData.medications = [];
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
        
        // Create the interaction
        const Interaction = require('../models/Interaction');
        const interaction = new Interaction(interactionData);
        await interaction.save();
        
        req.flash('success', 'Interaction created successfully');
        res.redirect(`/interactions/${interaction._id}`);
        
    } catch (error) {
        console.error('Create interaction error:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            let errorMessages = [];
            for (let field in error.errors) {
                errorMessages.push(error.errors[field].message);
            }
            req.flash('error', errorMessages.join(', '));
        } else {
            req.flash('error', 'Error creating interaction: ' + error.message);
        }
        
        res.redirect('/interactions/create');
    }
});

// GET /interactions/:id - View single interaction
router.get('/:id', async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        
        let query = { _id: interactionId };
        if (user.role === 'operator') {
            query.operator = user.id;
        }
        
        const interaction = await require('../models/Interaction').findOne(query)
            .populate('client', 'firstName lastName referenceId dateOfBirth medicalInfo')
            .populate('operator', 'firstName lastName email phone');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/interactions');
        }
        
        res.render('interactions/show', {
            title: `Interaction: ${interaction.title}`,
            interaction,
            user,
            moment: require('moment')
        });
        
    } catch (error) {
        console.error('Get interaction error:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/interactions');
    }
});

// GET /interactions/:id/edit - Edit interaction form
router.get('/:id/edit', async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        
        let query = { _id: interactionId };
        if (user.role === 'operator') {
            query.operator = user.id;
        }
        
        const interaction = await require('../models/Interaction').findOne(query)
            .populate('client', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/interactions');
        }
        
        let clientQuery = {};
        if (user.role === 'operator') {
            clientQuery.assignedOperator = user.id;
        }
        
        const clients = await require('../models/Client').find(clientQuery)
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 });
        
        res.render('interactions/edit', {
            title: `Edit Interaction: ${interaction.title}`,
            interaction,
            clients,
            user,
            interactionJSON: JSON.stringify(interaction.toObject())
        });
        
    } catch (error) {
        console.error('Edit interaction form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/interactions');
    }
});

// PUT /interactions/:id - Update interaction
router.put('/:id', upload.array('attachments', 5), async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        const updateData = req.body;
        
        let query = { _id: interactionId };
        if (user.role === 'operator') {
            query.operator = user.id;
        }
        
        const Interaction = require('../models/Interaction');
        const interaction = await Interaction.findOne(query);
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/interactions');
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
        
        // Parse dates
        if (updateData.startTime) {
            updateData.startTime = new Date(updateData.startTime);
        }
        
        if (updateData.endTime) {
            updateData.endTime = new Date(updateData.endTime);
        }
        
        await Interaction.findByIdAndUpdate(interactionId, updateData, { new: true });
        
        req.flash('success', 'Interaction updated successfully');
        res.redirect(`/interactions/${interactionId}`);
        
    } catch (error) {
        console.error('Update interaction error:', error);
        req.flash('error', 'Error updating interaction');
        res.redirect(`/interactions/${req.params.id}/edit`);
    }
});

// DELETE /interactions/:id - Delete interaction
router.delete('/:id', async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        
        let query = { _id: interactionId };
        if (user.role === 'operator') {
            query.operator = user.id;
        }
        
        const Interaction = require('../models/Interaction');
        const interaction = await Interaction.findOne(query);
        
        if (!interaction) {
            req.flash('error', 'Interaction not found or unauthorized');
            return res.redirect('/interactions');
        }
        
        if (interaction.status === 'completed') {
            req.flash('error', 'Cannot delete completed interactions');
            return res.redirect(`/interactions/${interactionId}`);
        }
        
        await Interaction.findByIdAndDelete(interactionId);
        
        req.flash('success', 'Interaction deleted successfully');
        res.redirect('/interactions');
        
    } catch (error) {
        console.error('Delete interaction error:', error);
        req.flash('error', 'Error deleting interaction');
        res.redirect(`/interactions/${req.params.id}`);
    }
});

module.exports = router;