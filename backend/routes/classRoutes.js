// routes/classRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const classController = require('../controllers/classController');

// Protected routes
router.get('/:classId', auth, classController.getClassDetails);

module.exports = router;