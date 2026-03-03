const Client = require('../models/Client');
const Interaction = require('../models/Interaction');
const User = require('../models/User');
const moment = require('moment');

exports.getDashboard = async (req, res) => {
  try {
    const operatorId = req.session.user.id;
    
    // Get statistics
    const activeClients = await Client.countDocuments({ 
      assignedOperator: operatorId, 
      status: 'active' 
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayInteractions = await Interaction.countDocuments({
      operator: operatorId,
      startTime: { $gte: today, $lt: tomorrow }
    });
    
    const pendingTasks = await Interaction.countDocuments({
      operator: operatorId,
      status: { $in: ['draft', 'needs_review'] }
    });
    
    // Get recent interactions
    const recentInteractions = await Interaction.find({
      operator: operatorId
    })
    .populate('client', 'firstName lastName referenceId')
    .sort({ createdAt: -1 })
    .limit(5);
    
    // Get upcoming schedule (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingSchedule = await Interaction.find({
      operator: operatorId,
      startTime: { $gte: today, $lte: nextWeek },
      status: { $ne: 'cancelled' }
    })
    .populate('client', 'firstName lastName')
    .sort({ startTime: 1 })
    .limit(10);
    
    res.render('operator/dashboard', {
      title: 'Operator Dashboard',
      stats: {
        activeClients,
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
    res.redirect('/operator/dashboard');
  }
};

exports.getMyClients = async (req, res) => {
  try {
    const operatorId = req.session.user.id;
    const { status, search } = req.query;
    
    let query = { assignedOperator: operatorId };
    
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
    
    const clients = await Client.find(query)
      .sort({ lastName: 1 })
      .select('firstName lastName referenceId status careInfo.careLevel dateOfBirth');
    
    res.render('operator/clients', {
      title: 'My Clients',
      clients,
      moment
    });
    
  } catch (error) {
    console.error('Get clients error:', error);
    req.flash('error', 'Error loading clients');
    res.redirect('/operator/dashboard');
  }
};

exports.getClientDetail = async (req, res) => {
  try {
    const operatorId = req.session.user.id;
    const clientId = req.params.id;
    
    const client = await Client.findOne({
      _id: clientId,
      assignedOperator: operatorId
    }).populate('assignedOperator', 'firstName lastName email');
    
    if (!client) {
      req.flash('error', 'Client not found or not assigned to you');
      return res.redirect('/operator/clients');
    }
    
    // Get recent interactions
    const recentInteractions = await Interaction.find({
      client: clientId,
      operator: operatorId
    })
    .sort({ startTime: -1 })
    .limit(10);
    
    // Get upcoming interactions
    const upcomingInteractions = await Interaction.find({
      client: clientId,
      operator: operatorId,
      startTime: { $gte: new Date() },
      status: { $ne: 'cancelled' }
    })
    .sort({ startTime: 1 })
    .limit(5);
    
    res.render('operator/client-detail', {
      title: `Client: ${client.fullName}`,
      client,
      recentInteractions,
      upcomingInteractions,
      moment
    });
    
  } catch (error) {
    console.error('Client detail error:', error);
    req.flash('error', 'Error loading client details');
    res.redirect('/operator/clients');
  }
};