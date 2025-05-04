// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');

// Auth routes
router.post('/register', authController.registerStudent);
router.post('/login', authController.loginStudent);

// Protected routes
router.get('/profile', auth, studentController.getProfile);
router.get('/class', auth, studentController.getClass);

module.exports = router;