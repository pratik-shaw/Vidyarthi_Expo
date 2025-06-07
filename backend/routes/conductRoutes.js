// routes/conductRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const conductController = require('../controllers/conductController');

// All routes require authentication
router.use(auth);

// Create a new conduct record for a student in a class
router.post('/class/:classId/student/:studentId', conductController.createConduct);

// Get conduct records for a specific student in a class
router.get('/class/:classId/student/:studentId', conductController.getConductByStudent);

// Get all conduct records for a class
router.get('/class/:classId', conductController.getConductByClass);

// Get conduct records created by the current teacher
router.get('/my-conducts', conductController.getConductByTeacher);

// Get a specific conduct record by ID
router.get('/:conductId', conductController.getConductById);

// Update a conduct record
router.put('/:conductId', conductController.updateConduct);

// Delete a conduct record (soft delete)
router.delete('/:conductId', conductController.deleteConduct);

module.exports = router;