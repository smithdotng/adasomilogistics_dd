const User = require('../models/User');
const Timesheet = require('../models/Timesheet');
const Payment = require('../models/Payment');
const Interaction = require('../models/Interaction');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Get payment dashboard
exports.getPaymentDashboard = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        
        // Get statistics
        const [totalOperators, pendingPayments, totalPaidThisMonth, upcomingPayments] = await Promise.all([
            User.countDocuments({ role: 'support_worker', careProviderId, isActive: true }),
            Payment.countDocuments({ careProviderId, status: 'pending' }),
            Payment.aggregate([
                { 
                    $match: { 
                        careProviderId: toObjectId(careProviderId),
                        status: 'paid',
                        paidAt: { 
                            $gte: new Date(new Date().setDate(1)), 
                            $lte: new Date() 
                        }
                    }
                },
                { $group: { _id: null, total: { $sum: '$netPay' } } }
            ]),
            Payment.countDocuments({ 
                careProviderId, 
                status: 'pending',
                paymentDate: { $gte: new Date() }
            })
        ]);
        
        // Get recent payments
        const recentPayments = await Payment.find({ careProviderId })
            .populate('supportWorkerId', 'firstName lastName')
            .sort('-createdAt')
            .limit(10);
        
        // Get support workers with payment info
        const supportWorkers = await User.find({ 
            role: 'support_worker', 
            careProviderId,
            isActive: true 
        }).select('firstName lastName email supportWorkerInfo.paymentInfo');
        
        // Get pending timesheets
        const pendingTimesheets = await Timesheet.find({ 
            careProviderId, 
            status: 'submitted' 
        })
        .populate('supportWorkerId', 'firstName lastName')
        .sort('-submittedAt')
        .limit(5);
        
        res.render('careProvider/payments/dashboard', {
            title: 'Payroll Dashboard',
            user: req.session.user,
            stats: {
                totalOperators,
                pendingPayments,
                totalPaidThisMonth: totalPaidThisMonth[0]?.total || 0,
                upcomingPayments
            },
            recentPayments,
            supportWorkers,
            pendingTimesheets,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading payment dashboard:', error);
        req.flash('error', 'Error loading payment dashboard');
        res.redirect('/care-provider/dashboard');
    }
};

// Get timesheet list
exports.getTimesheets = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { supportWorker, status, week } = req.query;
        
        let query = { careProviderId };
        
        if (supportWorker && supportWorker !== 'all') {
            query.supportWorkerId = supportWorker;
        }
        
        if (status && status !== 'all') {
            query.status = status;
        }
        
        if (week) {
            const date = new Date(week);
            const startOfWeek = new Date(date.setDate(date.getDate() - date.getDay()));
            const endOfWeek = new Date(date.setDate(date.getDate() - date.getDay() + 6));
            query.periodStart = { $gte: startOfWeek };
            query.periodEnd = { $lte: endOfWeek };
        }
        
        const timesheets = await Timesheet.find(query)
            .populate('supportWorkerId', 'firstName lastName supportWorkerInfo.paymentInfo')
            .populate('entries.serviceUserId', 'firstName lastName')
            .sort('-periodEnd');
        
        // Get support workers for filter
        const supportWorkers = await User.find({ 
            role: 'support_worker', 
            careProviderId,
            isActive: true 
        }).select('firstName lastName');
        
        res.render('careProvider/payments/timesheets', {
            title: 'Timesheets',
            user: req.session.user,
            timesheets,
            supportWorkers,
            filters: { supportWorker, status, week },
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading timesheets:', error);
        req.flash('error', 'Error loading timesheets');
        res.redirect('/care-provider/payments/dashboard');
    }
};

