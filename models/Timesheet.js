const mongoose = require('mongoose');

const timesheetSchema = new mongoose.Schema({
    supportWorkerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    careProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Timesheet Period
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    weekNumber: Number,
    year: Number,
    
    // Entries
    entries: [{
        date: Date,
        serviceUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        clientName: String,
        shiftType: {
            type: String,
            enum: ['regular', 'overtime', 'weekend', 'bank_holiday', 'night', 'on_call']
        },
        startTime: Date,
        endTime: Date,
        breakDuration: Number, // in minutes
        totalHours: Number, // calculated
        regularHours: Number,
        overtimeHours: Number,
        rate: Number, // rate for this shift
        amount: Number, // calculated amount
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        notes: String,
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: Date
    }],
    
    // Totals
    totalRegularHours: { type: Number, default: 0 },
    totalOvertimeHours: { type: Number, default: 0 },
    totalWeekendHours: { type: Number, default: 0 },
    totalBankHolidayHours: { type: Number, default: 0 },
    totalNightHours: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    
    // Status
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'paid', 'rejected'],
        default: 'draft'
    },
    submittedAt: Date,
    approvedAt: Date,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    paidAt: Date,
    
    // Notes
    notes: String,
    rejectionReason: String,
    
    // Metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Calculate totals before saving
timesheetSchema.pre('save', function(next) {
    let totalRegular = 0;
    let totalOvertime = 0;
    let totalWeekend = 0;
    let totalBankHoliday = 0;
    let totalNight = 0;
    let totalAmount = 0;
    
    this.entries.forEach(entry => {
        switch(entry.shiftType) {
            case 'regular':
                totalRegular += entry.totalHours || 0;
                break;
            case 'overtime':
                totalOvertime += entry.totalHours || 0;
                break;
            case 'weekend':
                totalWeekend += entry.totalHours || 0;
                break;
            case 'bank_holiday':
                totalBankHoliday += entry.totalHours || 0;
                break;
            case 'night':
                totalNight += entry.totalHours || 0;
                break;
        }
        totalAmount += entry.amount || 0;
    });
    
    this.totalRegularHours = totalRegular;
    this.totalOvertimeHours = totalOvertime;
    this.totalWeekendHours = totalWeekend;
    this.totalBankHolidayHours = totalBankHoliday;
    this.totalNightHours = totalNight;
    this.totalAmount = totalAmount;
    
    next();
});

module.exports = mongoose.model('Timesheet', timesheetSchema);