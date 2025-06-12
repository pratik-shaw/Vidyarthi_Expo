// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const eventController = require('../controllers/eventController');

// Get event categories (public for authenticated users)
router.get('/categories', auth, eventController.getEventCategories);

// Create a new event (teacher only)
router.post('/create', auth, eventController.createEvent);

// Get events for a specific class
// Query parameters: month, year, category
// Example: /events/class/123456789/events?month=12&year=2024&category=exam
router.get('/class/:classId', auth, eventController.getClassEvents);

// Update a specific event (teacher only - creator or class admin)
router.put('/class/:classId/event/:eventId', auth, eventController.updateEvent);

// Delete a specific event (teacher only - creator or class admin)
router.delete('/class/:classId/event/:eventId', auth, eventController.deleteEvent);

module.exports = router;