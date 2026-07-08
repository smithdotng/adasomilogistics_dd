const User = require('../models/User');
const CarePlan = require('../models/CarePlan');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const { sendServiceUserCredentials } = require('../services/emailService');

// Get all service users
exports.getClients = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const { search, status, sort } = req.query;
        
        let query = { role: 'service_user', careProviderId };
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'serviceUserInfo.nhsNumber': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status && status !== 'all') {
            query['serviceUserInfo.carePackage.type'] = status;
        }
        
        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { firstName: 1 };
        if (sort === 'recent') sortOption = { updatedAt: -1 };
        
        const serviceUsers = await User.find(query)
            .populate('serviceUserInfo.primarySupportWorker', 'firstName lastName')
            .populate('serviceUserInfo.secondarySupportWorkers', 'firstName lastName')
            .sort(sortOption);
        
        // Get additional stats for each service user
        const clientsWithStats = await Promise.all(serviceUsers.map(async (serviceUser) => {
            const interactionCount = await Interaction.countDocuments({ 
                serviceUserId: serviceUser._id,
                createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
            });
            
            const carePlan = await CarePlan.findOne({ serviceUserId: serviceUser._id });
            
            return {
                ...serviceUser.toObject(),
                stats: {
                    recentInteractions: interactionCount,
                    hasCarePlan: !!carePlan,
                    carePlanStatus: carePlan?.status || 'none'
                }
            };
        }));
        
        res.render('careProvider/service-users/index', {
            title: 'Manage Service Users',
            user: req.session.user,
            serviceUsers: clientsWithStats,
            filters: { search, status, sort },
            careTypes: ['domiciliary', 'residential', 'nursing', 'supported_living']
        });
    } catch (error) {
        console.error('Error loading service users:', error);
        req.flash('error', 'Error loading service users');
        res.redirect('/care-provider/dashboard');
    }
};

// Service User Dashboard
exports.getDashboard = async (req, res) => {
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
        
        // Build care team array for the stats card
        const careTeam = [];
        if (serviceUser.serviceUserInfo?.primarySupportWorker) careTeam.push(serviceUser.serviceUserInfo.primarySupportWorker);
        if (serviceUser.serviceUserInfo?.secondarySupportWorkers && serviceUser.serviceUserInfo.secondarySupportWorkers.length > 0) {
            careTeam.push(...serviceUser.serviceUserInfo.secondarySupportWorkers);
        }
        
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
            careTeam, // This was missing! Now it's defined
            stats: {
                totalVisits,
                upcomingVisits: upcomingCount
            },
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading service user dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Create Service User Form
exports.getCreateClient = (req, res) => {
    res.render('careProvider/service-users/create', {
        title: 'Add New Service User',
        user: req.session.user
    });
};

// Create Service User
exports.createClient = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const {
            email, firstName, lastName, phone,
            nhsNumber, dateOfBirth, gender,
            addressStreet, addressCity, addressPostcode,
            gpName, gpPhone, gpAddress,
            emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail,
            carePackageType, fundingSource, weeklyHours,
            medicalConditions, allergies
        } = req.body;
        
        // Check if email exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            req.flash('error', 'Email already registered');
            return res.redirect('/care-provider/service-users/create');
        }
        
        // Generate temporary password (8 characters)
        const tempPassword = Math.random().toString(36).slice(-8) + 
                           Math.random().toString(36).slice(-8).toUpperCase();
        
        // Parse medical conditions and allergies from comma-separated strings
        const medicalConditionsArray = medicalConditions ? 
            medicalConditions.split(',').map(item => ({ 
                name: item.trim(),
                diagnosedDate: null,
                severity: 'mild',
                notes: ''
            })) : [];
        
        const allergiesArray = allergies ? 
            allergies.split(',').map(item => ({ 
                allergen: item.trim(),
                reaction: '',
                severity: 'mild'
            })) : [];
        
        // Create emergency contacts array
        const emergencyContacts = [];
        if (emergencyName && emergencyPhone) {
            emergencyContacts.push({
                name: emergencyName,
                relationship: emergencyRelationship || '',
                phone: emergencyPhone,
                email: emergencyEmail || '',
                isPrimary: true
            });
        }
        
        // Create service user
        const serviceUser = new User({
            email,
            password: tempPassword,
            firstName,
            lastName,
            phone,
            role: 'service_user',
            careProviderId,
            address: {
                street: addressStreet,
                city: addressCity,
                postcode: addressPostcode,
                country: 'UK'
            },
            serviceUserInfo: {
                nhsNumber,
                dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                gender,
                gpDetails: {
                    name: gpName,
                    phone: gpPhone,
                    address: gpAddress
                },
                emergencyContacts,
                carePackage: {
                    type: carePackageType,
                    fundedBy: fundingSource,
                    weeklyHours: weeklyHours ? parseFloat(weeklyHours) : 0,
                    startDate: new Date()
                },
                medicalConditions: medicalConditionsArray,
                allergies: allergiesArray
            }
        });
        
        await serviceUser.save();
        
        // Send welcome email with credentials
        const emailResult = await sendServiceUserCredentials(serviceUser.email, tempPassword, {
            name: `${firstName} ${lastName}`,
            careProviderName: req.session.user.careProviderInfo?.companyName || 'Your Care Provider',
            loginUrl: `${req.protocol}://${req.get('host')}/login`
        });
        
        // Prepare success message
        let successMessage = 'Service User created successfully.';
        if (emailResult?.devMode) {
            successMessage += ' (Development mode - credentials shown in console)';
        } else if (!emailResult?.success) {
            successMessage += ' Login credentials could not be sent via email. Please contact the service user directly.';
        }
        
        req.flash('success', successMessage);
        res.redirect('/care-provider/service-users');
    } catch (error) {
        console.error('Error creating service user:', error);
        req.flash('error', 'Error creating service user: ' + error.message);
        res.redirect('/care-provider/service-users/create');
    }
};

