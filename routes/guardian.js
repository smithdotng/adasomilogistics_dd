const express = require('express');
const router = express.Router();
const { isAuthenticated, hasRole } = require('../controllers/authController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const moment = require('moment'); // Declare moment once at the top

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), 'uploads', 'guardian-interactions');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname).toLowerCase();
    const filename = 'guardian-' + uniqueSuffix + extension;
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|mp4|m4a|wav|mp3/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, documents, audio, and video files are allowed'));
    }
  }
});

// Middleware - only guardians can access these routes
router.use(isAuthenticated);
router.use(hasRole(['guardian']));

// Guardian Dashboard (Enhanced)
router.get('/dashboard', async (req, res) => {
  try {
    const user = req.session.user;
    const Client = require('../models/Client');
    const Interaction = require('../models/Interaction');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient && !accessibleClientIds.includes(user.assignedClient.toString())) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    // Get clients
    const clients = await Client.find({ 
      _id: { $in: accessibleClientIds },
      status: 'active'
    })
    .populate('assignedOperator', 'firstName lastName email phone')
    .select('firstName lastName referenceId status dateOfBirth guardians');
    
    if (!clients || clients.length === 0) {
      return res.render('guardian/dashboard', {
        title: 'Guardian Dashboard',
        user: req.session.user,
        stats: {
          totalClients: 0,
          todayInteractions: 0,
          totalInteractions: 0,
          pendingFollowUps: 0
        },
        recentInteractions: [],
        upcomingInteractions: [],
        clients: [],
        moment: moment
      });
    }
    
    // Get statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [
      totalInteractions,
      guardianInteractions,
      pendingFollowUps,
      todayInteractions
    ] = await Promise.all([
      Interaction.countDocuments({ client: { $in: accessibleClientIds } }),
      Interaction.countDocuments({ 
        client: { $in: accessibleClientIds },
        createdBy: user.id,
        createdByRole: 'guardian'
      }),
      Interaction.countDocuments({
        client: { $in: accessibleClientIds },
        requiresFollowUp: true,
        followUpCompleted: false
      }),
      Interaction.countDocuments({
        client: { $in: accessibleClientIds },
        startTime: { $gte: today, $lt: tomorrow }
      })
    ]);
    
    // Get recent interactions
    const recentInteractions = await Interaction.find({
      client: { $in: accessibleClientIds }
    })
    .populate('client', 'firstName lastName referenceId')
    .populate('createdBy', 'firstName lastName role')
    .populate('operator', 'firstName lastName')
    .sort({ startTime: -1 })
    .limit(10);
    
    // Get upcoming interactions (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const upcomingInteractions = await Interaction.find({
      client: { $in: accessibleClientIds },
      startTime: { 
        $gte: new Date(),
        $lte: nextWeek
      },
      status: { $in: ['scheduled', 'pending_approval'] }
    })
    .populate('client', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .sort({ startTime: 1 })
    .limit(5);
    
    // Get primary client
    const primaryClient = clients.find(client => {
      return client.guardians && client.guardians.some(guardian => 
        guardian.userAccount && 
        guardian.userAccount.toString() === user.id &&
        guardian.isPrimary
      );
    }) || clients[0];
    
    res.render('guardian/dashboard', {
      title: 'Guardian Dashboard',
      user: req.session.user,
      stats: {
        totalClients: clients.length,
        todayInteractions,
        totalInteractions,
        guardianInteractions,
        pendingFollowUps
      },
      recentInteractions,
      upcomingInteractions,
      clients,
      primaryClient,
      moment: moment
    });
    
  } catch (error) {
    console.error('Guardian dashboard error:', error);
    req.flash('error', 'Error loading dashboard: ' + error.message);
    res.redirect('/');
  }
});

