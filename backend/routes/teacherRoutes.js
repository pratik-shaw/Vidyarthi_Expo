// routes/teacherRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authController = require('../controllers/authController');
const teacherController = require('../controllers/teacherController');

// Auth routes
router.post('/register', authController.registerTeacher);
router.post('/login', authController.loginTeacher);
router.get('/validate-token', auth, authController.validateTeacherToken);

// Protected routes
router.get('/profile', auth, teacherController.getProfile);
router.get('/classes', auth, teacherController.getClasses);
router.get('/class/:classId/students', auth, teacherController.getStudentsByClass);

// Admin class routes (for teachers who are class admins)
router.get('/admin-class', auth, teacherController.getAdminClass);
router.get('/admin/class/:classId', auth, teacherController.getAdminClassById); // New route

module.exports = router;