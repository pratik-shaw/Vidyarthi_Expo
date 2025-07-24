// routes/submissionRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const submissionController = require('../controllers/submissionController');

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory as Buffer

const fileFilter = (req, file, cb) => {
  // Accept only PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  }
});

// Middleware to handle multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'File size too large. Maximum size is 10MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ msg: 'Too many files. Only one file is allowed.' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ msg: 'Unexpected file field.' });
    }
  }
  
  if (error.message === 'Only PDF files are allowed') {
    return res.status(400).json({ msg: error.message });
  }
  
  next(error);
};

// All routes require authentication
router.use(auth);

// Student routes
// Get available subjects for submission (Student only)
router.get('/subjects', (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Only students can access this endpoint' });
  }
  next();
}, submissionController.getAvailableSubjects);

// Create new submission (Student only)
router.post('/', (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Only students can create submissions' });
  }
  next();
}, upload.single('pdf'), handleUploadError, submissionController.createSubmission);

// Get student's own submissions (Student only)
router.get('/my-submissions', (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Only students can access this endpoint' });
  }
  next();
}, submissionController.getStudentSubmissions);

// Teacher routes
// Get submissions assigned to teacher (Teacher only)
router.get('/teacher-submissions', (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ msg: 'Only teachers can access this endpoint' });
  }
  next();
}, submissionController.getTeacherSubmissions);

// Get submission statistics for teacher (Teacher only)
router.get('/stats', (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ msg: 'Only teachers can access this endpoint' });
  }
  next();
}, submissionController.getSubmissionStats);

// Update submission status (Teacher only)
router.put('/:submissionId/status', (req, res, next) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ msg: 'Only teachers can update submission status' });
  }
  next();
}, submissionController.updateSubmissionStatus);

// Shared routes (both student and teacher can access based on ownership/assignment)
// Get specific submission by ID
router.get('/:submissionId', submissionController.getSubmissionById);

// Download PDF file
router.get('/:submissionId/download', submissionController.downloadPDF);

// Error handling middleware for routes
router.use((error, req, res, next) => {
  console.error('Submission route error:', error);
  res.status(500).json({ 
    msg: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;