const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    careProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    serviceUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    supportWorkerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Schedule Details
    title: String,
    type: {
        type: String,
        enum: ['regular_visit', 'medication', 'personal_care', 'meal', 'appointment', 'other'],
        required: true
    },
    
    // Recurrence
    recurrence: {
        type: { type: String, enum: ['once', 'daily', 'weekly', 'biweekly', 'monthly'] },
        interval: Number,
        daysOfWeek: [Number], // 0-6 (Sunday-Saturday)
        startDate: Date,
        endDate: Date,
        neverEnds: { type: Boolean, default: false }
    },
    
    // Time
    startTime: String,
    endTime: String,
    duration: Number, // in minutes
    
    // Tasks
    tasks: [{
        name: String,
        description: String,
        required: { type: Boolean, default: true },
        estimatedDuration: Number
    }],
    
    // Notes
    notes: String,
    specialInstructions: String,
    
    // Status
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Schedule', scheduleSchema);