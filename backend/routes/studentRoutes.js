// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const studentController = require('../controllers/studentController');

// Auth routes
router.post('/register', authController.registerStudent);
router.post('/login', authController.loginStudent);
router.get('/validate', auth, authController.validateToken);


// Protected routes
router.get('/profile', auth, studentController.getProfile);
router.get('/class', auth, studentController.getClass);

// Route for selecting/updating class
router.post('/select-class', auth, studentController.selectClass);

// Route for getting available classes by school code
router.get('/available-classes/:schoolCode', auth, studentController.getAvailableClasses);

module.exports = router;