const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const CarePlan = require('../models/CarePlan');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail, sendOperatorCredentials } = require('../services/emailService');

// Provider Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        
        // Get statistics
        const [totalClients, totalOperators, totalInteractions, activeSchedules] = await Promise.all([
            User.countDocuments({ role: 'client', providerId, isActive: true }),
            User.countDocuments({ role: 'operator', providerId, isActive: true }),
            Interaction.countDocuments({ providerId }),
            Schedule.countDocuments({ providerId, isActive: true })
        ]);
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ providerId })
            .populate('clientId', 'firstName lastName')
            .populate('operatorId', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);
        
        // Get client statistics by care level
        const clientStats = await User.aggregate([
            { 
                $match: { 
                    role: 'client', 
                    providerId: toObjectId(providerId)
                } 
            },
            { 
                $group: { 
                    _id: '$clientInfo.carePackage.type',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        // Get operator performance stats
        const operatorStats = await User.aggregate([
            { 
                $match: { 
                    role: 'operator', 
                    providerId: toObjectId(providerId)
                } 
            },
            { 
                $lookup: {
                    from: 'interactions',
                    localField: '_id',
                    foreignField: 'operatorId',
                    as: 'interactions'
                }
            },
            { 
                $project: {
                    firstName: 1,
                    lastName: 1,
                    interactionCount: { $size: '$interactions' },
                    avgDuration: { $avg: '$interactions.duration' },
                    completedVisits: {
                        $size: {
                            $filter: {
                                input: '$interactions',
                                as: 'interaction',
                                cond: { $eq: ['$$interaction.status', 'completed'] }
                            }
                        }
                    }
                }
            },
            { $sort: { completedVisits: -1 } },
            { $limit: 5 }
        ]);
        
        res.render('provider/dashboard', {
            title: 'Provider Dashboard',
            user: req.session.user,
            stats: {
                totalClients,
                totalOperators,
                totalInteractions,
                activeSchedules
            },
            recentInteractions,
            clientStats,
            operatorStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Operator Management
exports.getOperators = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        const { search, status, sort } = req.query;
        
        let query = { role: 'operator', providerId };
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'operatorInfo.employeeId': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status && status !== 'all') {
            query['operatorInfo.employmentStatus'] = status;
        }
        
        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { firstName: 1 };
        if (sort === 'clients') sortOption = { 'operatorInfo.assignedClients': -1 };
        
        const operators = await User.find(query)
            .populate('operatorInfo.assignedClients', 'firstName lastName')
            .sort(sortOption);
        
        // Get client counts for each operator
        const operatorsWithStats = await Promise.all(operators.map(async (operator) => {
            const interactionCount = await Interaction.countDocuments({ 
                operatorId: operator._id,
                createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
            });
            
            return {
                ...operator.toObject(),
                stats: {
                    clientCount: operator.operatorInfo.assignedClients?.length || 0,
                    recentInteractions: interactionCount
                }
            };
        }));
        
        res.render('provider/operators/index', {
            title: 'Manage Operators',
            user: req.session.user,
            operators: operatorsWithStats,
            filters: { search, status, sort },
            employmentStatuses: ['active', 'probation', 'suspended', 'terminated', 'on_leave']
        });
    } catch (error) {
        console.error('Error loading operators:', error);
        req.flash('error', 'Error loading operators');
        res.redirect('/provider/dashboard');
    }
};

// Create Operator Form
exports.getCreateOperator = (req, res) => {
    res.render('provider/operators/create', {
        title: 'Add New Operator',
        user: req.session.user
    });
};

// Create Operator
exports.createOperator = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        const {
            email, firstName, lastName, phone,
            employeeId, dateOfBirth, nationalInsurance,
            hourlyRate, contractType, employmentStartDate,
            emergencyName, emergencyRelationship, emergencyPhone
        } = req.body;
        
        // Check if email exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/provider/operators/create');
        }
        
        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 
                           Math.random().toString(36).slice(-8).toUpperCase();
        
        // Create operator
        const operator = new User({
            email,
            password: tempPassword,
            firstName,
            lastName,
            phone,
            role: 'operator',
            providerId,
            operatorInfo: {
                employeeId,
                dateOfBirth,
                nationalInsurance,
                hourlyRate,
                contractType,
                employmentStartDate,
                employmentStatus: 'probation',
                emergencyContact: {
                    name: emergencyName,
                    relationship: emergencyRelationship,
                    phone: emergencyPhone
                }
            }
        });
        
        await operator.save();
        
        // Send welcome email with credentials
        await sendOperatorCredentials(operator.email, tempPassword, {
            name: `${firstName} ${lastName}`,
            providerName: req.session.user.providerInfo.companyName,
            loginUrl: `${req.protocol}://${req.get('host')}/login`
        });
        
        req.flash('success', 'Operator created successfully. Login credentials have been sent to their email.');
        res.redirect('/provider/operators');
    } catch (error) {
        console.error('Error creating operator:', error);
        req.flash('error', 'Error creating operator');
        res.redirect('/provider/operators/create');
    }
};

