const CarePlan = require('../models/CarePlan');
const User = require('../models/User');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');

// Get all care plans
// Get all care plans
exports.getCarePlans = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const { search, status, sort } = req.query;
        
        let query = { careProviderId };
        
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { 'serviceUserId.firstName': { $regex: search, $options: 'i' } },
                { 'serviceUserId.lastName': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        let sortOption = { createdAt: -1 };
        if (sort === 'name') sortOption = { 'serviceUserId.firstName': 1 };
        if (sort === 'review') sortOption = { 'reviewSchedule.nextReview': 1 };
        
        const carePlans = await CarePlan.find(query)
            .populate('serviceUserId', 'firstName lastName serviceUserInfo.nhsNumber')
            .populate('createdBy', 'firstName lastName')
            .sort(sortOption);
        
        // Prepare filters object for the view
        const filters = {
            search: search || '',
            status: status || 'all',
            sort: sort || 'newest'
        };
        
        res.render('careProvider/care-plans/index', {
            title: 'Care Plans',
            user: req.session.user,
            carePlans,
            filters,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading care plans:', error);
        req.flash('error', 'Error loading care plans');
        res.redirect('/care-provider/dashboard');
    }
};

// Create Care Plan Form
exports.getCreateCarePlan = async (req, res) => {
    try {
        const { serviceUserId } = req.params;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const serviceUser = await User.findOne({
            _id: serviceUserId,
            role: 'service_user',
            careProviderId
        });
        
        if (!serviceUser) {
            req.flash('error', 'Service User not found');
            return res.redirect('/care-provider/care-plans');
        }
        
        // Check if care plan already exists
        const existingPlan = await CarePlan.findOne({ serviceUserId });
        if (existingPlan) {
            req.flash('info', 'This service user already has a care plan. You can edit it instead.');
            return res.redirect(`/care-provider/care-plans/${existingPlan._id}/edit`);
        }
        
        res.render('careProvider/care-plans/create', {
            title: 'Create Care Plan',
            user: req.session.user,
            serviceUser
        });
    } catch (error) {
        console.error('Error loading create care plan form:', error);
        req.flash('error', 'Error loading form');
        res.redirect('/care-provider/care-plans');
    }
};

// Create Care Plan
exports.createCarePlan = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const carePlanData = {
            serviceUserId: req.body.serviceUserId,
            careProviderId,
            title: req.body.title,
            status: 'draft',
            
            // Personal Care
            personalCare: {
                bathing: {
                    assistance: req.body.bathingAssistance,
                    preferences: req.body.bathingPreferences,
                    equipment: req.body.bathingEquipment ? req.body.bathingEquipment.split(',') : []
                },
                dressing: {
                    assistance: req.body.dressingAssistance,
                    preferences: req.body.dressingPreferences,
                    specialRequirements: req.body.dressingSpecial
                },
                toileting: {
                    assistance: req.body.toiletingAssistance,
                    continence: req.body.continenceCare,
                    equipment: req.body.toiletingEquipment ? req.body.toiletingEquipment.split(',') : []
                }
            },
            
            // Mobility
            mobility: {
                mobilityAids: req.body.mobilityAids ? req.body.mobilityAids.split(',') : [],
                transfers: {
                    bed: req.body.transferBed,
                    chair: req.body.transferChair,
                    toilet: req.body.transferToilet
                },
                fallsRisk: req.body.fallsRisk,
                fallsPreventionPlan: req.body.fallsPrevention,
                equipment: req.body.mobilityEquipment ? req.body.mobilityEquipment.split(',') : []
            },
            
            // Nutrition
            nutrition: {
                dietType: req.body.dietType ? req.body.dietType.split(',') : [],
                allergies: req.body.dietAllergies ? req.body.dietAllergies.split(',') : [],
                textureModification: req.body.textureModification,
                fluidIntake: req.body.fluidIntake,
                mealtimeAssistance: req.body.mealtimeAssistance,
                specialRequirements: req.body.dietSpecial
            },
            
            // Medication
            medicationManagement: {
                selfAdminister: req.body.selfAdminister === 'on',
                assistance: req.body.medicationAssistance,
                reminders: req.body.medicationReminders === 'on',
                monitored: req.body.medicationMonitored === 'on',
                pharmacy: {
                    name: req.body.pharmacyName,
                    phone: req.body.pharmacyPhone,
                    deliverySchedule: req.body.pharmacyDelivery
                }
            },
            
            // Goals
            goals: req.body.goals ? req.body.goals.map(goal => ({
                category: goal.category,
                description: goal.description,
                targetDate: goal.targetDate,
                status: 'pending'
            })) : [],
            
            // Review Schedule
            reviewSchedule: {
                frequency: req.body.reviewFrequency,
                nextReview: req.body.nextReview
            },
            
            createdBy: req.session.user._id
        };
        
        const carePlan = new CarePlan(carePlanData);
        await carePlan.save();
        
        req.flash('success', 'Care plan created successfully');
        res.redirect(`/care-provider/care-plans/${carePlan._id}`);
    } catch (error) {
        console.error('Error creating care plan:', error);
        req.flash('error', 'Error creating care plan');
        res.redirect(`/care-provider/care-plans/create/${req.body.serviceUserId}`);
    }
};

