const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'service_provider', 'operator', 'client', 'guardian', 'family_member'],
        required: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    profileImage: String,
    phone: String,
    address: {
        street: String,
        city: String,
        county: String,
        postcode: String,
        country: { type: String, default: 'UK' }
    },
    
    // Multi-tenant relationship - Every user belongs to a provider
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.role !== 'super_admin' && this.role !== 'service_provider';
        }
    },
    
    // Service Provider specific fields
    providerInfo: {
        companyName: String,
        companyRegNumber: String,
        cqcLocationId: String, // Care Quality Commission ID
        cqcRating: {
            type: String,
            enum: ['outstanding', 'good', 'requires-improvement', 'inadequate']
        },
        insuranceDetails: {
            provider: String,
            policyNumber: String,
            expiryDate: Date
        },
        logo: String,
        website: String,
        subscription: {
            plan: { 
                type: String, 
                enum: ['basic', 'professional', 'enterprise', 'trial'],
                default: 'trial'
            },
            status: {
                type: String,
                enum: ['active', 'expired', 'cancelled', 'trial'],
                default: 'trial'
            },
            startDate: { type: Date, default: Date.now },
            expiryDate: Date,
            maxOperators: { type: Number, default: 5 },
            maxClients: { type: Number, default: 20 },
            features: [String]
        },
        bankDetails: {
            accountName: String,
            accountNumber: String,
            sortCode: String,
            vatNumber: String
        }
    },
    
    // Operator (Carer) specific fields
    operatorInfo: {
        employeeId: { type: String, unique: true, sparse: true },
        dateOfBirth: Date,
        nationalInsurance: String,
        dbsChecked: { type: Boolean, default: false },
        dbsDate: Date,
        dbsCertificate: String,
        dbsUpdateNumber: String,
        qualifications: [{
            name: String,
            issuingBody: String,
            dateObtained: Date,
            expiryDate: Date,
            documentUrl: String,
            verified: { type: Boolean, default: false }
        }],
        trainingCompleted: [{
            course: String,
            provider: String,
            completedDate: Date,
            expiryDate: Date,
            certificateUrl: String,
            reminderSent: { type: Boolean, default: false }
        }],
        skills: [{
            name: String,
            level: { type: String, enum: ['basic', 'intermediate', 'advanced'] }
        }],
        availability: [{
            day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
            startTime: String,
            endTime: String,
            recurring: { type: Boolean, default: true }
        }],
        assignedClients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        maxClients: { type: Number, default: 5 },
        hourlyRate: Number,
        travelRadius: Number, // in miles
        hasVehicle: { type: Boolean, default: false },
        emergencyContact: {
            name: String,
            relationship: String,
            phone: String,
            email: String
        },
        employmentStartDate: Date,
        employmentEndDate: Date,
        employmentStatus: {
            type: String,
            enum: ['active', 'probation', 'suspended', 'terminated', 'on_leave'],
            default: 'probation'
        },
        contractType: {
            type: String,
            enum: ['permanent', 'temporary', 'zero_hours', 'agency'],
            default: 'permanent'
        },
        payrollInfo: {
            payRate: Number,
            taxCode: String,
            niNumber: String,
            bankAccount: String,
            sortCode: String
        },

         // Payment & Rate Information
    paymentInfo: {
        payRate: Number, // hourly rate
        overtimeRate: Number, // rate for overtime (usually 1.5x or 2x)
        weekendRate: Number, // enhanced rate for weekends
        bankHolidayRate: Number, // enhanced rate for bank holidays
        payFrequency: {
            type: String,
            enum: ['weekly', 'bi-weekly', 'monthly'],
            default: 'weekly'
        },
        paymentMethod: {
            type: String,
            enum: ['bank_transfer', 'cheque', 'cash'],
            default: 'bank_transfer'
        },
        taxCode: String,
        niNumber: String, // National Insurance number
        pensionEnrolled: { type: Boolean, default: false },
        pensionContribution: Number, // percentage
        studentLoan: { type: Boolean, default: false },
        studentLoanPlan: { type: String, enum: ['plan1', 'plan2', 'plan4', 'postgrad'] },
        attachments: [{
            name: String,
            url: String,
            uploadedAt: Date
        }]
    },
    
    // Timesheet Tracking
    timesheets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Timesheet'
    }],
    
    // Payment History
    payments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    }]
        
    },
    
    // Client (Patient) specific fields
    clientInfo: {
        nhsNumber: String,
        dateOfBirth: Date,
        gender: String,
        maritalStatus: String,
        careHomeResident: { type: Boolean, default: false },
        roomNumber: String,
        primaryLanguage: { type: String, default: 'English' },
        communicationNeeds: String,
        
        // Medical Information
        gpDetails: {
            name: String,
            surgery: String,
            address: String,
            phone: String,
            email: String
        },
        medicalConditions: [{
            name: String,
            diagnosedDate: Date,
            severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
            notes: String
        }],
        allergies: [{
            allergen: String,
            reaction: String,
            severity: { type: String, enum: ['mild', 'moderate', 'severe', 'anaphylactic'] }
        }],
        medications: [{
            name: String,
            dosage: String,
            frequency: String,
            route: String,
            prescribedBy: String,
            prescribedDate: Date,
            startDate: Date,
            endDate: Date,
            reason: String,
            sideEffects: String,
            pharmacy: {
                name: String,
                phone: String,
                address: String
            }
        }],
        
        // Care Team
        primaryCarer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        secondaryCarers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        carePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlan' },
        
        // Emergency Contacts
        emergencyContacts: [{
            name: String,
            relationship: String,
            phone: String,
            email: String,
            isPrimary: { type: Boolean, default: false }
        }],
        
        // Guardians/Family
        guardians: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        familyMembers: [{
            name: String,
            relationship: String,
            phone: String,
            email: String,
            canAccessPortal: { type: Boolean, default: false }
        }],
        
        // Care Package
        carePackage: {
            type: { type: String, enum: ['domiciliary', 'residential', 'nursing', 'supported_living'] },
            fundedBy: { type: String, enum: ['local_authority', 'ccg', 'self_funded', 'mixed'] },
            fundingAuthority: String,
            weeklyHours: Number,
            startDate: Date,
            reviewDate: Date
        },
        
        // Risk Assessments
        riskAssessments: [{
            type: String,
            date: Date,
            assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            score: String,
            findings: String,
            actions: String,
            nextReviewDate: Date
        }]
    },
    
    // Guardian/Family specific fields
    guardianInfo: {
        relationship: String,
        phone: String,
        alternateEmail: String,
        address: String,
        isEmergencyContact: { type: Boolean, default: false },
        hasPOA: { type: Boolean, default: false }, // Power of Attorney
        poaType: { type: String, enum: ['health', 'finance', 'both'] },
        clientsMonitored: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        notificationPreferences: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            dailyReports: { type: Boolean, default: true },
            incidentAlerts: { type: Boolean, default: true }
        }
    },
    
    // Common fields
    isActive: { type: Boolean, default: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    lastLoginIp: String,
    loginAttempts: { type: Number, default: 0 },
    lockUntil: Date,
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    notificationSettings: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ providerId: 1 });
userSchema.index({ 'operatorInfo.employeeId': 1 });
userSchema.index({ 'clientInfo.nhsNumber': 1 });

// Password hashing middleware
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    this.updatedAt = Date.now();
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    const updates = { $inc: { loginAttempts: 1 } };
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // Lock for 2 hours
    }
    return this.updateOne(updates);
};

module.exports = mongoose.model('User', userSchema);