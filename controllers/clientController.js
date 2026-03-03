const User = require('../models/User');
const CarePlan = require('../models/CarePlan');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const { sendClientCredentials } = require('../services/emailService');

// Get all clients
exports.getClients = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const { search, status, sort } = req.query;
        
        let query = { role: 'client', providerId };
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { 'clientInfo.nhsNumber': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status && status !== 'all') {
            query['clientInfo.carePackage.type'] = status;
        }
        
        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { firstName: 1 };
        if (sort === 'recent') sortOption = { updatedAt: -1 };
        
        const clients = await User.find(query)
            .populate('clientInfo.primaryCarer', 'firstName lastName')
            .populate('clientInfo.secondaryCarers', 'firstName lastName')
            .sort(sortOption);
        
        // Get additional stats for each client
        const clientsWithStats = await Promise.all(clients.map(async (client) => {
            const interactionCount = await Interaction.countDocuments({ 
                clientId: client._id,
                createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
            });
            
            const carePlan = await CarePlan.findOne({ clientId: client._id });
            
            return {
                ...client.toObject(),
                stats: {
                    recentInteractions: interactionCount,
                    hasCarePlan: !!carePlan,
                    carePlanStatus: carePlan?.status || 'none'
                }
            };
        }));
        
        res.render('provider/clients/index', {
            title: 'Manage Clients',
            user: req.session.user,
            clients: clientsWithStats,
            filters: { search, status, sort },
            careTypes: ['domiciliary', 'residential', 'nursing', 'supported_living']
        });
    } catch (error) {
        console.error('Error loading clients:', error);
        req.flash('error', 'Error loading clients');
        res.redirect('/provider/dashboard');
    }
};

