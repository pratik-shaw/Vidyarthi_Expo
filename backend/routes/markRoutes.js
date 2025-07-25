// routes/markRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const markController = require('../controllers/markController');

// All routes require authentication
router.use(auth);

// Get students and their marks for subjects taught by the teacher
router.get('/class/:classId/students', markController.getStudentsForScoring);

// Submit marks for a student's subject
router.post('/class/:classId/student/:studentId/exam/:examId/subject/:subjectId', 
  markController.submitMarks);

// Get detailed marks for a specific student (class admin)
router.get('/class/:classId/student/:studentId/details', 
  markController.getStudentDetailedMarks);

// Get class-wise marks summary (class admin only)
router.get('/class/:classId/summary', markController.getClassMarksSummary);

// Get subject-wise report for teacher
router.get('/class/:classId/subject-report', markController.getTeacherSubjectReport);

// Get student academic report
router.get('/student/academic-report', markController.getStudentAcademicReport);

router.get('/class/:classId/exam/:examId/subject/:subjectId/performance', auth, markController.getExamPerformanceDetails);

module.exports = router;