// Create timesheet from interactions
exports.createTimesheet = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { supportWorkerId, periodStart, periodEnd } = req.body;
        
        // Get all interactions for this support worker in the period
        const interactions = await Interaction.find({
            supportWorkerId,
            careProviderId,
            actualStart: { $gte: new Date(periodStart), $lte: new Date(periodEnd) },
            status: 'completed'
        }).populate('serviceUserId', 'firstName lastName');
        
        if (interactions.length === 0) {
            req.flash('error', 'No completed interactions found for this period');
            return res.redirect('/care-provider/payments/timesheets');
        }
        
        // Get support worker for rate info
        const supportWorker = await User.findById(supportWorkerId);
        const baseRate = supportWorker.supportWorkerInfo?.paymentInfo?.payRate || 12.50; // Default rate
        
        // Create timesheet entries from interactions
        const entries = interactions.map(interaction => {
            const hours = interaction.duration / 60;
            const date = interaction.actualStart;
            const isWeekend = [0, 6].includes(date.getDay());
            const rate = isWeekend ? 
                (supportWorker.supportWorkerInfo?.paymentInfo?.weekendRate || baseRate * 1.5) : 
                baseRate;
            
            return {
                date: interaction.actualStart,
                serviceUserId: interaction.serviceUserId?._id,
                clientName: interaction.serviceUserId ? 
                    `${interaction.serviceUserId.firstName} ${interaction.serviceUserId.lastName}` : 
                    'Unknown',
                shiftType: isWeekend ? 'weekend' : 'regular',
                startTime: interaction.actualStart,
                endTime: interaction.actualEnd,
                totalHours: hours,
                regularHours: isWeekend ? 0 : hours,
                weekendHours: isWeekend ? hours : 0,
                rate: rate,
                amount: hours * rate,
                status: 'pending'
            };
        });
        
        // Calculate totals
        const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
        const totalAmount = entries.reduce((sum, e) => sum + e.amount, 0);
        
        const timesheet = new Timesheet({
            supportWorkerId,
            careProviderId,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            weekNumber: moment(periodStart).week(),
            year: moment(periodStart).year(),
            entries,
            totalRegularHours: entries.reduce((sum, e) => sum + (e.regularHours || 0), 0),
            totalWeekendHours: entries.reduce((sum, e) => sum + (e.weekendHours || 0), 0),
            totalHours,
            totalAmount,
            status: 'draft',
            createdBy: req.session.user._id
        });
        
        await timesheet.save();
        
        req.flash('success', 'Timesheet created successfully');
        res.redirect(`/care-provider/payments/timesheets/${timesheet._id}`);
    } catch (error) {
        console.error('Error creating timesheet:', error);
        req.flash('error', 'Error creating timesheet');
        res.redirect('/care-provider/payments/timesheets');
    }
};

// View timesheet details
exports.getTimesheetDetails = async (req, res) => {
    try {
        const timesheet = await Timesheet.findById(req.params.id)
            .populate('supportWorkerId', 'firstName lastName email supportWorkerInfo.paymentInfo')
            .populate('entries.serviceUserId', 'firstName lastName')
            .populate('approvedBy', 'firstName lastName')
            .populate('createdBy', 'firstName lastName');
        
        if (!timesheet) {
            req.flash('error', 'Timesheet not found');
            return res.redirect('/care-provider/payments/timesheets');
        }
        
        res.render('careProvider/payments/timesheet-details', {
            title: 'Timesheet Details',
            user: req.session.user,
            timesheet,
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading timesheet:', error);
        req.flash('error', 'Error loading timesheet');
        res.redirect('/care-provider/payments/timesheets');
    }
};

// Approve timesheet
exports.approveTimesheet = async (req, res) => {
    try {
        const timesheet = await Timesheet.findById(req.params.id);
        
        if (!timesheet) {
            req.flash('error', 'Timesheet not found');
            return res.redirect('/care-provider/payments/timesheets');
        }
        
        timesheet.status = 'approved';
        timesheet.approvedAt = new Date();
        timesheet.approvedBy = req.session.user._id;
        
        await timesheet.save();
        
        req.flash('success', 'Timesheet approved successfully');
        res.redirect(`/care-provider/payments/timesheets/${timesheet._id}`);
    } catch (error) {
        console.error('Error approving timesheet:', error);
        req.flash('error', 'Error approving timesheet');
        res.redirect('/care-provider/payments/timesheets');
    }
};

// Generate payment from timesheets
exports.generatePayment = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { supportWorkerId, timesheetIds, paymentDate } = req.body;
        
        // Get all selected timesheets
        const timesheets = await Timesheet.find({
            _id: { $in: timesheetIds },
            supportWorkerId,
            careProviderId,
            status: 'approved'
        });
        
        if (timesheets.length === 0) {
            req.flash('error', 'No approved timesheets found');
            return res.redirect('/care-provider/payments/timesheets');
        }
        
        // Get support worker for payment info
        const supportWorker = await User.findById(supportWorkerId);
        const paymentInfo = supportWorker.supportWorkerInfo?.paymentInfo || {};
        
        // Calculate gross pay
        const grossPay = timesheets.reduce((sum, t) => sum + t.totalAmount, 0);
        
        // Calculate deductions (example UK tax calculations)
        const tax = calculateTax(grossPay);
        const nationalInsurance = calculateNI(grossPay);
        const pension = paymentInfo.pensionEnrolled ? 
            (grossPay * (paymentInfo.pensionContribution || 5) / 100) : 0;
        const studentLoan = paymentInfo.studentLoan ? 
            calculateStudentLoan(grossPay, paymentInfo.studentLoanPlan) : 0;
        
        const totalDeductions = tax + nationalInsurance + pension + studentLoan;
        const netPay = grossPay - totalDeductions;
        
        // Create payment
        const payment = new Payment({
            supportWorkerId,
            careProviderId,
            paymentDate: new Date(paymentDate),
            paymentPeriod: {
                start: timesheets[0].periodStart,
                end: timesheets[timesheets.length - 1].periodEnd
            },
            grossPay,
            regularPay: timesheets.reduce((sum, t) => sum + t.totalRegularHours * (paymentInfo.payRate || 12.50), 0),
            overtimePay: timesheets.reduce((sum, t) => sum + t.totalOvertimeHours * (paymentInfo.overtimeRate || 18.75), 0),
            weekendPay: timesheets.reduce((sum, t) => sum + t.totalWeekendHours * (paymentInfo.weekendRate || 18.75), 0),
            bankHolidayPay: timesheets.reduce((sum, t) => sum + t.totalBankHolidayHours * (paymentInfo.bankHolidayRate || 25), 0),
            nightPay: timesheets.reduce((sum, t) => sum + t.totalNightHours * (paymentInfo.nightRate || 15), 0),
            tax,
            nationalInsurance,
            pension,
            studentLoan,
            totalDeductions,
            netPay,
            paymentMethod: paymentInfo.paymentMethod || 'bank_transfer',
            bankDetails: {
                accountName: supportWorker.supportWorkerInfo?.payrollInfo?.bankAccount || '',
                accountNumber: supportWorker.supportWorkerInfo?.payrollInfo?.bankAccount || '',
                sortCode: supportWorker.supportWorkerInfo?.payrollInfo?.sortCode || ''
            },
            timesheets: timesheetIds,
            status: 'pending',
            createdBy: req.session.user._id
        });
        
        await payment.save();
        
        // Update timesheets status
        await Timesheet.updateMany(
            { _id: { $in: timesheetIds } },
            { status: 'paid' }
        );
        
        req.flash('success', 'Payment generated successfully');
        res.redirect(`/care-provider/payments/${payment._id}`);
    } catch (error) {
        console.error('Error generating payment:', error);
        req.flash('error', 'Error generating payment');
        res.redirect('/care-provider/payments/timesheets');
    }
};

