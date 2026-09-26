const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many password reset attempts, please try again later' },
});

const localOnly=(req,res,next)=>require('../config/authProvider').clerkEnabled()?res.status(410).json({success:false,message:'Use email verification to sign in.'}):next();
const clerkLimiter=rateLimit({windowMs:15*60*1000,max:30,message:{success:false,message:'Too many requests from this IP, please try again after 15 minutes'}});
router.post('/clerk/session',clerkLimiter,authController.clerkSession);
router.post('/signup', localOnly, authLimiter, authController.signup);
router.post('/login', localOnly, authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', localOnly, forgotPasswordLimiter, authController.forgotPassword);
router.post('/reset-password', localOnly, forgotPasswordLimiter, authController.resetPassword);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
