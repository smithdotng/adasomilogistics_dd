const User = require('../models/User');

exports.getLogin = (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('auth/login', { 
    title: 'Login',
    layout: false // Don't use any layout
  });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('=== LOGIN ATTEMPT DEBUG ===');
    console.log('Email:', email);
    console.log('Password length:', password ? password.length : 0);
    
    // Find user
    const user = await User.findOne({ email, isActive: true });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      console.log('DEBUG: User not found or inactive');
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    console.log('User details:', {
      id: user._id,
      role: user.role,
      email: user.email,
      assignedClient: user.assignedClient
    });
    
    // Check password
    console.log('Checking password...');
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', isMatch);
    
    if (!isMatch) {
      console.log('DEBUG: Password does not match');
      req.flash('error', 'Invalid credentials');
      return res.redirect('/login');
    }
    
    // Set session
    req.session.user = {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      fullName: user.fullName,
      assignedClient: user.assignedClient // Important for guardian routes
    };
    
    console.log('Session set:', req.session.user);
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    console.log('Redirecting based on role:', user.role);
    
    // Redirect based on role
    if (user.role === 'guardian') {
        res.redirect('/guardian/dashboard');
    } else if (user.role === 'admin') {
        res.redirect('/admin/dashboard');
    } else {
        res.redirect('/support-worker/dashboard');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error stack:', error.stack);
    req.flash('error', 'An error occurred during login');
    res.redirect('/login');
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/login');
  });
};

// Middleware to check authentication
exports.isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  req.flash('error', 'Please login to access this page');
  res.redirect('/login');
};

// Middleware to check role
exports.hasRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      req.flash('error', 'Please login to access this page');
      return res.redirect('/login');
    }
    
    if (roles.includes(req.session.user.role)) {
      return next();
    }
    
    req.flash('error', 'You do not have permission to access this page');
    res.redirect('/dashboard');
  };
};