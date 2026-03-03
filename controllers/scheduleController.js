const Schedule = require('../models/Schedule');
const User = require('../models/User');
const Interaction = require('../models/Interaction');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');

// Get schedule view
exports.getSchedule = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const { view, date, operator } = req.query;
        const selectedDate = date ? new Date(date) : new Date();
        
        let query = { providerId, isActive: true };
        if (operator && operator !== 'all') {
            query.operatorId = operator;
        }
        
        const schedules = await Schedule.find(query)
            .populate('clientId', 'firstName lastName clientInfo.address')
            .populate('operatorId', 'firstName lastName')
            .sort('startTime');
        
        // Get operators for filter
        const operators = await User.find({
            role: 'operator',
            providerId,
            isActive: true
        }).select('firstName lastName');
        
        res.render('provider/schedule/index', {
            title: 'Schedule',
            user: req.session.user,
            schedules,
            operators,
            selectedDate,
            view: view || 'week',
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading schedule:', error);
        req.flash('error', 'Error loading schedule');
        res.redirect('/provider/dashboard');
    }
};

// Create Schedule Form
exports.getCreateSchedule = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        // Get active clients and operators
        const [clients, operators] = await Promise.all([
            User.find({ role: 'client', providerId, isActive: true })
                .select('firstName lastName clientInfo'),
            User.find({ role: 'operator', providerId, isActive: true })
                .select('firstName lastName operatorInfo')
        ]);
        
        res.render('provider/schedule/create', {
            title: 'Create Schedule',
            user: req.session.user,
            clients,
            operators
        });
    } catch (error) {
        console.error('Error loading create schedule form:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/provider/schedule');
    }
};

// Create Schedule
exports.createSchedule = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const {
            clientId, operatorId, title, type,
            recurrenceType, startDate, endDate,
            startTime, endTime, duration,
            tasks, notes, specialInstructions
        } = req.body;
        
        // Parse tasks from form
        const tasksArray = tasks ? tasks.split(',').map(task => ({
            name: task.trim(),
            description: '',
            required: true
        })) : [];
        
        const schedule = new Schedule({
            providerId,
            clientId,
            operatorId,
            title,
            type,
            recurrence: {
                type: recurrenceType,
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                neverEnds: recurrenceType === 'once'
            },
            startTime,
            endTime,
            duration: duration || 60,
            tasks: tasksArray,
            notes,
            specialInstructions,
            createdBy: req.session.user._id
        });
        
        await schedule.save();
        
        // If it's a one-time schedule, create the interaction
        if (recurrenceType === 'once') {
            const scheduledDateTime = new Date(startDate);
            const [hours, minutes] = startTime.split(':');
            scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0);
            
            const endDateTime = new Date(startDate);
            const [endHours, endMinutes] = endTime.split(':');
            endDateTime.setHours(parseInt(endHours), parseInt(endMinutes), 0);
            
            const interaction = new Interaction({
                clientId,
                operatorId,
                providerId,
                type: type,
                title: title || `Scheduled ${type.replace('_', ' ')}`,
                scheduledStart: scheduledDateTime,
                scheduledEnd: endDateTime,
                duration: duration || 60,
                status: 'scheduled',
                createdBy: req.session.user._id
            });
            
            await interaction.save();
        }
        
        req.flash('success', 'Schedule created successfully');
        res.redirect('/provider/schedule');
    } catch (error) {
        console.error('Error creating schedule:', error);
        req.flash('error', 'Error creating schedule');
        res.redirect('/provider/schedule/create');
    }
};

// Get Schedule Details
exports.getScheduleDetails = async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const schedule = await Schedule.findOne({ _id: scheduleId, providerId })
            .populate('clientId', 'firstName lastName clientInfo.address')
            .populate('operatorId', 'firstName lastName operatorInfo')
            .populate('createdBy', 'firstName lastName');
        
        if (!schedule) {
            req.flash('error', 'Schedule not found');
            return res.redirect('/provider/schedule');
        }
        
        // Find related interactions
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const interactions = await Interaction.find({
            clientId: schedule.clientId._id,
            operatorId: schedule.operatorId._id,
            scheduledStart: { $gte: today }
        }).sort('scheduledStart');
        
        res.render('provider/schedule/show', {
            title: 'Schedule Details',
            user: req.session.user,
            schedule,
            interactions,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading schedule:', error);
        req.flash('error', 'Error loading schedule');
        res.redirect('/provider/schedule');
    }
};

// Update Schedule
exports.updateSchedule = async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const updateData = {
            title: req.body.title,
            type: req.body.type,
            startTime: req.body.startTime,
            endTime: req.body.endTime,
            duration: req.body.duration,
            notes: req.body.notes,
            specialInstructions: req.body.specialInstructions,
            isActive: req.body.isActive === 'on',
            updatedBy: req.session.user._id,
            updatedAt: Date.now()
        };
        
        const schedule = await Schedule.findOneAndUpdate(
            { _id: scheduleId, providerId },
            updateData,
            { new: true }
        );
        
        if (!schedule) {
            req.flash('error', 'Schedule not found');
            return res.redirect('/provider/schedule');
        }
        
        req.flash('success', 'Schedule updated successfully');
        res.redirect(`/provider/schedule/${scheduleId}`);
    } catch (error) {
        console.error('Error updating schedule:', error);
        req.flash('error', 'Error updating schedule');
        res.redirect(`/provider/schedule/${req.params.id}`);
    }
};

// Delete Schedule
exports.deleteSchedule = async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        // Soft delete - just mark as inactive
        await Schedule.findOneAndUpdate(
            { _id: scheduleId, providerId },
            { isActive: false, updatedBy: req.session.user._id }
        );
        
        req.flash('success', 'Schedule deleted successfully');
        res.redirect('/provider/schedule');
    } catch (error) {
        console.error('Error deleting schedule:', error);
        req.flash('error', 'Error deleting schedule');
        res.redirect('/provider/schedule');
    }
};