// Get Service User Details
exports.getClientDetails = async (req, res) => {
    try {
        const serviceUserId = req.params.id;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const serviceUser = await User.findOne({
            _id: serviceUserId,
            role: 'service_user',
            careProviderId
        })
        .populate('serviceUserInfo.primarySupportWorker', 'firstName lastName email phone supportWorkerInfo')
        .populate('serviceUserInfo.secondarySupportWorkers', 'firstName lastName email')
        .populate('serviceUserInfo.guardians', 'firstName lastName email guardianInfo');
        
        if (!serviceUser) {
            req.flash('error', 'Service User not found');
            return res.redirect('/care-provider/service-users');
        }
        
        // Get care plan
        const CarePlan = require('../models/CarePlan');
        const carePlan = await CarePlan.findOne({ serviceUserId: serviceUser._id });
        
        // Get recent interactions
        const Interaction = require('../models/Interaction');
        const recentInteractions = await Interaction.find({ serviceUserId: serviceUser._id })
            .populate('supportWorkerId', 'firstName lastName')
            .sort('-createdAt')
            .limit(20);
        
        // Get upcoming schedule
        const Schedule = require('../models/Schedule');
        const today = new Date();
        const upcomingSchedule = await Schedule.find({
            serviceUserId: serviceUser._id,
            $or: [
                { 'recurrence.startDate': { $gte: today } },
                { 'recurrence.neverEnds': true }
            ]
        })
        .populate('supportWorkerId', 'firstName lastName')
        .limit(10);
        
        // Format dates for display
        const moment = require('moment');
        
        res.render('careProvider/service-users/show', {
            title: 'Service User Details',
            user: req.session.user,
            serviceUser,
            carePlan,
            recentInteractions,
            upcomingSchedule,
            moment
        });
    } catch (error) {
        console.error('Error loading service user details:', error);
        req.flash('error', 'Error loading service user details');
        res.redirect('/care-provider/service-users');
    }
};

