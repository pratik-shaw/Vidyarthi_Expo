// routes/subjectRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const subjectController = require('../controllers/subjectController');

// All routes require authentication
router.use(auth);

// Initialize subjects for a class (one-time setup)
router.post('/class/:classId/initialize', subjectController.initializeSubjects);

// Get all subjects for a class (with initialization check)
router.get('/class/:classId', subjectController.getSubjectsByClass);

// Check if subjects are initialized for a class
router.get('/class/:classId/status', subjectController.checkSubjectsStatus);

// Add a new subject to a class
router.post('/class/:classId', subjectController.addSubject);

// Update a specific subject
router.put('/class/:classId/subject/:subjectId', subjectController.updateSubject);

// Delete a specific subject
router.delete('/class/:classId/subject/:subjectId', subjectController.deleteSubject);

// Assign teacher to a subject
router.post('/class/:classId/subject/:subjectId/assign', subjectController.assignTeacher);

// Remove teacher from a subject
router.delete('/class/:classId/subject/:subjectId/teacher', subjectController.removeTeacher);

// Sync marks with current subject assignments (class admin only)
router.put('/class/:classId/sync-marks', subjectController.syncMarksWithSubjects);

// Get subjects assigned to the current teacher
router.get('/my-subjects', subjectController.getSubjectsByTeacher);

// Get all teachers assigned to a specific class
router.get('/class/:classId/teachers', subjectController.getClassTeachers);

// Get or initialize subjects (alternative approach)
router.get('/class/:classId/get-or-init', subjectController.getOrInitializeSubjects);

module.exports = router;