// Get Care Plan Details
exports.getCarePlanDetails = async (req, res) => {
    try {
        const carePlanId = req.params.id;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const carePlan = await CarePlan.findOne({ _id: carePlanId, careProviderId })
            .populate('serviceUserId', 'firstName lastName serviceUserInfo')
            .populate('createdBy', 'firstName lastName')
            .populate('updatedBy', 'firstName lastName');
        
        if (!carePlan) {
            req.flash('error', 'Care plan not found');
            return res.redirect('/care-provider/care-plans');
        }
        
        res.render('careProvider/care-plans/show', {
            title: 'Care Plan Details',
            user: req.session.user,
            carePlan,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading care plan:', error);
        req.flash('error', 'Error loading care plan');
        res.redirect('/care-provider/care-plans');
    }
};

// Edit Care Plan Form
exports.getEditCarePlan = async (req, res) => {
    try {
        const carePlanId = req.params.id;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const carePlan = await CarePlan.findOne({ _id: carePlanId, careProviderId })
            .populate('serviceUserId', 'firstName lastName');
        
        if (!carePlan) {
            req.flash('error', 'Care plan not found');
            return res.redirect('/care-provider/care-plans');
        }
        
        res.render('careProvider/care-plans/edit', {
            title: 'Edit Care Plan',
            user: req.session.user,
            carePlan,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading care plan:', error);
        req.flash('error', 'Error loading care plan');
        res.redirect('/care-provider/care-plans');
    }
};

// Update Care Plan
exports.updateCarePlan = async (req, res) => {
    try {
        const carePlanId = req.params.id;
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const updateData = {
            title: req.body.title,
            status: req.body.status,
            'personalCare.bathing.assistance': req.body.bathingAssistance,
            'personalCare.bathing.preferences': req.body.bathingPreferences,
            'mobility.fallsRisk': req.body.fallsRisk,
            'nutrition.dietType': req.body.dietType ? req.body.dietType.split(',') : [],
            'reviewSchedule.frequency': req.body.reviewFrequency,
            'reviewSchedule.nextReview': req.body.nextReview,
            updatedBy: req.session.user._id,
            updatedAt: Date.now()
        };
        
        const carePlan = await CarePlan.findOneAndUpdate(
            { _id: carePlanId, careProviderId },
            updateData,
            { new: true }
        );
        
        if (!carePlan) {
            req.flash('error', 'Care plan not found');
            return res.redirect('/care-provider/care-plans');
        }
        
        req.flash('success', 'Care plan updated successfully');
        res.redirect(`/care-provider/care-plans/${carePlanId}`);
    } catch (error) {
        console.error('Error updating care plan:', error);
        req.flash('error', 'Error updating care plan');
        res.redirect(`/care-provider/care-plans/${req.params.id}/edit`);
    }
};