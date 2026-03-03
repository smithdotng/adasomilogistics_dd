const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
    
    // Payment Details
    paymentNumber: {
        type: String,
        unique: true
    },
    paymentDate: {
        type: Date,
        required: true
    },
    paymentPeriod: {
        start: Date,
        end: Date
    },
    
    // Earnings
    grossPay: { type: Number, required: true },
    regularPay: Number,
    overtimePay: Number,
    weekendPay: Number,
    bankHolidayPay: Number,
    nightPay: Number,
    holidayPay: Number,
    sickPay: Number,
    bonus: Number,
    
    // Deductions
    tax: Number,
    nationalInsurance: Number,
    pension: Number,
    studentLoan: Number,
    otherDeductions: [{
        description: String,
        amount: Number
    }],
    totalDeductions: { type: Number, default: 0 },
    
    // Net Pay
    netPay: { type: Number, required: true },
    
    // Payment Method
    paymentMethod: {
        type: String,
        enum: ['bank_transfer', 'cheque', 'cash'],
        default: 'bank_transfer'
    },
    bankDetails: {
        accountName: String,
        accountNumber: String,
        sortCode: String,
        reference: String
    },
    
    // Timesheets included
    timesheets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timesheet'
    }],
    
    // Payslip
    payslipUrl: String,
    
    // Status
    status: {
        type: String,
        enum: ['pending', 'processed', 'paid', 'cancelled'],
        default: 'pending'
    },
    processedAt: Date,
    paidAt: Date,
    
    // Notes
    notes: String,
    
    // Metadata
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Generate payment number before saving
paymentSchema.pre('save', async function(next) {
    if (!this.paymentNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = await mongoose.model('Payment').countDocuments() + 1;
        this.paymentNumber = `PAY-${year}${month}-${count.toString().padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);