// routes/markRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const markController = require('../controllers/markController');

// All routes require authentication
router.use(auth);

// Get students and their marks for subjects taught by the teacher
router.get('/class/:classId/students', markController.getStudentsForScoring);

// Get complete academic data for class (all subjects) - for admin/academic sheets
router.get('/class/:classId/complete-academic', markController.getClassCompleteAcademicData);

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

// Get exam performance details
router.get('/class/:classId/exam/:examId/subject/:subjectId/performance', markController.getExamPerformanceDetails);

module.exports = router;