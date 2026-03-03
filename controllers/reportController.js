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
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
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
                    providerId: toObjectId(providerId),
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
        
        // Get operator performance
        const operatorPerformance = await Interaction.aggregate([
            { 
                $match: { 
                    providerId: toObjectId(providerId),
                    ...(Object.keys(dateQuery).length ? { createdAt: dateQuery } : {})
                }
            },
            { 
                $group: {
                    _id: '$operatorId',
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
                    as: 'operator'
                }
            },
            { $unwind: '$operator' },
            { 
                $project: {
                    'operator.firstName': 1,
                    'operator.lastName': 1,
                    totalVisits: 1,
                    completedVisits: 1,
                    totalDuration: 1,
                    completionRate: { $multiply: [{ $divide: ['$completedVisits', '$totalVisits'] }, 100] }
                }
            },
            { $sort: { completedVisits: -1 } }
        ]);
        
        // Get client statistics
        const clientStats = await Interaction.aggregate([
            { 
                $match: { 
                    providerId: toObjectId(providerId),
                    ...(Object.keys(dateQuery).length ? { createdAt: dateQuery } : {})
                }
            },
            { 
                $group: {
                    _id: '$clientId',
                    visitCount: { $sum: 1 }
                }
            },
            { 
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'client'
                }
            },
            { $unwind: '$client' },
            { 
                $project: {
                    'client.firstName': 1,
                    'client.lastName': 1,
                    'client.clientInfo.nhsNumber': 1,
                    visitCount: 1
                }
            },
            { $sort: { visitCount: -1 } },
            { $limit: 10 }
        ]);
        
        res.render('provider/reports/index', {
            title: 'Reports',
            user: req.session.user,
            interactionStats,
            operatorPerformance,
            clientStats,
            period: period || 'month',
            startDate: startDate || '',
            endDate: endDate || '',
            moment: require('moment')
        });
    } catch (error) {
        console.error('Error loading reports:', error);
        req.flash('error', 'Error loading reports');
        res.redirect('/provider/dashboard');
    }
};

// Export report
exports.exportReport = async (req, res) => {
    try {
        const providerId = req.session.user.role === 'service_provider' 
            ? req.session.user._id 
            : req.session.user.providerId;
        
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
                data = await Interaction.find({ providerId, ...dateQuery })
                    .populate('clientId', 'firstName lastName')
                    .populate('operatorId', 'firstName lastName')
                    .sort('-createdAt');
                
                if (format === 'excel') {
                    workbook = new ExcelJS.Workbook();
                    worksheet = workbook.addWorksheet('Interactions');
                    
                    worksheet.columns = [
                        { header: 'Date', key: 'date', width: 20 },
                        { header: 'Client', key: 'client', width: 30 },
                        { header: 'Operator', key: 'operator', width: 30 },
                        { header: 'Type', key: 'type', width: 20 },
                        { header: 'Status', key: 'status', width: 15 },
                        { header: 'Duration', key: 'duration', width: 15 }
                    ];
                    
                    data.forEach(interaction => {
                        worksheet.addRow({
                            date: require('moment')(interaction.createdAt).format('YYYY-MM-DD HH:mm'),
                            client: `${interaction.clientId?.firstName} ${interaction.clientId?.lastName}`,
                            operator: `${interaction.operatorId?.firstName} ${interaction.operatorId?.lastName}`,
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
                
            case 'operators':
                data = await User.find({ role: 'operator', providerId })
                    .select('firstName lastName email operatorInfo')
                    .lean();
                
                if (format === 'excel') {
                    workbook = new ExcelJS.Workbook();
                    worksheet = workbook.addWorksheet('Operators');
                    
                    worksheet.columns = [
                        { header: 'Name', key: 'name', width: 30 },
                        { header: 'Email', key: 'email', width: 30 },
                        { header: 'Employee ID', key: 'employeeId', width: 20 },
                        { header: 'Status', key: 'status', width: 15 },
                        { header: 'Assigned Clients', key: 'clients', width: 15 }
                    ];
                    
                    for (const operator of data) {
                        const clientCount = await User.countDocuments({
                            'clientInfo.primaryCarer': operator._id
                        });
                        
                        worksheet.addRow({
                            name: `${operator.firstName} ${operator.lastName}`,
                            email: operator.email,
                            employeeId: operator.operatorInfo?.employeeId || 'N/A',
                            status: operator.operatorInfo?.employmentStatus || 'active',
                            clients: clientCount
                        });
                    }
                    
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                    res.setHeader('Content-Disposition', `attachment; filename=operators-${Date.now()}.xlsx`);
                    
                    await workbook.xlsx.write(res);
                    res.end();
                }
                break;
                
            default:
                req.flash('error', 'Invalid report type');
                res.redirect('/provider/reports');
        }
    } catch (error) {
        console.error('Error exporting report:', error);
        req.flash('error', 'Error exporting report');
        res.redirect('/provider/reports');
    }
};