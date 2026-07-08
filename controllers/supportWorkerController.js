const ServiceUser = require('../models/ServiceUser');
const Interaction = require('../models/Interaction');
const User = require('../models/User');
const moment = require('moment');

exports.getDashboard = async (req, res) => {
  try {
    const supportWorkerId = req.session.user.id;
    
    // Get statistics
    const activeServiceUsers = await ServiceUser.countDocuments({ 
      assignedSupportWorker: supportWorkerId, 
      status: 'active' 
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayInteractions = await Interaction.countDocuments({
      supportWorker: supportWorkerId,
      startTime: { $gte: today, $lt: tomorrow }
    });
    
    const pendingTasks = await Interaction.countDocuments({
      supportWorker: supportWorkerId,
      status: { $in: ['draft', 'needs_review'] }
    });
    
    // Get recent interactions
    const recentInteractions = await Interaction.find({
      supportWorker: supportWorkerId
    })
    .populate('service_user', 'firstName lastName referenceId')
    .sort({ createdAt: -1 })
    .limit(5);
    
    // Get upcoming schedule (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingSchedule = await Interaction.find({
      supportWorker: supportWorkerId,
      startTime: { $gte: today, $lte: nextWeek },
      status: { $ne: 'cancelled' }
    })
    .populate('service_user', 'firstName lastName')
    .sort({ startTime: 1 })
    .limit(10);
    
    res.render('supportWorker/dashboard', {
      title: 'Support Worker Dashboard',
      stats: {
        activeServiceUsers,
        todayInteractions,
        pendingTasks
      },
      recentInteractions,
      upcomingSchedule,
      moment
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    req.flash('error', 'Error loading dashboard');
    res.redirect('/support-worker/dashboard');
  }
};

exports.getMyClients = async (req, res) => {
  try {
    const supportWorkerId = req.session.user.id;
    const { status, search } = req.query;
    
    let query = { assignedSupportWorker: supportWorkerId };
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { referenceId: { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } }
      ];
    }
    
    const serviceUsers = await ServiceUser.find(query)
      .sort({ lastName: 1 })
      .select('firstName lastName referenceId status careInfo.careLevel dateOfBirth');
    
    res.render('supportWorker/service-users', {
      title: 'My Service Users',
      serviceUsers,
      moment
    });
    
  } catch (error) {
    console.error('Get service users error:', error);
    req.flash('error', 'Error loading service users');
    res.redirect('/support-worker/dashboard');
  }
};

exports.getClientDetail = async (req, res) => {
  try {
    const supportWorkerId = req.session.user.id;
    const serviceUserId = req.params.id;
    
    const serviceUser = await ServiceUser.findOne({
      _id: serviceUserId,
      assignedSupportWorker: supportWorkerId
    }).populate('assignedSupportWorker', 'firstName lastName email');
    
    if (!serviceUser) {
      req.flash('error', 'Service User not found or not assigned to you');
      return res.redirect('/support-worker/service-users');
    }
    
    // Get recent interactions
    const recentInteractions = await Interaction.find({
      serviceUser: serviceUserId,
      supportWorker: supportWorkerId
    })
    .sort({ startTime: -1 })
    .limit(10);
    
    // Get upcoming interactions
    const upcomingInteractions = await Interaction.find({
      serviceUser: serviceUserId,
      supportWorker: supportWorkerId,
      startTime: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
    .sort({ startTime: 1 })
    .limit(5);
    
    res.render('supportWorker/service-user-detail', {
      title: `Service User: ${serviceUser.fullName}`,
      serviceUser,
      recentInteractions,
      upcomingInteractions,
      moment
    });
    
  } catch (error) {
    console.error('Service User detail error:', error);
    req.flash('error', 'Error loading service user details');
    res.redirect('/support-worker/service-users');
  }
};