// View Client Details
router.get('/client/:id?', async (req, res) => {
  try {
    const user = req.session.user;
    const clientId = req.params.id || user.assignedClient;
    const Client = require('../models/Client');
    
    // Check if guardian has access to this client
    if (!user.clientAccess.includes(clientId) && 
        user.assignedClient.toString() !== clientId) {
      req.flash('error', 'Access denied to this client');
      return res.redirect('/guardian/dashboard');
    }
    
    const client = await Client.findById(clientId)
      .populate('assignedOperator', 'firstName lastName email phone')
      .populate('createdBy', 'firstName lastName')
      .populate('guardians.userAccount', 'firstName lastName email phone');
    
    if (!client) {
      req.flash('error', 'Client not found');
      return res.redirect('/guardian/dashboard');
    }
    
    // Get guardian info for this client
    const guardianInfo = client.guardians.find(g => 
      g.userAccount && g.userAccount._id.toString() === user.id
    );
    
    // Get interaction statistics for this client
    const Interaction = require('../models/Interaction');
    const interactionStats = await Interaction.aggregate([
      {
        $match: {
          client: client._id,
          startTime: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.render('guardian/client-detail', {
      title: `${client.firstName} ${client.lastName} - Client Details`,
      client,
      guardianInfo,
      interactionStats,
      moment: moment
    });
    
  } catch (error) {
    console.error('View client error:', error);
    req.flash('error', 'Error loading client information');
    res.redirect('/guardian/dashboard');
  }
});

// Log Interaction - GET
router.get('/interactions/create', async (req, res) => {
  try {
    const user = req.session.user;
    const clientId = req.query.clientId || user.assignedClient;
    const Client = require('../models/Client');
    
    if (!clientId) {
      req.flash('error', 'No client specified');
      return res.redirect('/guardian/dashboard');
    }
    
    // Check access
    if (!user.clientAccess.includes(clientId) && 
        user.assignedClient.toString() !== clientId) {
      req.flash('error', 'Access denied to this client');
      return res.redirect('/guardian/dashboard');
    }
    
    const client = await Client.findById(clientId)
      .select('firstName lastName referenceId');
    
    if (!client) {
      req.flash('error', 'Client not found');
      return res.redirect('/guardian/dashboard');
    }
    
    res.render('guardian/log-interaction', {
      title: 'Log New Interaction',
      client,
      interactionTypes: [
        'phone_call', 'visit', 'video_call', 'email', 
        'family_meeting', 'guardian_update', 'care_coordination'
      ],
      guardianInteractionTypes: [
        'daily_update', 'concern_raised', 'decision_made', 
        'meeting_attended', 'document_reviewed', 'other'
      ],
      locations: [
        'client_home', 'phone', 'video_call', 'email', 'office', 'other'
      ],
      moodOptions: ['excellent', 'good', 'fair', 'poor', 'distressed', 'not_applicable'],
      satisfactionLevels: [
        'very_satisfied', 'satisfied', 'neutral', 
        'unsatisfied', 'very_unsatisfied', 'not_applicable'
      ],
      moment: moment
    });
    
  } catch (error) {
    console.error('Log interaction form error:', error);
    req.flash('error', 'Error loading form: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Log Interaction - POST
router.post('/interactions', upload.array('attachments', 5), async (req, res) => {
  try {
    const user = req.session.user;
    const Interaction = require('../models/Interaction');
    const Client = require('../models/Client');
    
    const {
      clientId,
      type,
      guardianInteractionType,
      title,
      description,
      startTime,
      endTime,
      duration,
      location,
      mood,
      behavior,
      physicalCondition,
      mentalState,
      clientWellbeing,
      concerns,
      suggestions,
      satisfactionLevel,
      followUpRequired,
      followUpActions,
      notes,
      visibility
    } = req.body;
    
    // Validate client access
    if (!user.clientAccess.includes(clientId) && 
        user.assignedClient.toString() !== clientId) {
      req.flash('error', 'Unauthorized to log interaction for this client');
      return res.redirect('/guardian/dashboard');
    }
    
    // Validate required fields
    if (!clientId || !type || !title || !description || !startTime) {
      req.flash('error', 'Please fill in all required fields');
      return res.redirect(`/guardian/interactions/create?clientId=${clientId}`);
    }
    
    // Parse dates
    const startTimeDate = new Date(startTime);
    let endTimeDate;
    
    if (endTime) {
      endTimeDate = new Date(endTime);
    } else if (duration) {
      endTimeDate = new Date(startTimeDate.getTime() + (parseInt(duration) * 60000));
    } else {
      endTimeDate = new Date(startTimeDate.getTime() + (30 * 60000)); // Default 30 minutes
    }
    
    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      req.flash('error', 'Client not found');
      return res.redirect('/guardian/dashboard');
    }
    
    // Prepare interaction data
    const interactionData = {
      client: clientId,
      createdBy: user.id,
      createdByRole: 'guardian',
      type,
      guardianInteractionType: guardianInteractionType || 'daily_update',
      title,
      description,
      startTime: startTimeDate,
      endTime: endTimeDate,
      location: location || 'phone',
      status: 'completed',
      notes
    };
    
    // Add observations if provided
    if (mood || behavior || physicalCondition || mentalState) {
      interactionData.observations = {
        mood: mood || 'not_applicable',
        behavior: behavior || '',
        physicalCondition: physicalCondition || '',
        mentalState: mentalState || ''
      };
    }
    
    // Add guardian observations
    if (clientWellbeing || concerns || suggestions || satisfactionLevel) {
      interactionData.guardianObservations = {
        clientWellbeing: clientWellbeing || '',
        concerns: concerns || '',
        suggestions: suggestions || '',
        satisfactionLevel: satisfactionLevel || 'not_applicable'
      };
    }
    
    // Handle follow-up actions
    if (followUpRequired === 'true' || followUpRequired === 'on') {
      interactionData.requiresFollowUp = true;
      
      if (followUpActions) {
        try {
          const actions = JSON.parse(followUpActions);
          if (Array.isArray(actions)) {
            interactionData.followUpActions = actions.map(action => ({
              ...action,
              completed: false
            }));
          }
        } catch (e) {
          console.error('Error parsing follow-up actions:', e);
        }
      }
    }
    
    // Handle visibility
    if (visibility) {
      interactionData.visibility = visibility;
    }
    
    // Handle attachments
    if (req.files && req.files.length > 0) {
      interactionData.attachments = req.files.map(file => ({
        name: file.originalname,
        fileType: path.extname(file.originalname).substring(1).toLowerCase(),
        url: `/uploads/guardian-interactions/${file.filename}`,
        uploadedAt: new Date(),
        uploadedBy: user.id
      }));
    }
    
    // Save interaction
    const interaction = new Interaction(interactionData);
    await interaction.save();
    
    // Update client's last interaction date
    await Client.findByIdAndUpdate(clientId, {
      $set: { lastInteraction: new Date() }
    });
    
    // Send notification to operator if needed
    if (interactionData.requiresFollowUp || 
        satisfactionLevel === 'unsatisfied' || 
        satisfactionLevel === 'very_unsatisfied') {
      try {
        const emailService = require('../utils/emailService');
        const operator = await require('../models/User').findById(client.assignedOperator);
        
        if (operator && operator.email) {
          await emailService.sendInteractionNotification(
            operator.email,
            operator.firstName,
            client.fullName,
            interaction.title,
            interaction.description,
            `${req.protocol}://${req.get('host')}/interactions/${interaction._id}`
          );
        }
      } catch (emailError) {
        console.warn('Could not send notification email:', emailError.message);
      }
    }
    
    req.flash('success', 'Interaction logged successfully');
    res.redirect('/guardian/interactions');
    
  } catch (error) {
    console.error('Log interaction error:', error);
    req.flash('error', 'Error logging interaction: ' + error.message);
    res.redirect('/guardian/interactions/create');
  }
});

// View All Interactions
router.get('/interactions', async (req, res) => {
  try {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const Interaction = require('../models/Interaction');
    const Client = require('../models/Client');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    // Build query for guardian-accessible interactions
    const query = {
      $or: [
        {
          client: { $in: accessibleClientIds },
          $or: [
            { visibility: { $in: ['all', 'guardians_only'] } },
            {
              visibility: 'specific_guardians',
              visibleToGuardians: user.id
            }
          ]
        }
      ]
    };
    
    // Apply filters
    if (req.query.clientId && accessibleClientIds.includes(req.query.clientId)) {
      query.client = req.query.clientId;
    }
    
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    if (req.query.guardianInteractionType) {
      query.guardianInteractionType = req.query.guardianInteractionType;
    }
    
    if (req.query.createdBy === 'me') {
      query.createdBy = user.id;
      query.createdByRole = 'guardian';
    }
    
    if (req.query.startDate) {
      query.startTime = { ...query.startTime, $gte: new Date(req.query.startDate) };
    }
    
    if (req.query.endDate) {
      query.startTime = { ...query.startTime, $lte: new Date(req.query.endDate) };
    }
    
    if (req.query.requiresFollowUp === 'true') {
      query.requiresFollowUp = true;
      query.followUpCompleted = false;
    }
    
    // Get interactions with pagination
    const interactions = await Interaction.find(query)
      .populate('client', 'firstName lastName referenceId')
      .populate('createdBy', 'firstName lastName role')
      .populate('operator', 'firstName lastName')
      .populate('guardianVerification.guardianId', 'firstName lastName')
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Interaction.countDocuments(query);
    
    // Get accessible clients for filter dropdown
    const clients = await Client.find({ _id: { $in: accessibleClientIds } })
      .select('firstName lastName referenceId');
    
    res.render('guardian/interactions', {
      title: 'Interactions',
      interactions,
      clients,
      moment: moment,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
      query: req.query,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('View interactions error:', error);
    req.flash('error', 'Error loading interactions: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// View Single Interaction
router.get('/interactions/:id', async (req, res) => {
  try {
    const user = req.session.user;
    const interactionId = req.params.id;
    
    const Interaction = require('../models/Interaction');
    
    const interaction = await Interaction.findById(interactionId)
      .populate('client', 'firstName lastName referenceId dateOfBirth')
      .populate('createdBy', 'firstName lastName role email phone')
      .populate('operator', 'firstName lastName email phone')
      .populate('guardianVerification.guardianId', 'firstName lastName')
      .populate('visibleToGuardians', 'firstName lastName email');
    
    if (!interaction) {
      req.flash('error', 'Interaction not found');
      return res.redirect('/guardian/interactions');
    }
    
    // Check if guardian can view this interaction
    const canView = interaction.canGuardianView(user.id);
    const hasAccess = user.clientAccess.includes(interaction.client._id.toString()) ||
                     user.assignedClient?.toString() === interaction.client._id.toString();
    
    if (!canView || !hasAccess) {
      req.flash('error', 'Access denied to this interaction');
      return res.redirect('/guardian/interactions');
    }
    
    res.render('guardian/interaction-detail', {
      title: 'Interaction Details',
      interaction,
      user: req.session.user,
      moment: moment
    });
    
  } catch (error) {
    console.error('View interaction error:', error);
    req.flash('error', 'Error loading interaction: ' + error.message);
    res.redirect('/guardian/interactions');
  }
});

// Verify Interaction (Guardian verification)
router.post('/interactions/:id/verify', async (req, res) => {
  try {
    const user = req.session.user;
    const interactionId = req.params.id;
    const { verificationNotes } = req.body;
    
    const Interaction = require('../models/Interaction');
    const interaction = await Interaction.findById(interactionId);
    
    if (!interaction) {
      req.flash('error', 'Interaction not found');
      return res.redirect('/guardian/interactions');
    }
    
    // Check if guardian has access to this client
    const hasAccess = user.clientAccess.includes(interaction.client.toString()) ||
                     user.assignedClient?.toString() === interaction.client.toString();
    
    if (!hasAccess) {
      req.flash('error', 'Access denied');
      return res.redirect('/guardian/interactions');
    }
    
    // Verify the interaction
    await interaction.verifyByGuardian(user.id, verificationNotes);
    
    req.flash('success', 'Interaction verified successfully');
    res.redirect(`/guardian/interactions/${interactionId}`);
    
  } catch (error) {
    console.error('Verify interaction error:', error);
    req.flash('error', 'Error verifying interaction: ' + error.message);
    res.redirect('/guardian/interactions');
  }
});

// Schedule View
router.get('/schedule', async (req, res) => {
  try {
    const user = req.session.user;
    const Interaction = require('../models/Interaction');
    const Client = require('../models/Client');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    const { month, year, view } = req.query;
    const currentDate = new Date();
    const currentMonth = month ? parseInt(month) : currentDate.getMonth() + 1;
    const currentYear = year ? parseInt(year) : currentDate.getFullYear();
    
    // Calculate date range
    let startDate, endDate;
    
    if (view === 'month') {
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0);
    } else {
      // Default to current week
      const today = new Date();
      const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
      startDate = new Date(firstDay.setHours(0, 0, 0, 0));
      endDate = new Date(firstDay.setDate(firstDay.getDate() + 6));
      endDate.setHours(23, 59, 59, 999);
    }
    
    // Get scheduled interactions
    const schedule = await Interaction.find({
      client: { $in: accessibleClientIds },
      startTime: { $gte: startDate, $lte: endDate },
      status: { $in: ['scheduled', 'pending_approval'] }
    })
    .populate('client', 'firstName lastName')
    .populate('createdBy', 'firstName lastName role')
    .populate('operator', 'firstName lastName')
    .sort({ startTime: 1 });
    
    // Get accessible clients
    const clients = await Client.find({ _id: { $in: accessibleClientIds } })
      .select('firstName lastName');
    
    // Group by date for calendar view
    const scheduleByDate = {};
    schedule.forEach(interaction => {
      const dateKey = moment(interaction.startTime).format('YYYY-MM-DD');
      if (!scheduleByDate[dateKey]) {
        scheduleByDate[dateKey] = [];
      }
      scheduleByDate[dateKey].push(interaction);
    });
    
    res.render('guardian/schedule', {
      title: 'Schedule',
      schedule,
      scheduleByDate,
      clients,
      moment: moment,
      currentMonth,
      currentYear,
      startDate,
      endDate,
      view: view || 'week',
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Schedule error:', error);
    req.flash('error', 'Error loading schedule: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// View Documents
router.get('/documents', async (req, res) => {
  try {
    const user = req.session.user;
    const Client = require('../models/Client');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    const clients = await Client.find({ _id: { $in: accessibleClientIds } })
      .select('firstName lastName referenceId documents');
    
    // Flatten documents with client info
    const allDocuments = [];
    clients.forEach(client => {
      if (client.documents && client.documents.length > 0) {
        client.documents.forEach(doc => {
          allDocuments.push({
            ...doc.toObject(),
            clientName: client.fullName,
            clientId: client._id
          });
        });
      }
    });
    
    // Group by document type
    const documentsByType = {};
    allDocuments.forEach(doc => {
      const type = doc.type || 'other';
      if (!documentsByType[type]) {
        documentsByType[type] = [];
      }
      documentsByType[type].push(doc);
    });
    
    res.render('guardian/documents', {
      title: 'Client Documents',
      documents: allDocuments,
      documentsByType,
      clients,
      moment: moment,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('View documents error:', error);
    req.flash('error', 'Error loading documents: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Download Document
router.get('/documents/download/:clientId/:filename', async (req, res) => {
  try {
    const user = req.session.user;
    const { clientId, filename } = req.params;
    
    // Check access
    if (!user.clientAccess.includes(clientId) && 
        user.assignedClient.toString() !== clientId) {
      req.flash('error', 'Access denied to this document');
      return res.redirect('/guardian/documents');
    }
    
    const filePath = path.join(process.cwd(), 'uploads', filename);
    
    if (!fs.existsSync(filePath)) {
      req.flash('error', 'Document not found');
      return res.redirect('/guardian/documents');
    }
    
    res.download(filePath);
    
  } catch (error) {
    console.error('Download document error:', error);
    req.flash('error', 'Error downloading document');
    res.redirect('/guardian/documents');
  }
});

// Guardian Profile
router.get('/profile', async (req, res) => {
  try {
    const user = req.session.user;
    const User = require('../models/User');
    const Client = require('../models/Client');
    
    // Get full user data
    const currentUser = await User.findById(user.id)
      .select('-password -passwordResetToken -passwordResetExpires');
    
    // Get client information
    let clients = [];
    if (user.assignedClient || user.clientAccess.length > 0) {
      const clientIds = [...user.clientAccess];
      if (user.assignedClient) {
        clientIds.push(user.assignedClient);
      }
      
      clients = await Client.find({ _id: { $in: clientIds } })
        .select('firstName lastName referenceId status dateOfBirth');
    }
    
    res.render('guardian/profile', {
      title: 'My Profile',
      user: currentUser,
      clients,
      moment: moment
    });
    
  } catch (error) {
    console.error('Profile error:', error);
    req.flash('error', 'Error loading profile: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Update Profile
router.post('/profile', async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;
    const User = require('../models/User');
    
    const updateData = {
      firstName,
      lastName,
      phone
    };
    
    // Parse address if provided
    if (address) {
      updateData.address = typeof address === 'string' 
        ? JSON.parse(address)
        : address;
    }
    
    // Update user
    await User.findByIdAndUpdate(req.session.user.id, updateData);
    
    // Update session
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;
    req.session.user.phone = phone;
    
    req.flash('success', 'Profile updated successfully');
    res.redirect('/guardian/profile');
    
  } catch (error) {
    console.error('Update profile error:', error);
    req.flash('error', 'Error updating profile: ' + error.message);
    res.redirect('/guardian/profile');
  }
});

// Change Password Page
router.get('/change-password', (req, res) => {
  res.render('guardian/change-password', {
    title: 'Change Password',
    user: req.session.user,
    moment: moment
  });
});

// Update Password
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = req.session.user;
    
    if (newPassword !== confirmPassword) {
      req.flash('error', 'New passwords do not match');
      return res.redirect('/guardian/change-password');
    }
    
    if (newPassword.length < 8) {
      req.flash('error', 'Password must be at least 8 characters long');
      return res.redirect('/guardian/change-password');
    }
    
    const User = require('../models/User');
    const currentUser = await User.findById(user.id);
    
    // Verify current password
    const isMatch = await currentUser.comparePassword(currentPassword);
    if (!isMatch) {
      req.flash('error', 'Current password is incorrect');
      return res.redirect('/guardian/change-password');
    }
    
    // Update password
    currentUser.password = newPassword;
    await currentUser.save();
    
    req.flash('success', 'Password updated successfully');
    res.redirect('/guardian/profile');
    
  } catch (error) {
    console.error('Change password error:', error);
    req.flash('error', 'Error changing password: ' + error.message);
    res.redirect('/guardian/change-password');
  }
});

// Guardian Notifications
router.get('/notifications', async (req, res) => {
  try {
    const user = req.session.user;
    const Interaction = require('../models/Interaction');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    // Get interactions requiring attention
    const pendingInteractions = await Interaction.find({
      client: { $in: accessibleClientIds },
      requiresFollowUp: true,
      followUpCompleted: false
    })
    .populate('client', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .sort({ startTime: -1 })
    .limit(20);
    
    // Get unverified interactions
    const unverifiedInteractions = await Interaction.find({
      client: { $in: accessibleClientIds },
      'guardianVerification.verified': false,
      createdByRole: 'operator'
    })
    .populate('client', 'firstName lastName')
    .populate('createdBy', 'firstName lastName')
    .sort({ startTime: -1 })
    .limit(20);
    
    res.render('guardian/notifications', {
      title: 'Notifications',
      pendingInteractions,
      unverifiedInteractions,
      moment: moment,
      user: req.session.user
    });
    
  } catch (error) {
    console.error('Notifications error:', error);
    req.flash('error', 'Error loading notifications: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Export Interactions (CSV)
router.get('/interactions/export', async (req, res) => {
  try {
    const user = req.session.user;
    const Interaction = require('../models/Interaction');
    
    // Get accessible client IDs
    const accessibleClientIds = user.clientAccess || [];
    if (user.assignedClient) {
      accessibleClientIds.push(user.assignedClient.toString());
    }
    
    // Build query
    const query = {
      client: { $in: accessibleClientIds },
      $or: [
        { visibility: { $in: ['all', 'guardians_only'] } },
        {
          visibility: 'specific_guardians',
          visibleToGuardians: user.id
        }
      ]
    };
    
    // Apply date filters
    if (req.query.startDate && req.query.endDate) {
      query.startTime = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    const interactions = await Interaction.find(query)
      .populate('client', 'firstName lastName referenceId')
      .populate('createdBy', 'firstName lastName role')
      .sort({ startTime: -1 });
    
    // Convert to CSV
    const csvData = interactions.map(interaction => ({
      Date: interaction.startTime.toISOString().split('T')[0],
      Time: interaction.startTime.toTimeString().split(' ')[0],
      'Client Name': `${interaction.client.firstName} ${interaction.client.lastName}`,
      'Client ID': interaction.client.referenceId,
      'Interaction Type': interaction.type,
      Title: interaction.title,
      Description: interaction.description.substring(0, 100) + '...',
      'Created By': `${interaction.createdBy.firstName} ${interaction.createdBy.lastName} (${interaction.createdBy.role})`,
      Location: interaction.location,
      Status: interaction.status,
      Duration: `${interaction.durationMinutes} minutes`
    }));
    
    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=interactions.csv');
    
    // Convert to CSV string
    const csvString = [
      Object.keys(csvData[0] || {}).join(','),
      ...csvData.map(row => Object.values(row).map(val => 
        `"${String(val || '').replace(/"/g, '""')}"`
      ).join(','))
    ].join('\n');
    
    res.send(csvString);
    
  } catch (error) {
    console.error('Export interactions error:', error);
    req.flash('error', 'Error exporting interactions: ' + error.message);
    res.redirect('/guardian/interactions');
  }
});

// Settings
router.get('/settings', async (req, res) => {
  try {
    const user = req.session.user;
    
    res.render('guardian/settings', {
      title: 'Settings',
      user: user,
      moment: moment
    });
    
  } catch (error) {
    console.error('Settings error:', error);
    req.flash('error', 'Error loading settings: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Help/Support
router.get('/help', async (req, res) => {
  try {
    const user = req.session.user;
    
    res.render('guardian/help', {
      title: 'Help & Support',
      user: user,
      moment: moment
    });
    
  } catch (error) {
    console.error('Help error:', error);
    req.flash('error', 'Error loading help page: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Feedback Form
router.get('/feedback', async (req, res) => {
  try {
    const user = req.session.user;
    
    res.render('guardian/feedback', {
      title: 'Provide Feedback',
      user: user,
      moment: moment
    });
    
  } catch (error) {
    console.error('Feedback error:', error);
    req.flash('error', 'Error loading feedback form: ' + error.message);
    res.redirect('/guardian/dashboard');
  }
});

// Submit Feedback
router.post('/feedback', async (req, res) => {
  try {
    const { feedbackType, message, rating } = req.body;
    const user = req.session.user;
    
    // Here you would typically save feedback to database
    // For now, just show success message
    req.flash('success', 'Thank you for your feedback!');
    res.redirect('/guardian/dashboard');
    
  } catch (error) {
    console.error('Submit feedback error:', error);
    req.flash('error', 'Error submitting feedback: ' + error.message);
    res.redirect('/guardian/feedback');
  }
});

module.exports = router;