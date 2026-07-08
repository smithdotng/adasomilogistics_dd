const Interaction = require('../models/Interaction');
const ServiceUser = require('../models/ServiceUser');
const User = require('../models/User');
const moment = require('moment');

exports.getInteractions = async (req, res) => {
    try {
        const user = req.session.user;
        let query = {};
        
        if (user.role === 'support_worker') {
            query.supportWorker = user.id;
        }
        
        const { type, startDate, endDate, serviceUser } = req.query;
        
        if (type && type !== 'all') {
            query.type = type;
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
            .sort({ startTime: -1 });
        
        const serviceUsers = await ServiceUser.find(
            user.role === 'support_worker' ? { assignedSupportWorker: user.id } : {}
        ).select('firstName lastName');
        
        res.render('interactions/index', {
            title: 'Interactions',
            interactions,
            serviceUsers,
            moment
        });
        
    } catch (error) {
        console.error('Get interactions error:', error);
        req.flash('error', 'Error loading interactions');
        res.redirect('/dashboard');
    }
};

exports.getCreateInteraction = async (req, res) => {
    try {
        const user = req.session.user;
        let serviceUserQuery = {};
        
        if (user.role === 'support_worker') {
            serviceUserQuery.assignedSupportWorker = user.id;
        }
        
        const serviceUsers = await ServiceUser.find(serviceUserQuery)
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 });
        
        res.render('interactions/create', {
            title: 'Create New Interaction',
            serviceUsers
        });
        
    } catch (error) {
        console.error('Create interaction form error:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/interactions');
    }
};

exports.createInteraction = async (req, res) => {
    try {
        const user = req.session.user;
        const interactionData = req.body;
        
        // Set support worker to current user if not admin
        if (user.role === 'support_worker') {
            interactionData.supportWorker = user.id;
        }
        
        // Parse dates
        if (interactionData.startTime) {
            interactionData.startTime = new Date(interactionData.startTime);
        }
        
        if (interactionData.endTime) {
            interactionData.endTime = new Date(interactionData.endTime);
        }
        
        // Parse tasks array
        if (interactionData.tasks && typeof interactionData.tasks === 'string') {
            try {
                interactionData.tasks = JSON.parse(interactionData.tasks);
            } catch (e) {
                interactionData.tasks = [];
            }
        }
        
        // Parse medications array
        if (interactionData.medications && typeof interactionData.medications === 'string') {
            try {
                interactionData.medications = JSON.parse(interactionData.medications);
            } catch (e) {
                interactionData.medications = [];
            }
        }
        
        const interaction = new Interaction(interactionData);
        await interaction.save();
        
        req.flash('success', 'Interaction logged successfully');
        res.redirect(`/interactions/${interaction._id}`);
        
    } catch (error) {
        console.error('Create interaction error:', error);
        req.flash('error', 'Error creating interaction: ' + error.message);
        res.redirect('/interactions/create');
    }
};

exports.getInteractionDetail = async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        
        let query = { _id: interactionId };
        if (user.role === 'support_worker') {
            query.supportWorker = user.id;
        }
        
        const interaction = await Interaction.findOne(query)
            .populate('service_user', 'firstName lastName referenceId dateOfBirth medicalInfo')
            .populate('support_worker', 'firstName lastName email phone');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/interactions');
        }
        
        res.render('interactions/show', {
            title: `Interaction: ${interaction.title}`,
            interaction,
            moment
        });
        
    } catch (error) {
        console.error('Get interaction error:', error);
        req.flash('error', 'Error loading interaction');
        res.redirect('/interactions');
    }
};

exports.getEditInteraction = async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        
        let query = { _id: interactionId };
        if (user.role === 'support_worker') {
            query.supportWorker = user.id;
        }
        
        const interaction = await Interaction.findOne(query)
            .populate('service_user', 'firstName lastName');
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/interactions');
        }
        
        let serviceUserQuery = {};
        if (user.role === 'support_worker') {
            serviceUserQuery.assignedSupportWorker = user.id;
        }
        
        const serviceUsers = await ServiceUser.find(serviceUserQuery)
            .select('firstName lastName referenceId')
            .sort({ lastName: 1 });
        
        res.render('interactions/edit', {
            title: `Edit Interaction: ${interaction.title}`,
            interaction,
            serviceUsers,
            moment
        });
        
    } catch (error) {
        console.error('Edit interaction form error:', error);
        req.flash('error', 'Error loading edit form');
        res.redirect('/interactions');
    }
};

exports.updateInteraction = async (req, res) => {
    try {
        const interactionId = req.params.id;
        const user = req.session.user;
        const updateData = req.body;
        
        let query = { _id: interactionId };
        if (user.role === 'support_worker') {
            query.supportWorker = user.id;
        }
        
        const interaction = await Interaction.findOne(query);
        
        if (!interaction) {
            req.flash('error', 'Interaction not found');
            return res.redirect('/interactions');
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
};