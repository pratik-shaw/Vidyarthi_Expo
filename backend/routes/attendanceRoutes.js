// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const attendanceController = require('../controllers/attendanceController');

// All routes require authentication
router.use(auth);

// Get students list for taking attendance
router.get('/class/:classId/students', attendanceController.getStudentsForAttendance);

// Take attendance for a specific date
router.post('/class/:classId/take', attendanceController.takeAttendance);

// Get attendance for a specific date
router.get('/class/:classId/date', attendanceController.getAttendanceByDate);

// Update attendance for a specific date
router.put('/class/:classId/attendance/:attendanceId', attendanceController.updateAttendance);

// Get attendance history for a class
router.get('/class/:classId/history', attendanceController.getAttendanceHistory);

// Delete attendance record
router.delete('/class/:classId/attendance/:attendanceId', attendanceController.deleteAttendance);

router.get('/class/:classId/summary', attendanceController.getAttendanceSummary);

// FIXED: Add route for student's own stats (without studentId parameter)
router.get('/student/stats', attendanceController.getStudentAttendanceStats);

// Keep the original route for teachers to view specific student stats
router.get('/student/:studentId/stats', attendanceController.getStudentAttendanceStats);

module.exports = router;