// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const classController = require('../controllers/classController');

// Auth routes
router.post('/register', authController.registerAdmin);
router.post('/login', authController.loginAdmin);

// Token validation route
router.get('/validate', auth, authController.validateAdminToken);

// Protected routes
router.get('/profile', auth, adminController.getProfile);
router.get('/school', auth, adminController.getSchool);
router.get('/teachers', auth, adminController.getTeachers);
router.get('/students', auth, adminController.getStudents);

// Classes routes
router.get('/classes', auth, adminController.getClasses);
router.post('/classes', auth, classController.createClass);
router.put('/classes/:id', auth, classController.updateClass); // Changed to use classController
router.delete('/classes/:id', auth, classController.deleteClass); // Changed to use classController

// Class management
router.post('/classes/assign-teacher', auth, classController.assignTeacher);

module.exports = router;