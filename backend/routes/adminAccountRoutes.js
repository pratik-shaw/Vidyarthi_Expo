
// routes/adminAccountRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminStudentController = require('../controllers/adminStudentController');

// Student creation routes
router.post('/create-student', auth, adminStudentController.createStudentManual);
router.post('/bulk-create-students', auth, adminStudentController.createStudentsBulk);

// Teacher creation routes
router.post('/create-teacher', auth, adminStudentController.createTeacherManual);
router.post('/bulk-create-teachers', auth, adminStudentController.createTeachersBulk);

module.exports = router;