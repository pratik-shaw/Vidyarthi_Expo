// routes/materials.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const materialController = require('../controllers/materialController');
const auth = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'audio/mp3', 'audio/wav', 'audio/m4a',
      'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed'
    ];
    cb(allowedMimeTypes.includes(file.mimetype) ? null : new Error('File type not allowed'), allowedMimeTypes.includes(file.mimetype));
  }
});

// Middleware functions
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  return !errors.isEmpty() ? res.status(400).json({ msg: 'Validation failed', errors: errors.array() }) : next();
};

const requireTeacher = (req, res, next) => req.user.role !== 'teacher' ? res.status(403).json({ msg: 'Access denied. Teacher role required.' }) : next();
const requireStudent = (req, res, next) => req.user.role !== 'student' ? res.status(403).json({ msg: 'Access denied. Student role required.' }) : next();
const validateObjectId = (field) => param(field).isMongoId().withMessage(`Invalid ${field} format`);

// Validation arrays
const categories = ['lecture_notes', 'assignment', 'homework', 'reference_material', 'exam_papers', 'syllabus', 'project_guidelines', 'other'];

const validateTags = (value) => {
  const tags = typeof value === 'string' ? value.split(',').map(tag => tag.trim()) : value;
  if (!Array.isArray(tags)) return true;
  if (tags.some(tag => typeof tag !== 'string' || tag.length > 50)) throw new Error('Each tag must be a string and not exceed 50 characters');
  if (tags.length > 10) throw new Error('Maximum 10 tags allowed');
  return true;
};

const validateUploadData = [
  body('documentTitle').trim().isLength({ min: 1, max: 200 }).withMessage('Document title must be between 1 and 200 characters'),
  body('documentCategory').isIn(categories).withMessage('Invalid document category'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('tags').optional().custom(validateTags)
];

const validateUpdateData = [
  body('documentTitle').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Document title must be between 1 and 200 characters'),
  body('documentCategory').optional().isIn(categories).withMessage('Invalid document category'),
  body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters'),
  body('tags').optional().custom(validateTags)
];

const validateQueryParams = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('skip').optional().isInt({ min: 0 }).withMessage('Skip must be a non-negative integer'),
  query('category').optional().isIn(categories).withMessage('Invalid category'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters')
];

// Routes
router.post('/upload/:classId/:subjectId', auth, requireTeacher, upload.single('file'), validateObjectId('classId'), validateObjectId('subjectId'), validateUploadData, handleValidationErrors, materialController.uploadMaterial);

router.get('/teacher/:classId/:subjectId', auth, requireTeacher, validateObjectId('classId'), validateObjectId('subjectId'), validateQueryParams, handleValidationErrors, materialController.getMaterialsForTeachers);

router.get('/my-materials', auth, requireTeacher, validateQueryParams, query('classId').optional().isMongoId().withMessage('Invalid classId format'), query('subjectId').optional().isMongoId().withMessage('Invalid subjectId format'), handleValidationErrors, materialController.getMyMaterials);

router.put('/:materialId', auth, requireTeacher, validateObjectId('materialId'), validateUpdateData, handleValidationErrors, materialController.updateMaterial);

router.delete('/:materialId', auth, requireTeacher, validateObjectId('materialId'), handleValidationErrors, materialController.deleteMaterial);

router.get('/student/:classId/:subjectId', auth, requireStudent, validateObjectId('classId'), validateObjectId('subjectId'), validateQueryParams, handleValidationErrors, materialController.getMaterialsForStudents);

router.get('/download/:materialId', auth, validateObjectId('materialId'), query('download').optional().isIn(['true', 'false']).withMessage('Download parameter must be true or false'), handleValidationErrors, materialController.downloadMaterial);

router.get('/details/:materialId', auth, validateObjectId('materialId'), handleValidationErrors, materialController.getMaterialById);

router.get('/statistics', 
  auth, 
  // Allow both teachers and students to view statistics
  (req, res, next) => {
    if (!['teacher', 'student'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Access denied. Teacher or Student role required.' });
    }
    next();
  },
  query('classId').optional().isMongoId().withMessage('Invalid classId format'), 
  query('subjectId').optional().isMongoId().withMessage('Invalid subjectId format'), 
  handleValidationErrors, 
  materialController.getMaterialStatistics
);

// Alternative: If you want only teachers to access statistics
router.get('/statistics-teacher', 
  auth, 
  requireTeacher,
  query('classId').optional().isMongoId().withMessage('Invalid classId format'), 
  query('subjectId').optional().isMongoId().withMessage('Invalid subjectId format'), 
  handleValidationErrors, 
  materialController.getMaterialStatistics
);
router.get('/categories', auth, materialController.getMaterialCategories);

// Error handling middleware
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const errorMap = {
      'LIMIT_FILE_SIZE': { msg: 'File too large', error: 'Maximum file size is 50MB' },
      'LIMIT_UNEXPECTED_FILE': { msg: 'Unexpected file field', error: 'Only single file upload is allowed' }
    };
    return res.status(400).json(errorMap[error.code] || { msg: 'File upload error', error: error.message });
  }
  if (error.message === 'File type not allowed') {
    return res.status(400).json({ msg: 'Invalid file type', error: 'Please upload a supported file format (PDF, DOC, XLS, PPT, images, videos, audio, ZIP)' });
  }
  next(error);
});

module.exports = router;