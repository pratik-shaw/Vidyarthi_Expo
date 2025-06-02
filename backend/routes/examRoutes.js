// routes/examRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const examController = require('../controllers/examController');

// All routes require authentication
router.use(auth);

// Create a new exam for a class (class admin only)
router.post('/class/:classId', examController.createExam);

// Get all exams for a class (class admin only)
router.get('/class/:classId', examController.getExamsByClass);

// Get a specific exam (class admin only)
router.get('/class/:classId/exam/:examId', examController.getExamById);

// Update an exam (class admin only)
router.put('/class/:classId/exam/:examId', examController.updateExam);

// Delete an exam (class admin only)
router.delete('/class/:classId/exam/:examId', examController.deleteExam);

// Add subjects to an exam (class admin only)
router.post('/class/:classId/exam/:examId/subjects', examController.addSubjectsToExam);

// Remove a subject from an exam (class admin only)
router.delete('/class/:classId/exam/:examId/subject/:subjectId', examController.removeSubjectFromExam);

// Get exams assigned to the current teacher
router.get('/my-exams', examController.getExamsByTeacher);

module.exports = router;