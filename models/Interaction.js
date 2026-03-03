const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    operatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Interaction Details
    type: {
        type: String,
        enum: [
            'home_visit', 
            'phone_call', 
            'video_call',
            'medication_administration',
            'personal_care',
            'meal_preparation',
            'companionship',
            'appointment_escort',
            'emergency',
            'assessment',
            'review'
        ],
        required: true
    },
    title: String,
    description: String,
    
    // Schedule
    scheduledStart: Date,
    scheduledEnd: Date,
    actualStart: Date,
    actualEnd: Date,
    duration: Number, // in minutes
    
    // Status
    status: {
        type: String,
        enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'missed', 'rescheduled'],
        default: 'scheduled'
    },
    cancellationReason: String,
    missedReason: String,
    
    // Location
    location: {
        type: { type: String, enum: ['client_home', 'care_home', 'hospital', 'community', 'other'] },
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        checkInTime: Date,
        checkInLocation: {
            lat: Number,
            lng: Number
        },
        checkOutTime: Date,
        checkOutLocation: {
            lat: Number,
            lng: Number
        }
    },
    
    // Care Activities
    activities: [{
        name: String,
        completed: Boolean,
        notes: String,
        timeCompleted: Date
    }],
    
    // Medications Administered
    medications: [{
        name: String,
        dosage: String,
        timeScheduled: Date,
        timeGiven: Date,
        givenBy: String,
        witnessedBy: String,
        refused: Boolean,
        refusalReason: String,
        notes: String
    }],
    
    // Observations
    observations: {
        wellbeing: {
            mood: { type: String, enum: ['happy', 'content', 'anxious', 'sad', 'distressed'] },
            appetite: { type: String, enum: ['good', 'moderate', 'poor', 'none'] },
            energy: { type: String, enum: ['high', 'normal', 'low', 'very_low'] },
            pain: { type: Number, min: 0, max: 10 }, // Pain scale 0-10
            sleep: { type: String, enum: ['good', 'disturbed', 'poor'] }
        },
        vitalSigns: {
            bloodPressure: { systolic: Number, diastolic: Number },
            heartRate: Number,
            temperature: Number,
            oxygenSaturation: Number,
            bloodGlucose: Number,
            weight: Number
        },
        skinCondition: {
            intact: Boolean,
            redness: [String],
            bruising: [String],
            wounds: [{
                location: String,
                description: String,
                size: String,
                treatment: String
            }]
        },
        notes: String
    },
    
    // Tasks Completed
    tasksCompleted: [{
        task: String,
        completed: Boolean,
        notes: String
    }],
    
    // Incidents
    incidents: [{
        type: String,
        description: String,
        actionTaken: String,
        reportedTo: String,
        reportedTime: Date
    }],
    
    // Follow-up
    followUp: {
        required: Boolean,
        type: String,
        dueDate: Date,
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        completedDate: Date,
        notes: String
    },
    
    // Communication with Family
    familyCommunication: {
        contacted: Boolean,
        who: String,
        method: String,
        summary: String
    },
    
    // Attachments
    attachments: [{
        filename: String,
        originalName: String,
        mimeType: String,
        size: Number,
        url: String,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Signature
    signature: {
        type: String, // base64 or reference to image
        name: String,
        relationship: String,
        timestamp: Date
    },
    
    // Flags
    flags: [{
        type: String,
        severity: { type: String, enum: ['info', 'warning', 'urgent'] },
        message: String,
        resolved: { type: Boolean, default: false },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        resolvedAt: Date
    }],
    
    // Metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for queries
interactionSchema.index({ clientId: 1, scheduledStart: -1 });
interactionSchema.index({ operatorId: 1, scheduledStart: -1 });
interactionSchema.index({ providerId: 1, scheduledStart: -1 });
interactionSchema.index({ status: 1, scheduledStart: 1 });

module.exports = mongoose.model('Interaction', interactionSchema);