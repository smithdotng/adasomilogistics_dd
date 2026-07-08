const User = require('../models/User');
const Interaction = require('../models/Interaction');
const Schedule = require('../models/Schedule');
const mongoose = require('mongoose');
const { toObjectId } = require('../utils/dbHelpers');
const ExcelJS = require('exceljs');

// Get reports dashboard
// Get reports dashboard
exports.getReports = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const { period, startDate, endDate } = req.query;
        
        // Set date range
        let dateQuery = {};
        if (period === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateQuery = { $gte: today, $lt: tomorrow };
        } else if (period === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateQuery = { $gte: weekAgo };
        } else if (period === 'month') {
            const monthAgo = new Date();
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateQuery = { $gte: monthAgo };
        } else if (period === 'custom' && startDate && endDate) {
            dateQuery = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        // Get interaction statistics
        const interactionStats = await Interaction.aggregate([
            { 
                $match: { 
                    careProviderId: toObjectId(careProviderId),
                    ...(Object.keys(dateQuery).length ? { createdAt: dateQuery } : {})
                }
            },
            { 
                $group: {
                    _id: {
                        status: '$status',
                        type: '$type',
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    },
                    count: { $sum: 1 },
                    avgDuration: { $avg: '$duration' }
                }
            },
            { $sort: { '_id.date': -1 } }
        ]);
        
        // Get support worker performance
        const supportWorkerPerformance = await Interaction.aggregate([
            { 
                $match: { 
                    careProviderId: toObjectId(careProviderId),
                    ...(Object.keys(dateQuery).length ? { createdAt: dateQuery } : {})
                }
            },
            { 
                $group: {
                    _id: '$supportWorkerId',
                    totalVisits: { $sum: 1 },
                    completedVisits: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    totalDuration: { $sum: '$duration' }
                }
            },
            { 
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'support_worker'
                }
            },
            { $unwind: '$support worker' },
            { 
                $project: {
                    'support worker.firstName': 1,
                    'support worker.lastName': 1,
                    totalVisits: 1,
                    completedVisits: 1,
                    totalDuration: 1,
                    completionRate: { $multiply: [{ $divide: ['$completedVisits', '$totalVisits'] }, 100] }
                }
            },
            { $sort: { completedVisits: -1 } }
        ]);
        
        // Get service user statistics
        const serviceUserStats = await Interaction.aggregate([
            { 
                $match: { 
                    careProviderId: toObjectId(careProviderId),
                    ...(Object.keys(dateQuery).length ? { createdAt: dateQuery } : {})
                }
            },
            { 
                $group: {
                    _id: '$serviceUserId',
                    visitCount: { $sum: 1 }
                }
            },
            { 
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'service_user'
                }
            },
            { $unwind: '$service user' },
            { 
                $project: {
                    'service user.firstName': 1,
                    'service user.lastName': 1,
                    'service user.serviceUserInfo.nhsNumber': 1,
                    visitCount: 1
                }
            },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);
        
        res.render('careProvider/reports/index', {
            title: 'Reports',
            user: req.session.user,
            interactionStats,
            supportWorkerPerformance,
            serviceUserStats,
            period: period || 'month',
            startDate: startDate || '',
            endDate: endDate || '',
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        req.flash('error', 'Error loading reports');
        res.redirect('/care-provider/dashboard');
    }
};

// Export report
exports.exportReport = async (req, res) => {
    try {
        const careProviderId = req.session.user.role === 'care_provider' 
            ? req.session.user._id 
            : req.session.user.careProviderId;
        
        const { type, format, startDate, endDate } = req.query;
        
        const dateQuery = {};
        if (startDate && endDate) {
            dateQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        
        let data;
        let workbook;
        let worksheet;
        
        switch(type) {
            case 'interactions':
                data = await Interaction.find({ careProviderId, ...dateQuery })
                    .populate('serviceUserId', 'firstName lastName')
                    .populate('supportWorkerId', 'firstName lastName')
                    .sort('-createdAt');
                
                if (format === 'excel') {
                    workbook = new ExcelJS.Workbook();
                    worksheet = workbook.addWorksheet('Interactions');
                    
                    worksheet.columns = [
                        { header: 'Date', key: 'date', width: 20 },
                        { header: 'Service User', key: 'service_user', width: 30 },
                        { header: 'Support Worker', key: 'support_worker', width: 30 },
                        { header: 'Type', key: 'type', width: 20 },
                        { header: 'Status', key: 'status', width: 15 },
                        { header: 'Duration', key: 'duration', width: 15 }
                    ];
                    
                    data.forEach(interaction => {
                        worksheet.addRow({
                            date: require('moment')(interaction.createdAt).format('YYYY-MM-DD HH:mm'),
                            serviceUser: `${interaction.serviceUserId?.firstName} ${interaction.serviceUserId?.lastName}`,
                            supportWorker: `${interaction.supportWorkerId?.firstName} ${interaction.supportWorkerId?.lastName}`,
                            type: interaction.type,
                            status: interaction.status,
                            duration: interaction.duration
                        });
                    });
                    
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename=interactions-${Date.now()}.xlsx`);
                    
                    await workbook.xlsx.write(res);
                    res.end();
                }
                break;
                
            case 'support workers':
                data = await User.find({ role: 'support_worker', careProviderId })
                    .select('firstName lastName email supportWorkerInfo')
                    .lean();
                
                if (format === 'excel') {
                    workbook = new ExcelJS.Workbook();
                    worksheet = workbook.addWorksheet('Support Workers');
                    
                    worksheet.columns = [
                        { header: 'Name', key: 'name', width: 30 },
                        { header: 'Email', key: 'email', width: 30 },
                        { header: 'Employee ID', key: 'employeeId', width: 20 },
                        { header: 'Status', key: 'status', width: 15 },
                        { header: 'Assigned Service Users', key: 'service users', width: 15 }
                    ];
                    
                    for (const supportWorker of data) {
                        const clientCount = await User.countDocuments({
                            'serviceUserInfo.primarySupportWorker': supportWorker._id
                        });
                        
                        worksheet.addRow({
                            name: `${supportWorker.firstName} ${supportWorker.lastName}`,
                            email: supportWorker.email,
                            employeeId: supportWorker.supportWorkerInfo?.employeeId || 'N/A',
                            status: supportWorker.supportWorkerInfo?.employmentStatus || 'active',
                            serviceUsers: clientCount
                        });
                    }
                    
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename=support workers-${Date.now()}.xlsx`);
                    
                    await workbook.xlsx.write(res);
                    res.end();
                }
                break;
                
            default:
                req.flash('error', 'Invalid report type');
                res.redirect('/care-provider/reports');
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        req.flash('error', 'Error exporting report');
        res.redirect('/care-provider/reports');
    }
};