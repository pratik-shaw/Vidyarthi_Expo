// routes/adminRoutes.js - ADD THESE NEW ROUTES

// ADD these imports at the top if not already present
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

// EXISTING routes (keep these)
router.get('/teachers', auth, adminController.getTeachers);
router.get('/students', auth, adminController.getStudents);

// NEW ROUTES - ADD THESE:
// Complete profile routes for individual teacher/student
router.get('/teachers/:teacherId/profile', auth, adminController.getTeacherProfile);
router.get('/students/:studentId/profile', auth, adminController.getStudentProfile);

// Enhanced list routes with complete data
router.get('/teachers/complete', auth, adminController.getTeachersComplete);
router.get('/students/complete', auth, adminController.getStudentsComplete);

// Classes routes (keep existing)
router.get('/classes', auth, adminController.getClasses);
router.post('/classes', auth, classController.createClass);
router.put('/classes/:id', auth, classController.updateClass);
router.delete('/classes/:id', auth, classController.deleteClass);
router.get('/classes/:classId', auth, classController.getClassDetails);

// Class management routes (keep existing)
router.post('/classes/assign-teacher', auth, classController.assignTeacher);
router.post('/classes/assign-teachers', auth, classController.assignTeachers);
router.post('/classes/remove-teacher', auth, classController.removeTeacher);
router.post('/classes/assign-students', auth, classController.assignStudents);
router.post('/classes/remove-student', auth, classController.removeStudent);
router.post('/classes/assign-class-admin', auth, classController.assignClassAdmin);

module.exports = router;