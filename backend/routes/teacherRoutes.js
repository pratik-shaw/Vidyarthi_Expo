// routes/teacherRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const teacherController = require('../controllers/teacherController');
const studentController = require('../controllers/studentController');

// Auth routes
router.post('/register', authController.registerTeacher);
router.post('/login', authController.loginTeacher);
router.get('/validate-token', auth, authController.validateTeacherToken);

// Profile management routes
router.get('/profile', auth, teacherController.getProfile);
router.put('/profile', auth, teacherController.updateProfile);
router.put('/change-password', auth, teacherController.changePassword);

// Class management routes
router.get('/classes', auth, teacherController.getClasses);
router.get('/class/:classId/students', auth, teacherController.getStudentsByClass);

// Admin class routes (for teachers who are class admins)
router.get('/admin-class', auth, teacherController.getAdminClass);
router.get('/admin/class/:classId', auth, teacherController.getAdminClassById);

// Student routes
router.get('/student/:studentId/profile', auth, studentController.getStudentById);

module.exports = router;