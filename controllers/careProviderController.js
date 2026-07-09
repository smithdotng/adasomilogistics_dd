const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const CarePlan = require('../models/CarePlan');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail, sendSupportWorkerCredentials } = require('../services/emailService');

// Care Provider Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        
        // Get statistics
        const [totalServiceUsers, totalOperators, totalInteractions, activeSchedules] = await Promise.all([
            User.countDocuments({ role: 'service_user', careProviderId, isActive: true }),
            User.countDocuments({ role: 'support_worker', careProviderId, isActive: true }),
            Interaction.countDocuments({ careProviderId }),
            Schedule.countDocuments({ careProviderId, isActive: true })
        ]);
        
        // Get recent interactions
        const recentInteractions = await Interaction.find({ careProviderId })
            .populate('serviceUserId', 'firstName lastName')
            .populate('supportWorkerId', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);
        
        // Get service user statistics by care level
        const serviceUserStats = await User.aggregate([
            { 
                $match: { 
                    role: 'service_user', 
                    careProviderId: toObjectId(careProviderId)
                } 
            },
            { 
                $group: { 
                    _id: '$serviceUserInfo.carePackage.type',
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }
        ]);
        
        // Get support worker performance stats
        const supportWorkerStats = await User.aggregate([
            { 
                $match: { 
                    role: 'support_worker', 
                    careProviderId: toObjectId(careProviderId)
                } 
            },
            { 
                $lookup: {
                    from: 'interactions',
                    localField: '_id',
                    foreignField: 'supportWorkerId',
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
        
        res.render('careProvider/dashboard', {
            title: 'Care Provider Dashboard',
            user: req.session.user,
            stats: {
                totalServiceUsers,
                totalOperators,
                totalInteractions,
                activeSchedules
            },
            recentInteractions,
            serviceUserStats,
            supportWorkerStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Support Worker Management
exports.getOperators = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { search, status, sort } = req.query;
        
        let query = { role: 'support_worker', careProviderId };
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'supportWorkerInfo.employeeId': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status && status !== 'all') {
            query['supportWorkerInfo.employmentStatus'] = status;
        }
        
        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { firstName: 1 };
        if (sort === 'service users') sortOption = { 'supportWorkerInfo.assignedServiceUsers': -1 };
        
        const supportWorkers = await User.find(query)
            .populate('supportWorkerInfo.assignedServiceUsers', 'firstName lastName')
            .sort(sortOption);
        
        // Get service user counts for each support worker
        const operatorsWithStats = await Promise.all(supportWorkers.map(async (supportWorker) => {
            const interactionCount = await Interaction.countDocuments({ 
                supportWorkerId: supportWorker._id,
                createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
            });
            
            return {
                ...supportWorker.toObject(),
                stats: {
                    clientCount: supportWorker.supportWorkerInfo.assignedServiceUsers?.length || 0,
                    recentInteractions: interactionCount
                }
            };
        }));
        
        res.render('careProvider/support-workers/index', {
            title: 'Manage Support Workers',
            user: req.session.user,
            supportWorkers: operatorsWithStats,
            filters: { search, status, sort },
            employmentStatuses: ['active', 'probation', 'suspended', 'terminated', 'on_leave']
        });
    } catch (error) {
        console.error('Error loading support workers:', error);
        req.flash('error', 'Error loading support workers');
        res.redirect('/care-provider/dashboard');
    }
};

// Create Support Worker Form
exports.getCreateOperator = (req, res) => {
    res.render('careProvider/support-workers/create', {
        title: 'Add New Support Worker',
        user: req.session.user
    });
};

// Create Support Worker
exports.createOperator = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
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
            return res.redirect('/care-provider/support-workers/create');
        }
        
        // Generate temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + 
                           Math.random().toString(36).slice(-8).toUpperCase();
        
        // Create support worker
        const supportWorker = new User({
            email,
            password: tempPassword,
            firstName,
            lastName,
            phone,
            role: 'support_worker',
            careProviderId,
            supportWorkerInfo: {
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
        
        await supportWorker.save();
        
        // Send welcome email with credentials
        await sendSupportWorkerCredentials(supportWorker.email, tempPassword, {
            name: `${firstName} ${lastName}`,
            careProviderName: req.session.user.careProviderInfo.companyName,
            loginUrl: `${req.protocol}://${req.get('host')}/login`
        });
        
        req.flash('success', 'Support Worker created successfully. Login credentials have been sent to their email.');
        res.redirect('/care-provider/support-workers');
    } catch (error) {
        console.error('Error creating support worker:', error);
        req.flash('error', 'Error creating support worker');
        res.redirect('/care-provider/support-workers/create');
    }
};

// View Support Worker Details
exports.getOperatorDetails = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const supportWorkerId = req.params.id;
        
        const supportWorker = await User.findOne({
            _id: supportWorkerId,
            role: 'support_worker',
            careProviderId
        }).populate('supportWorkerInfo.assignedServiceUsers', 'firstName lastName serviceUserInfo.nhsNumber');
        
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }
        
        // Get support worker's recent interactions
        const recentInteractions = await Interaction.find({ supportWorkerId })
            .populate('serviceUserId', 'firstName lastName')
            .sort('-createdAt')
            .limit(20);
        
        // Get today's schedule
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todaySchedule = await Schedule.find({
            supportWorkerId,
            $or: [
                { 'recurrence.startDate': { $lte: today } },
                { createdAt: { $gte: today, $lt: tomorrow } }
            ]
        }).populate('serviceUserId', 'firstName lastName');
        
        // Get performance metrics
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const interactionStats = await Interaction.aggregate([
            { 
                $match: { 
                    supportWorkerId: toObjectId(supportWorkerId),
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
        
        res.render('careProvider/support-workers/show', {
            title: 'Support Worker Details',
            user: req.session.user,
            supportWorker,
            recentInteractions,
            todaySchedule,
            interactionStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading support worker details:', error);
        req.flash('error', 'Error loading support worker details');
        res.redirect('/care-provider/support-workers');
    }
};

// Edit Support Worker Form
exports.getEditOperator = async (req, res) => {
    try {
        const supportWorker = await User.findOne({
            _id: req.params.id,
            role: 'support_worker',
            careProviderId: req.session.user._id
        });
        
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }
        
        res.render('careProvider/support-workers/edit', {
            title: 'Edit Support Worker',
            user: req.session.user,
            supportWorker
        });
    } catch (error) {
        console.error('Error loading support worker:', error);
        req.flash('error', 'Error loading support worker');
        res.redirect('/care-provider/support-workers');
    }
};

// Update Support Worker
exports.updateOperator = async (req, res) => {
    try {
        const supportWorkerId = req.params.id;
        const careProviderId = req.session.user._id;
        
        const updateData = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            'supportWorkerInfo.hourlyRate': req.body.hourlyRate,
            'supportWorkerInfo.contractType': req.body.contractType,
            'supportWorkerInfo.employmentStatus': req.body.employmentStatus,
            'supportWorkerInfo.maxServiceUsers': req.body.maxServiceUsers,
            'supportWorkerInfo.travelRadius': req.body.travelRadius,
            'supportWorkerInfo.hasVehicle': req.body.hasVehicle === 'on',
            'supportWorkerInfo.emergencyContact': {
                name: req.body.emergencyName,
                relationship: req.body.emergencyRelationship,
                phone: req.body.emergencyPhone,
                email: req.body.emergencyEmail
            }
        };
        
        const supportWorker = await User.findOneAndUpdate(
            { _id: supportWorkerId, careProviderId },
            updateData,
            { new: true }
        );
        
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }
        
        req.flash('success', 'Support Worker updated successfully');
        res.redirect(`/care-provider/support-workers/${supportWorkerId}`);
    } catch (error) {
        console.error('Error updating support worker:', error);
        req.flash('error', 'Error updating support worker');
        res.redirect(`/care-provider/support-workers/${req.params.id}/edit`);
    }
};

// Assign Service Users to Support Worker - Form
exports.getAssignServiceUsers = async (req, res) => {
    try {
        const { supportWorkerId } = req.params;
        const careProviderId = req.session.user._id;

        const supportWorker = await User.findOne({
            _id: supportWorkerId,
            role: 'support_worker',
            careProviderId
        });

        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }

        const serviceUsers = await User.find({
            role: 'service_user',
            careProviderId,
            isActive: true
        }).select('firstName lastName serviceUserInfo.nhsNumber serviceUserInfo.carePackage').sort('firstName');

        const assignedIds = (supportWorker.supportWorkerInfo?.assignedServiceUsers || []).map(id => id.toString());

        res.render('careProvider/support-workers/assign', {
            title: 'Assign Service Users',
            user: req.session.user,
            supportWorker,
            serviceUsers,
            assignedIds
        });
    } catch (error) {
        console.error('Error loading assign service users form:', error);
        req.flash('error', 'Error loading service users');
        res.redirect('/care-provider/support-workers');
    }
};

// Assign Service Users to Support Worker
exports.assignServiceUsers = async (req, res) => {
    try {
        const { supportWorkerId } = req.params;
        const careProviderId = req.session.user._id;

        // Checkbox inputs come through as a string (one checked), an array
        // (multiple checked), or undefined (none checked) - normalize to an array.
        let serviceUserIds = req.body.serviceUserIds || [];
        if (!Array.isArray(serviceUserIds)) {
            serviceUserIds = [serviceUserIds];
        }

        const supportWorker = await User.findOne({ _id: supportWorkerId, careProviderId });

        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }

        supportWorker.supportWorkerInfo.assignedServiceUsers = serviceUserIds;
        await supportWorker.save({ validateModifiedOnly: true });
        
        // Update service users with primary carer if not set
        if (serviceUserIds && serviceUserIds.length > 0) {
            await User.updateMany(
                { _id: { $in: serviceUserIds }, 'serviceUserInfo.primarySupportWorker': { $exists: false } },
                { 'serviceUserInfo.primarySupportWorker': supportWorkerId }
            );
        }
        
        req.flash('success', 'Service Users assigned successfully');
        res.redirect(`/care-provider/support-workers/${supportWorkerId}`);
    } catch (error) {
        console.error('Error assigning service users:', error);
        req.flash('error', 'Error assigning service users');
        res.redirect(`/care-provider/support-workers/${req.params.supportWorkerId}`);
    }
};

// Upload support worker documents
exports.uploadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const careProviderId = req.session.user._id;
        
        const supportWorker = await User.findOne({ _id: id, careProviderId });
        
        if (!supportWorker) {
            req.flash('error', 'Support Worker not found');
            return res.redirect('/care-provider/support-workers');
        }
        
        // Handle file upload logic here
        // This is a placeholder - implement actual file upload
        
        req.flash('success', 'Document uploaded successfully');
        res.redirect(`/care-provider/support-workers/${id}`);
    } catch (error) {
        console.error('Error uploading document:', error);
        req.flash('error', 'Error uploading document');
        res.redirect(`/care-provider/support-workers/${req.params.id}`);
    }
};

// Support Worker Dashboard
exports.getOperatorDashboard = async (req, res) => {
    try {
        const supportWorkerId = req.session.user._id;
        const careProviderId = req.session.user.careProviderId;
        
        // Get today's schedule
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
            .populate('supportWorkerInfo.assignedServiceUsers', 'firstName lastName serviceUserInfo');
        
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
                    supportWorkerId: toObjectId(supportWorkerId),
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
            assignedServiceUsers: supportWorker.supportWorkerInfo.assignedServiceUsers || [],
            recentInteractions,
            weeklyStats,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading support worker dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};