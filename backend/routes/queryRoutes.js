// routes/queryRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const queryController = require('../controllers/queryController');

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept common file types for queries
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Only PDF, Word documents, and images are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 3 // Maximum 3 files
  }
});

// Middleware to handle multer errors
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ msg: 'File size too large. Maximum size is 5MB per file.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ msg: 'Too many files. Maximum 3 files allowed.' });
    }
  }

  if (error.message.includes('File type not allowed')) {
    return res.status(400).json({ msg: error.message });
  }

  next(error);
};

// All routes require authentication
router.use(auth);

// Student routes
// Create new query (Student only)
router.post('/', (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Only students can create queries' });
  }
  next();
}, upload.array('attachments', 3), handleUploadError, queryController.createQuery);

// Get student's own queries (Student only)
router.get('/my-queries', (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ msg: 'Only students can access this endpoint' });
  }
  next();
}, queryController.getStudentQueries);

// Admin routes
// Get all queries for admin (Admin only)
router.get('/admin-queries', (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can access this endpoint' });
  }
  next();
}, queryController.getAdminQueries);

// Get queries by class (Admin only)
router.get('/class/:classId', (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can access this endpoint' });
  }
  next();
}, queryController.getQueriesByClass);

// Get query statistics (Admin only)
router.get('/stats', (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can access this endpoint' });
  }
  next();
}, queryController.getQueryStats);

// Update query status (Admin only)
router.put('/:queryId/status', (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Only admins can update query status' });
  }
  next();
}, queryController.updateQueryStatus);

// Shared routes (both student and admin can access based on ownership/authorization)
// Get specific query by ID
router.get('/:queryId', queryController.getQueryById);

// Download attachment
router.get('/:queryId/attachments/:attachmentIndex', queryController.downloadAttachment);

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Query route error:', error);
  res.status(500).json({ 
    msg: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;