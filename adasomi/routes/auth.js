const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many attempts from this device. Please wait a few minutes and try again.'
});

function handleValidation(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('error', errors.array()[0].msg);
        return res.redirect('back');
    }
    next();
}

const loginValidation = [
    body('email').isEmail().withMessage('Enter a valid email address.'),
    body('password').notEmpty().withMessage('Password is required.')
];

const registerValidation = [
    body('firstName').trim().notEmpty().withMessage('First name is required.'),
    body('lastName').trim().notEmpty().withMessage('Last name is required.'),
    body('email').isEmail().withMessage('Enter a valid email address.'),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').isIn(['merchant', 'rider', 'public_user']).withMessage('Select a valid account type.')
];

const resendValidation = [
    body('email').isEmail().withMessage('Enter a valid email address.')
];

router.get('/login', authController.getLogin);
router.post('/login', authLimiter, loginValidation, handleValidation, authController.postLogin);

router.get('/register', authController.getRegister);
router.post('/register', authLimiter, registerValidation, handleValidation, authController.postRegister);

router.get('/logout', authController.logout);

router.get('/verify-notice', authController.getVerifyNotice);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authLimiter, resendValidation, handleValidation, authController.resendVerification);

module.exports = router;
