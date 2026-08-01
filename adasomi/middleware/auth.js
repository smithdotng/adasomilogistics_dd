function requireAuth(req, res, next) {
    if (!req.session.user) {
        req.flash('error', 'Please log in to continue.');
        return res.redirect('/login');
    }
    next();
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session.user) {
            req.flash('error', 'Please log in to continue.');
            return res.redirect('/login');
        }
        if (!roles.includes(req.session.user.role)) {
            req.flash('error', 'You do not have access to that area.');
            return res.redirect('/');
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
