const User = require('../models/User');
const Client = require('../models/Client');
const Interaction = require('../models/Interaction');
const moment = require('moment');

exports.getAdminDashboard = async (req, res) => {
    try {
        // Get statistics
        const totalClients = await Client.countDocuments();
        const activeClients = await Client.countDocuments({ status: 'active' });
        const totalOperators = await User.countDocuments({ role: 'operator', isActive: true });
        const totalInteractions = await Interaction.countDocuments();
        
        // Get recent activities
        const recentInteractions = await Interaction.find()
            .populate('client', 'firstName lastName')
            .populate('operator', 'firstName lastName')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Get operator performance
        const operatorStats = await Interaction.aggregate([
            {
                $group: {
                    _id: '$operator',
                    totalInteractions: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'operatorInfo'
                }
            },
            { $unwind: '$operatorInfo' },
            { $sort: { totalInteractions: -1 } },
            { $limit: 5 }
        ]);
        
        // Get client statistics by care level
        const clientStats = await Client.aggregate([
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
                totalClients,
                activeClients,
                totalOperators,
                totalInteractions
            },
            recentInteractions,
            operatorStats,
            clientStats,
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
        let query = { role: 'operator' };
        
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
        
        const operators = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });
        
        // Get assignment counts
        const assignmentCounts = await Client.aggregate([
            { $group: { _id: '$assignedOperator', count: { $sum: 1 } } }
        ]);
        
        res.render('admin/operators', {
            title: 'Manage Operators',
            operators,
            assignmentCounts,
            moment
        });
        
    } catch (error) {
        console.error('Get operators error:', error);
        req.flash('error', 'Error loading operators');
        res.redirect('/admin/dashboard');
    }
};