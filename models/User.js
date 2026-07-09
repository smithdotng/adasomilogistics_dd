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
        enum: ['super_admin', 'care_provider', 'support_worker', 'service_user', 'guardian', 'family_member'],
        required: true
    },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    profileImage: String,
    phone: String,

    address: {
        street: String,
        city: String,
        county: String,
        postcode: String,
        country: { type: String, default: 'UK' }
    },

    careProviderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function() {
            return this.role !== 'super_admin' && this.role !== 'care_provider';
        }
    },

    // ────────────────────────────────────────────────
    // Service Care Provider specific
    // ────────────────────────────────────────────────
    careProviderInfo: {
        companyName: String,
        companyRegNumber: String,
        cqcLocationId: String,
        cqcRating: {
            type: String,
            enum: ['outstanding', 'good', 'requires-improvement', 'inadequate']
        },
        insuranceDetails: {
            careProvider: String,
            policyNumber: String,
            expiryDate: Date
        },
        logo: String,
        website: String,
        serviceTypes: [String],
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
            maxSupportWorkers: { type: Number, default: 5 },
            maxServiceUsers: { type: Number, default: 20 },
            features: [String]
        },
        bankDetails: {
            accountName: String,
            accountNumber: String,
            sortCode: String,
            vatNumber: String
        },
        icoNumber: String
    },

    // ────────────────────────────────────────────────
    // Support Worker (Carer) specific
    // ────────────────────────────────────────────────
    supportWorkerInfo: {
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
            careProvider: String,
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
        assignedServiceUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        maxServiceUsers: { type: Number, default: 5 },
        hourlyRate: Number,
        travelRadius: Number,
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
        paymentInfo: {
            payRate: Number,
            overtimeRate: Number,
            weekendRate: Number,
            bankHolidayRate: Number,
            nightRate: Number,
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
            niNumber: String,
            pensionEnrolled: { type: Boolean, default: false },
            pensionContribution: Number,
            studentLoan: { type: Boolean, default: false },
            studentLoanPlan: { type: String, enum: ['plan1', 'plan2', 'plan4', 'postgrad'] },
            attachments: [{
                name: String,
                url: String,
                uploadedAt: Date
            }]
        },
        payrollInfo: {
            payRate: Number,
            taxCode: String,
            niNumber: String,
            bankAccount: String,
            sortCode: String
        },
        timesheets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Timesheet' }],
        payments:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }]
    },

    // ────────────────────────────────────────────────
    // Service User (Patient) specific
    // ────────────────────────────────────────────────
    serviceUserInfo: {
        nhsNumber: String,
        dateOfBirth: Date,
        gender: String,
        maritalStatus: String,
        careHomeResident: { type: Boolean, default: false },
        roomNumber: String,
        primaryLanguage: { type: String, default: 'English' },
        communicationNeeds: String,

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

        primarySupportWorker: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        secondarySupportWorkers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        carePlan: { type: mongoose.Schema.Types.ObjectId, ref: 'CarePlan' },

        emergencyContacts: [{
            name: { type: String, required: true },
            relationship: String,
            phone: String,
            email: String,
            isPrimary: { type: Boolean, default: false }
        }],

        guardians: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        familyMembers: [{
            name: String,
            relationship: String,
            phone: String,
            email: String,
            canAccessPortal: { type: Boolean, default: false }
        }],

        carePackage: {
            type: {
                type: String,
                enum: ['domiciliary', 'residential', 'nursing', 'supported_living']
            },
            fundedBy: {
                type: String,
                enum: ['local_authority', 'ccg', 'self_funded', 'mixed']
            },
            fundingAuthority: String,
            weeklyHours: Number,
            startDate: Date,
            reviewDate: Date
        },

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

    // ────────────────────────────────────────────────
    // Guardian / Family specific
    // ────────────────────────────────────────────────
    guardianInfo: {
        relationship: String,
        phone: String,
        alternateEmail: String,
        address: String,
        isEmergencyContact: { type: Boolean, default: false },
        hasPOA: { type: Boolean, default: false },
        poaType: { type: String, enum: ['health', 'finance', 'both'] },
        serviceUsersMonitored: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        notificationPreferences: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            dailyReports: { type: Boolean, default: true },
            incidentAlerts: { type: Boolean, default: true }
        }
    },

    // ────────────────────────────────────────────────
    // Common fields
    // ────────────────────────────────────────────────
    isActive:           { type: Boolean, default: true },
    emailVerified:      { type: Boolean, default: false },
    emailVerificationToken: String,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
    lastLoginIp: String,
    loginAttempts:      { type: Number, default: 0 },
    lockUntil: Date,
    twoFactorEnabled:   { type: Boolean, default: false },
    twoFactorSecret: String,

    notificationSettings: {
        email: { type: Boolean, default: true },
        sms:   { type: Boolean, default: false },
        push:  { type: Boolean, default: true }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true   // automatically handles createdAt/updatedAt if you want mongoose to manage them
});

// ────────────────────────────────────────────────
// Indexes
// ────────────────────────────────────────────────
userSchema.index({ role: 1 });
userSchema.index({ careProviderId: 1 });
userSchema.index({ 'serviceUserInfo.nhsNumber': 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ careProviderId: 1, role: 1 });
userSchema.index({ email: 1 }); // already unique, but explicit index helps

// ────────────────────────────────────────────────
// Pre-save hook – modern async/await style
// ────────────────────────────────────────────────
userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        // updatedAt is already handled by timestamps: true or manually if preferred
    } catch (err) {
        throw err; // Mongoose will catch and pass to error handler
    }
});

// ────────────────────────────────────────────────
// Methods
// ────────────────────────────────────────────────
userSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

userSchema.methods.incLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        this.loginAttempts = 1;
        this.lockUntil = undefined;
    } else {
        this.loginAttempts = (this.loginAttempts || 0) + 1;
        if (this.loginAttempts >= 5) {
            this.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
        }
    }
    await this.save({ validateModifiedOnly: true });
};

// ────────────────────────────────────────────────
// Virtuals
// ────────────────────────────────────────────────
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
    if (this.role !== 'service_user' || !this.serviceUserInfo?.dateOfBirth) return null;
    const today = new Date();
    const birth = new Date(this.serviceUserInfo.dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
});

userSchema.set('toJSON',   { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);