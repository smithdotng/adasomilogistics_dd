const mongoose = require('mongoose');

const carePlanSchema = new mongoose.Schema({
    serviceUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    careProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived', 'under_review'],
        default: 'draft'
    },
    
    // Personal Care
    personalCare: {
        bathing: {
            assistance: { type: String, enum: ['independent', 'minimal', 'moderate', 'full'] },
            preferences: String,
            equipment: [String]
        },
        dressing: {
            assistance: { type: String, enum: ['independent', 'minimal', 'moderate', 'full'] },
            preferences: String,
            specialRequirements: String
        },
        toileting: {
            assistance: { type: String, enum: ['independent', 'minimal', 'moderate', 'full'] },
            continence: String,
            equipment: [String]
        },
        oralCare: {
            assistance: { type: String, enum: ['independent', 'minimal', 'moderate', 'full'] },
            dentures: Boolean,
            specialNeeds: String
        }
    },
    
    // Mobility
    mobility: {
        mobilityAids: [String],
        transfers: {
            bed: String,
            chair: String,
            toilet: String
        },
        fallsRisk: {
            type: String,
            enum: ['low', 'medium', 'high']
        },
        fallsPreventionPlan: String,
        equipment: [String]
    },
    
    // Nutrition & Hydration
    nutrition: {
        dietType: [String],
        allergies: [String],
        textureModification: String,
        fluidIntake: String,
        mealtimeAssistance: String,
        specialRequirements: String,
        weightManagement: {
            target: Number,
            frequency: String,
            actions: String
        }
    },
    
    // Medication
    medicationManagement: {
        selfAdminister: Boolean,
        assistance: String,
        reminders: Boolean,
        monitored: Boolean,
        marChart: String,
        pharmacy: {
            name: String,
            phone: String,
            deliverySchedule: String
        }
    },
    
    // Health Monitoring
    healthMonitoring: {
        bloodPressure: { frequency: String },
        bloodGlucose: { frequency: String },
        oxygenSaturation: { frequency: String },
        painAssessment: { frequency: String },
        woundCare: [{
            location: String,
            description: String,
            treatment: String,
            frequency: String
        }]
    },
    
    // Social & Emotional
    socialCare: {
        activities: [{
            name: String,
            frequency: String,
            preferences: String
        }],
        socialInteractions: String,
        emotionalNeeds: String,
        spiritualNeeds: String,
        petCare: String
    },
    
    // Daily Schedule
    dailySchedule: [{
        time: String,
        task: String,
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notes: String
    }],
    
    // Goals
    goals: [{
        category: String,
        description: String,
        targetDate: Date,
        achievedDate: Date,
        status: { type: String, enum: ['pending', 'in_progress', 'achieved', 'cancelled'] },
        notes: String
    }],
    
    // Reviews
    reviewSchedule: {
        frequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'annually'] },
        lastReview: Date,
        nextReview: Date,
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Signatures
    signatures: {
        serviceUser: {
            signed: { type: Boolean, default: false },
            date: Date,
            signature: String
        },
        careProvider: {
            signed: { type: Boolean, default: false },
            date: Date,
            signature: String
        },
        family: [{
            name: String,
            relationship: String,
            signed: Date,
            signature: String
        }]
    },
    
    // Metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CarePlan', carePlanSchema);