// Client Dashboard
exports.getDashboard = async (req, res) => {
    try {
        const clientId = req.session.user._id;
        
        const client = await User.findById(clientId)
            .populate('clientInfo.primaryCarer')
            .populate('clientInfo.secondaryCarers')
            .populate('clientInfo.guardians');
        
        const carePlan = await CarePlan.findOne({ clientId });
        
        // Get upcoming visits
        const upcomingVisits = await Interaction.find({
            clientId,
            scheduledStart: { $gte: new Date() },
            status: 'scheduled'
        })
        .populate('operatorId', 'firstName lastName')
        .sort('scheduledStart')
        .limit(5);
        
        // Get recent visits
        const recentVisits = await Interaction.find({
            clientId,
            status: 'completed'
        })
        .populate('operatorId', 'firstName lastName')
        .sort('-scheduledStart')
        .limit(10);
        
        // Calculate stats
        const totalVisits = await Interaction.countDocuments({ clientId });
        const upcomingCount = await Interaction.countDocuments({
            clientId,
            scheduledStart: { $gte: new Date() }
        });
        
        // Get today's medications (simplified)
        const todaysMeds = client.clientInfo?.medications?.slice(0, 3) || [];
        
        // Build care team array for the stats card
        const careTeam = [];
        if (client.clientInfo?.primaryCarer) careTeam.push(client.clientInfo.primaryCarer);
        if (client.clientInfo?.secondaryCarers && client.clientInfo.secondaryCarers.length > 0) {
            careTeam.push(...client.clientInfo.secondaryCarers);
        }
        
        res.render('client/dashboard', {
            title: 'My Dashboard',
            user: req.session.user,
            clientInfo: client.clientInfo,
            carePlan,
            upcomingVisits,
            recentVisits,
            primaryCarer: client.clientInfo?.primaryCarer,
            secondaryCarers: client.clientInfo?.secondaryCarers,
            emergencyContacts: client.clientInfo?.emergencyContacts,
            todaysMeds,
            careTeam, // This was missing! Now it's defined
            stats: {
                totalVisits,
                upcomingVisits: upcomingCount
            },
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading client dashboard:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/');
    }
};

// Create Client Form
exports.getCreateClient = (req, res) => {
    res.render('provider/clients/create', {
        title: 'Add New Client',
        user: req.session.user
    });
};

// Create Client
exports.createClient = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
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
            return res.redirect('/provider/clients/create');
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
        
        // Create client
        const client = new User({
            email,
            password: tempPassword,
            firstName,
            lastName,
            phone,
            role: 'client',
            providerId,
            address: {
                street: addressStreet,
                city: addressCity,
                postcode: addressPostcode,
                country: 'UK'
            },
            clientInfo: {
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
        
        await client.save();
        
        // Send welcome email with credentials
        const emailResult = await sendClientCredentials(client.email, tempPassword, {
            name: `${firstName} ${lastName}`,
            providerName: req.session.user.providerInfo?.companyName || 'Your Care Provider',
            loginUrl: `${req.protocol}://${req.get('host')}/login`
        });
        
        // Prepare success message
        let successMessage = 'Client created successfully.';
        if (emailResult?.devMode) {
            successMessage += ' (Development mode - credentials shown in console)';
        } else if (!emailResult?.success) {
            successMessage += ' Login credentials could not be sent via email. Please contact the client directly.';
        }
        
        req.flash('success', successMessage);
        res.redirect('/provider/clients');
    } catch (error) {
        console.error('Error creating client:', error);
        req.flash('error', 'Error creating client: ' + error.message);
        res.redirect('/provider/clients/create');
    }
};

// Get Client Details
exports.getClientDetails = async (req, res) => {
    try {
        const clientId = req.params.id;
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const client = await User.findOne({
            _id: clientId,
            role: 'client',
            providerId
        })
        .populate('clientInfo.primaryCarer', 'firstName lastName email phone operatorInfo')
        .populate('clientInfo.secondaryCarers', 'firstName lastName email')
        .populate('clientInfo.guardians', 'firstName lastName email guardianInfo');
        
        if (!client) {
            req.flash('error', 'Client not found');
            return res.redirect('/provider/clients');
        }
        
        // Get care plan
        const CarePlan = require('../models/CarePlan');
        const carePlan = await CarePlan.findOne({ clientId: client._id });
        
        // Get recent interactions
        const Interaction = require('../models/Interaction');
        const recentInteractions = await Interaction.find({ clientId: client._id })
            .populate('operatorId', 'firstName lastName')
            .sort('-createdAt')
            .limit(20);
        
        // Get upcoming schedule
        const Schedule = require('../models/Schedule');
        const today = new Date();
        const upcomingSchedule = await Schedule.find({
            clientId: client._id,
            $or: [
                { 'recurrence.startDate': { $gte: today } },
                { 'recurrence.neverEnds': true }
            ]
        })
        .populate('operatorId', 'firstName lastName')
        .limit(10);
        
        // Format dates for display
        const moment = require('moment');
        
        res.render('provider/clients/show', {
            title: 'Client Details',
            user: req.session.user,
            client,
            carePlan,
            recentInteractions,
            upcomingSchedule,
            moment
        });
    } catch (error) {
        console.error('Error loading client details:', error);
        req.flash('error', 'Error loading client details');
        res.redirect('/provider/clients');
    }
};

// Edit Client Form
// Edit Client Form
exports.getEditClient = async (req, res) => {
    try {
        const client = await User.findOne({
            _id: req.params.id,
            role: 'client',
            providerId: req.session.user.role === 'service_provider' 
                ? req.session.user._id 
                : req.session.user.providerId
        });
        
        if (!client) {
            req.flash('error', 'Client not found');
            return res.redirect('/provider/clients');
        }
        
        // Get available operators for assignment
        const operators = await User.find({
            role: 'operator',
            providerId: req.session.user.role === 'service_provider' 
                ? req.session.user._id 
                : req.session.user.providerId,
            isActive: true
        }).select('firstName lastName');
        
        // Make sure to require moment and pass it to the view
        const moment = require('moment');
        
        res.render('provider/clients/edit', {
            title: 'Edit Client',
            user: req.session.user,
            client,
            operators,
            moment // Pass moment to the template
        });
    } catch (error) {
        console.error('Error loading client:', error);
        req.flash('error', 'Error loading client');
        res.redirect('/provider/clients');
    }
};

// Update Client
exports.updateClient = async (req, res) => {
    try {
        const clientId = req.params.id;
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
        const {
            firstName, lastName, email, phone,
            nhsNumber, dateOfBirth, gender, maritalStatus,
            addressStreet, addressCity, addressCounty, addressPostcode,
            gpName, gpPhone, gpAddress,
            emergencyName, emergencyRelationship, emergencyPhone, emergencyEmail,
            carePackageType, fundingSource, weeklyHours, careStartDate,
            medicalConditions, allergies,
            primaryCarer, isActive
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
            'clientInfo.nhsNumber': nhsNumber,
            'clientInfo.dateOfBirth': dateOfBirth ? new Date(dateOfBirth) : null,
            'clientInfo.gender': gender,
            'clientInfo.maritalStatus': maritalStatus,
            'clientInfo.gpDetails': {
                name: gpName,
                phone: gpPhone,
                address: gpAddress
            },
            'clientInfo.carePackage': {
                type: carePackageType,
                fundedBy: fundingSource,
                weeklyHours: weeklyHours ? parseFloat(weeklyHours) : 0,
                startDate: careStartDate ? new Date(careStartDate) : null
            },
            'clientInfo.primaryCarer': primaryCarer || null
        };
        
        // Update medical conditions if provided
        if (medicalConditions) {
            const conditionsArray = medicalConditions.split(',').map(item => ({
                name: item.trim(),
                diagnosedDate: null,
                severity: 'mild',
                notes: ''
            }));
            updateData['clientInfo.medicalConditions'] = conditionsArray;
        }
        
        // Update allergies if provided
        if (allergies) {
            const allergiesArray = allergies.split(',').map(item => ({
                allergen: item.trim(),
                reaction: '',
                severity: 'mild'
            }));
            updateData['clientInfo.allergies'] = allergiesArray;
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
        updateData['clientInfo.emergencyContacts'] = emergencyContacts;
        
        console.log('Updating client with data:', updateData);
        
        const client = await User.findOneAndUpdate(
            { _id: clientId, providerId },
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!client) {
            req.flash('error', 'Client not found');
            return res.redirect('/provider/clients');
        }
        
        req.flash('success', 'Client updated successfully');
        res.redirect(`/provider/clients/${clientId}`);
    } catch (error) {
        console.error('Error updating client:', error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            req.flash('error', 'Validation error: ' + messages.join(', '));
        } else {
            req.flash('error', 'Error updating client: ' + error.message);
        }
        
        res.redirect(`/provider/clients/${req.params.id}/edit`);
    }
};