// Helper functions for UK tax calculations
function calculateTax(grossPay) {
    // Basic UK tax calculation (simplified)
    const personalAllowance = 12570;
    const annualGross = grossPay * 52; // Assuming weekly pay
    
    if (annualGross <= personalAllowance) return 0;
    
    const taxable = annualGross - personalAllowance;
    if (taxable <= 37700) return (taxable * 0.2) / 52; // Basic rate 20%
    if (taxable <= 150000) return (37700 * 0.2 + (taxable - 37700) * 0.4) / 52; // Higher rate 40%
    return (37700 * 0.2 + (150000 - 37700) * 0.4 + (taxable - 150000) * 0.45) / 52; // Additional rate 45%
}

function calculateNI(grossPay) {
    // Simplified National Insurance calculation
    const weeklyThreshold = 242; // Primary threshold
    if (grossPay <= weeklyThreshold) return 0;
    return (grossPay - weeklyThreshold) * 0.12; // 12% above threshold
}

function calculateStudentLoan(grossPay, plan) {
    // Simplified student loan calculation
    const thresholds = {
        'plan1': 22015,
        'plan2': 27295,
        'plan4': 27660,
        'postgrad': 21000
    };
    
    const annualGross = grossPay * 52;
    const threshold = thresholds[plan] || 27295;
    
    if (annualGross <= threshold) return 0;
    
    const repaymentRate = plan === 'postgrad' ? 0.06 : 0.09;
    return ((annualGross - threshold) * repaymentRate) / 52;
}

// Export payment report
exports.exportPaymentReport = async (req, res) => {
    try {
        const careProviderId = req.session.user._id;
        const { startDate, endDate, format } = req.query;
        
        const payments = await Payment.find({
            careProviderId,
            paymentDate: {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            }
        })
        .populate('supportWorkerId', 'firstName lastName')
        .sort('-paymentDate');
        
        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Payments');
            
            worksheet.columns = [
                { header: 'Payment Date', key: 'date', width: 15 },
                { header: 'Payment No', key: 'number', width: 15 },
                { header: 'Support Worker', key: 'support_worker', width: 25 },
                { header: 'Gross Pay', key: 'gross', width: 15 },
                { header: 'Tax', key: 'tax', width: 15 },
                { header: 'NI', key: 'ni', width: 15 },
                { header: 'Pension', key: 'pension', width: 15 },
                { header: 'Net Pay', key: 'net', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];
            
            payments.forEach(payment => {
                worksheet.addRow({
                    date: moment(payment.paymentDate).format('DD/MM/YYYY'),
                    number: payment.paymentNumber,
                    supportWorker: `${payment.supportWorkerId?.firstName} ${payment.supportWorkerId?.lastName}`,
                    gross: payment.grossPay?.toFixed(2),
                    tax: payment.tax?.toFixed(2),
                    ni: payment.nationalInsurance?.toFixed(2),
                    pension: payment.pension?.toFixed(2),
                    net: payment.netPay?.toFixed(2),
                    status: payment.status
                });
            });
            
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=payments-${startDate}-to-${endDate}.xlsx`);
            
            await workbook.xlsx.write(res);
            res.end();
        }
    } catch (error) {
        console.error('Error exporting payment report:', error);
        req.flash('error', 'Error exporting report');
        res.redirect('/care-provider/payments/dashboard');
    }
};