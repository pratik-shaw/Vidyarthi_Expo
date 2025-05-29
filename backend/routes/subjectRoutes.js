// routes/subjectRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const subjectController = require('../controllers/subjectController');

// All routes require authentication
router.use(auth);

// Class Admin Routes (only class admin teachers can access these)

// Initialize subjects for a class (create subject document)
router.post('/class/:classId/initialize', subjectController.initializeSubjects);

// Get all subjects for a class
router.get('/class/:classId', subjectController.getSubjectsByClass);

// Add a new subject to class
router.post('/class/:classId', subjectController.addSubject);

// Update a specific subject
router.put('/class/:classId/subject/:subjectId', subjectController.updateSubject);

// Delete a specific subject
router.delete('/class/:classId/subject/:subjectId', subjectController.deleteSubject);

// Assign teacher to a subject
router.post('/class/:classId/subject/:subjectId/assign', subjectController.assignTeacher);

// Remove teacher from a subject
router.delete('/class/:classId/subject/:subjectId/teacher', subjectController.removeTeacher);

// Teacher Routes (for all teachers)

// Get subjects assigned to the logged-in teacher
router.get('/my-subjects', subjectController.getSubjectsByTeacher);
router.get('/class/:classId/teachers', subjectController.getClassTeachers);


module.exports = router;