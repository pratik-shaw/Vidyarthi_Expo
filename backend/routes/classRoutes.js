// routes/classRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const classController = require('../controllers/classController');

// Protected routes
router.get('/all', auth, classController.getAllClasses); // NEW ROUTE - must come before /:classId
router.get('/:classId', auth, classController.getClassDetails);

// Additional routes for class management
router.post('/create', auth, classController.createClass);
router.put('/:id', auth, classController.updateClass);
router.delete('/:id', auth, classController.deleteClass);
router.post('/assign-teacher', auth, classController.assignTeacher);
router.post('/assign-teachers', auth, classController.assignTeachers);
router.post('/assign-class-admin', auth, classController.assignClassAdmin);
router.post('/remove-class-admin', auth, classController.removeClassAdmin);
router.post('/remove-teacher', auth, classController.removeTeacher);
router.post('/assign-students', auth, classController.assignStudents);
router.post('/remove-student', auth, classController.removeStudent);

module.exports = router;