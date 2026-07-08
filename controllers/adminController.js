const User = require('../models/User');
const ServiceUser = require('../models/ServiceUser');
const Interaction = require('../models/Interaction');
const moment = require('moment');

exports.getAdminDashboard = async (req, res) => {
    try {
        // Get statistics
        const totalServiceUsers = await ServiceUser.countDocuments();
        const activeServiceUsers = await ServiceUser.countDocuments({ status: 'active' });
        const totalOperators = await User.countDocuments({ role: 'support_worker', isActive: true });
        const totalInteractions = await Interaction.countDocuments();
        
        // Get recent activities
        const recentInteractions = await Interaction.find()
            .populate('service_user', 'firstName lastName')
            .populate('support_worker', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get support worker performance
        const supportWorkerStats = await Interaction.aggregate([
            {
                $group: {
                    _id: '$support worker',
                    totalInteractions: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'supportWorkerInfo'
                }
            },
            { $unwind: '$supportWorkerInfo' },
            { $sort: { totalInteractions: -1 } },
            { $limit: 5 }
        ]);
        
        // Get service user statistics by care level
        const serviceUserStats = await ServiceUser.aggregate([
            {
                $group: {
                    _id: '$careInfo.careLevel',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            stats: {
                totalServiceUsers,
                activeServiceUsers,
                totalOperators,
                totalInteractions
            },
            recentInteractions,
            supportWorkerStats,
            serviceUserStats,
            moment: require('moment')
        });
        
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.flash('error', 'Error loading admin dashboard');
        res.redirect('/admin/dashboard');
    }
};

exports.getOperators = async (req, res) => {
    try {
        const { status, search } = req.query;
        let query = { role: 'support_worker' };
        
        if (status && status !== 'all') {
            query.isActive = status === 'active';
        }
        
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        
        const supportWorkers = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });
        
        // Get assignment counts
        const assignmentCounts = await ServiceUser.aggregate([
            { $group: { _id: '$assignedSupportWorker', count: { $sum: 1 } } }
        ]);
        
        res.render('admin/support-workers', {
            title: 'Manage Support Workers',
            supportWorkers,
            assignmentCounts,
            moment
        });
        
    } catch (error) {
        console.error('Get support workers error:', error);
        req.flash('error', 'Error loading support workers');
        res.redirect('/admin/dashboard');
    }
};