// Edit Service User Form
// Edit Service User Form
exports.getEditClient = async (req, res) => {
    try {
        const serviceUser = await User.findOne({
            _id: req.params.id,
            role: 'service_user',
            careProviderId: req.session.user.role === 'care_provider' 
                ? req.session.user._id 
                : req.session.user.careProviderId
        });
        
        if (!serviceUser) {
            req.flash('error', 'Service User not found');
            return res.redirect('/care-provider/service-users');
        }
        
        // Get available support workers for assignment
        const supportWorkers = await User.find({
            role: 'support_worker',
            careProviderId: req.session.user.role === 'care_provider' 
                ? req.session.user._id 
                : req.session.user.careProviderId,
            isActive: true
        }).select('firstName lastName');
        
        // Make sure to require moment and pass it to the view
        const moment = require('moment');
        
        res.render('careProvider/service-users/edit', {
            title: 'Edit Service User',
            user: req.session.user,
            serviceUser,
            supportWorkers,
            moment // Pass moment to the template
        });
    } catch (error) {
        console.error('Error loading service user:', error);
        req.flash('error', 'Error loading service user');
        res.redirect('/care-provider/service-users');
    }
};

// Update Service User
exports.updateClient = async (req, res) => {
    try {
        const serviceUserId = req.params.id;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const {
            firstName, lastName, email, phone,
            nhsNumber, dateOfBirth, gender, maritalStatus,
            addressStreet, addressCity, addressCounty, addressPostcode,
            gpName, gpPhone, gpAddress,
            emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail,
            carePackageType, fundingSource, weeklyHours, careStartDate,
            medicalConditions, allergies,
            primarySupportWorker, isActive
        } = req.body;
        
        // Build update object
        const updateData = {
            firstName,
            lastName,
            email,
            phone,
            address: {
                street: addressStreet,
                city: addressCity,
                county: addressCounty || '',
                postcode: addressPostcode,
                country: 'UK'
            },
            isActive: isActive === 'on',
            'serviceUserInfo.nhsNumber': nhsNumber,
            'serviceUserInfo.dateOfBirth': dateOfBirth ? new Date(dateOfBirth) : null,
            'serviceUserInfo.gender': gender,
            'serviceUserInfo.maritalStatus': maritalStatus,
            'serviceUserInfo.gpDetails': {
                name: gpName,
                phone: gpPhone,
                address: gpAddress
            },
            'serviceUserInfo.carePackage': {
                type: carePackageType,
                fundedBy: fundingSource,
                weeklyHours: weeklyHours ? parseFloat(weeklyHours) : 0,
                startDate: careStartDate ? new Date(careStartDate) : null
            },
            'serviceUserInfo.primarySupportWorker': primarySupportWorker || null
        };
        
        // Update medical conditions if provided
        if (medicalConditions) {
            const conditionsArray = medicalConditions.split(',').map(item => ({
                name: item.trim(),
                diagnosedDate: null,
                severity: 'mild',
                notes: ''
            }));
            updateData['serviceUserInfo.medicalConditions'] = conditionsArray;
        }
        
        // Update allergies if provided
        if (allergies) {
            const allergiesArray = allergies.split(',').map(item => ({
                allergen: item.trim(),
                reaction: '',
                severity: 'mild'
            }));
            updateData['serviceUserInfo.allergies'] = allergiesArray;
        }
        
        // Update emergency contacts
        const emergencyContacts = [];
        if (emergencyName && emergencyPhone) {
            emergencyContacts.push({
                name: emergencyName,
                relationship: emergencyRelationship || '',
                phone: emergencyPhone,
                email: emergencyEmail || '',
                isPrimary: true
            });
        }
        updateData['serviceUserInfo.emergencyContacts'] = emergencyContacts;
        
        console.log('Updating service user with data:', updateData);
        
        const serviceUser = await User.findOneAndUpdate(
            { _id: serviceUserId, careProviderId },
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!serviceUser) {
            req.flash('error', 'Service User not found');
            return res.redirect('/care-provider/service-users');
        }
        
        req.flash('success', 'Service User updated successfully');
        res.redirect(`/care-provider/service-users/${serviceUserId}`);
    } catch (error) {
        console.error('Error updating service user:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error', 'Validation error: ' + messages.join(', '));
        } else {
            req.flash('error', 'Error updating service user: ' + error.message);
        }
        
        res.redirect(`/care-provider/service-users/${req.params.id}/edit`);
    }
};