// View Operator Details
exports.getOperatorDetails = async (req, res) => {
    try {
        const providerId = req.session.user._id;
        const operatorId = req.params.id;
        
        const operator = await User.findOne({
            _id: operatorId,
            role: 'operator',
            providerId
        }).populate('operatorInfo.assignedClients', 'firstName lastName clientInfo.nhsNumber');
        
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/provider/operators');
        }
        
        // Get operator's recent interactions
        const recentInteractions = await Interaction.find({ operatorId })
            .populate('clientId', 'firstName lastName')
            .sort('-createdAt')
            .limit(20);
        
        // Get today's schedule
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todaySchedule = await Schedule.find({
            operatorId,
            $or: [
                { 'recurrence.startDate': { $lte: today } },
                { createdAt: { $gte: today, $lt: tomorrow } }
            ]
        }).populate('clientId', 'firstName lastName');
        
        // Get performance metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const interactionStats = await Interaction.aggregate([
            { 
                $match: { 
                    operatorId: toObjectId(operatorId),
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            { 
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.render('provider/operators/show', {
            title: 'Operator Details',
            user: req.session.user,
            operator,
            recentInteractions,
            todaySchedule,
            interactionStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading operator details:', error);
        req.flash('error', 'Error loading operator details');
        res.redirect('/provider/operators');
    }
};

// Edit Operator Form
exports.getEditOperator = async (req, res) => {
    try {
        const operator = await User.findOne({
            _id: req.params.id,
            role: 'operator',
            providerId: req.session.user._id
        });
        
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/provider/operators');
        }
        
        res.render('provider/operators/edit', {
            title: 'Edit Operator',
            user: req.session.user,
            operator
        });
    } catch (error) {
        console.error('Error loading operator:', error);
        req.flash('error', 'Error loading operator');
        res.redirect('/provider/operators');
    }
};

// Update Operator
exports.updateOperator = async (req, res) => {
    try {
        const operatorId = req.params.id;
        const providerId = req.session.user._id;
        
        const updateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            'operatorInfo.hourlyRate': req.body.hourlyRate,
            'operatorInfo.contractType': req.body.contractType,
            'operatorInfo.employmentStatus': req.body.employmentStatus,
            'operatorInfo.maxClients': req.body.maxClients,
            'operatorInfo.travelRadius': req.body.travelRadius,
            'operatorInfo.hasVehicle': req.body.hasVehicle === 'on',
            'operatorInfo.emergencyContact': {
                name: req.body.emergencyName,
                relationship: req.body.emergencyRelationship,
                phone: req.body.emergencyPhone,
                email: req.body.emergencyEmail
            }
        };
        
        const operator = await User.findOneAndUpdate(
            { _id: operatorId, providerId },
            updateData,
            { new: true }
        );
        
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/provider/operators');
        }
        
        req.flash('success', 'Operator updated successfully');
        res.redirect(`/provider/operators/${operatorId}`);
    } catch (error) {
        console.error('Error updating operator:', error);
        req.flash('error', 'Error updating operator');
        res.redirect(`/provider/operators/${req.params.id}/edit`);
    }
};

// Assign Clients to Operator
exports.assignClients = async (req, res) => {
    try {
        const { operatorId } = req.params;
        const { clientIds } = req.body;
        const providerId = req.session.user._id;
        
        const operator = await User.findOne({ _id: operatorId, providerId });
        
        if (!operator) {
            return res.status(404).json({ error: 'Operator not found' });
        }
        
        operator.operatorInfo.assignedClients = clientIds;
        await operator.save();
        
        // Update clients with primary carer if not set
        if (clientIds && clientIds.length > 0) {
            await User.updateMany(
                { _id: { $in: clientIds }, 'clientInfo.primaryCarer': { $exists: false } },
                { 'clientInfo.primaryCarer': operatorId }
            );
        }
        
        req.flash('success', 'Clients assigned successfully');
        res.redirect(`/provider/operators/${operatorId}`);
    } catch (error) {
        console.error('Error assigning clients:', error);
        req.flash('error', 'Error assigning clients');
        res.redirect(`/provider/operators/${req.params.operatorId}`);
    }
};

// Upload operator documents
exports.uploadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const providerId = req.session.user._id;
        
        const operator = await User.findOne({ _id: id, providerId });
        
        if (!operator) {
            req.flash('error', 'Operator not found');
            return res.redirect('/provider/operators');
        }
        
        // Handle file upload logic here
        // This is a placeholder - implement actual file upload
        
        req.flash('success', 'Document uploaded successfully');
        res.redirect(`/provider/operators/${id}`);
    } catch (error) {
        console.error('Error uploading document:', error);
        req.flash('error', 'Error uploading document');
        res.redirect(`/provider/operators/${req.params.id}`);
    }
};

// Operator Dashboard
exports.getOperatorDashboard = async (req, res) => {
    try {
        const operatorId = req.session.user._id;
        const providerId = req.session.user.providerId;
        
        // Get today's schedule
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
            .populate('operatorInfo.assignedClients', 'firstName lastName clientInfo');
        
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
                    operatorId: toObjectId(operatorId),
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
            assignedClients: operator.operatorInfo.assignedClients || [],
            recentInteractions,
            weeklyStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading operator dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};