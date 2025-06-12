// controllers/eventController.js
const Event = require('../models/Event');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');

// Create a new event (teacher only)
exports.createEvent = async (req, res) => {
  try {
    const { classId, title, category, startDate, endDate, description } = req.body;

    console.log('createEvent called with:', { classId, title, category, startDate, endDate, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is a teacher
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ msg: 'Not authorized - Teacher access required' });
    }

    // Validate required fields
    if (!classId || !title || !category || !startDate || !endDate) {
      return res.status(400).json({ msg: 'Class ID, title, category, start date, and end date are required' });
    }

    // Validate dates
    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);
    
    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      return res.status(400).json({ msg: 'Invalid date format' });
    }

    if (endDateTime < startDateTime) {
      return res.status(400).json({ msg: 'End date must be after start date' });
    }

    // Find teacher
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Find class and verify teacher has access to it
    const classObj = await Class.findOne({ 
      _id: classId, 
      schoolId: teacher.schoolId,
      teacherIds: teacher._id 
    });

    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found or you are not assigned to this class' });
    }

    console.log('Teacher and class validated:', { 
      teacherId: teacher._id, 
      classId: classObj._id, 
      className: classObj.name 
    });

    // Create new event item
    const newEventItem = {
      title: title.trim(),
      category,
      startDate: startDateTime,
      endDate: endDateTime,
      description: description ? description.trim() : '',
      createdBy: teacher._id
    };

    // Find existing event document for this class or create new one
    let eventDoc = await Event.findOne({ 
      schoolId: teacher.schoolId, 
      classId: classId 
    });

    if (eventDoc) {
      // Add event to existing document
      eventDoc.events.push(newEventItem);
      await eventDoc.save();
    } else {
      // Create new event document
      eventDoc = new Event({
        schoolId: teacher.schoolId,
        classId: classId,
        events: [newEventItem]
      });
      await eventDoc.save();
    }

    const createdEvent = eventDoc.events[eventDoc.events.length - 1];
    console.log('Event created successfully:', { eventId: createdEvent.eventId });

    res.status(201).json({
      msg: 'Event created successfully',
      event: createdEvent,
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in createEvent:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get events for a class
exports.getClassEvents = async (req, res) => {
  try {
    const { classId } = req.params;
    const { month, year, category } = req.query;

    console.log('getClassEvents called with:', { classId, month, year, category, userId: req.user?.id, userRole: req.user?.role });

    // Verify user authorization
    if (!req.user || !['teacher', 'admin', 'student'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    let userSchoolId;
    let hasClassAccess = false;

    // Check user access based on role
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findById(req.user.id);
      if (!teacher) {
        return res.status(404).json({ msg: 'Teacher not found' });
      }
      userSchoolId = teacher.schoolId;
      hasClassAccess = teacher.classIds.includes(classId);
    } else if (req.user.role === 'admin') {
      const Admin = require('../models/Admin');
      const admin = await Admin.findById(req.user.id);
      if (!admin) {
        return res.status(404).json({ msg: 'Admin not found' });
      }
      userSchoolId = admin.schoolId;
      hasClassAccess = true; // Admins can access all classes in their school
    } else if (req.user.role === 'student') {
      const Student = require('../models/Student');
      const student = await Student.findById(req.user.id);
      if (!student) {
        return res.status(404).json({ msg: 'Student not found' });
      }
      userSchoolId = student.schoolId;
      hasClassAccess = student.classId && student.classId.toString() === classId;
    }

    if (!hasClassAccess) {
      return res.status(403).json({ msg: 'You do not have access to this class' });
    }

    // Find events for the class
    const eventDoc = await Event.findOne({ 
      schoolId: userSchoolId, 
      classId: classId 
    }).populate('events.createdBy', 'name email');

    if (!eventDoc) {
      return res.json({ 
        msg: 'No events found for this class',
        events: [],
        classId: classId
      });
    }

    let events = eventDoc.events;

    // Filter by month and year if provided
    if (month && year) {
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (monthNum >= 1 && monthNum <= 12 && yearNum > 0) {
        events = events.filter(event => {
          const eventDate = new Date(event.startDate);
          return eventDate.getMonth() + 1 === monthNum && eventDate.getFullYear() === yearNum;
        });
      }
    }

    // Filter by category if provided
    if (category && category !== 'all') {
      events = events.filter(event => event.category === category);
    }

    // Sort events by start date
    events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    console.log('Events retrieved:', { count: events.length, classId });

    res.json({
      msg: 'Events retrieved successfully',
      events: events,
      classId: classId,
      totalEvents: events.length
    });

  } catch (err) {
    console.error('Error in getClassEvents:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update an event (teacher only - creator or admin)
exports.updateEvent = async (req, res) => {
  try {
    const { classId, eventId } = req.params;
    const { title, category, startDate, endDate, description } = req.body;

    console.log('updateEvent called with:', { classId, eventId, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is a teacher
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ msg: 'Not authorized - Teacher access required' });
    }

    // Find teacher
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Find event document
    const eventDoc = await Event.findOne({ 
      schoolId: teacher.schoolId, 
      classId: classId 
    });

    if (!eventDoc) {
      return res.status(404).json({ msg: 'No events found for this class' });
    }

    // Find specific event
    const eventIndex = eventDoc.events.findIndex(e => e.eventId.toString() === eventId);
    if (eventIndex === -1) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    const event = eventDoc.events[eventIndex];

    // Check if teacher created this event or is class admin
    const isCreator = event.createdBy.toString() === teacher._id.toString();
    const isClassAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId;

    if (!isCreator && !isClassAdmin) {
      return res.status(403).json({ msg: 'You can only update events you created or if you are class admin' });
    }

    // Validate dates if provided
    let startDateTime, endDateTime;
    if (startDate) {
      startDateTime = new Date(startDate);
      if (isNaN(startDateTime.getTime())) {
        return res.status(400).json({ msg: 'Invalid start date format' });
      }
    }

    if (endDate) {
      endDateTime = new Date(endDate);
      if (isNaN(endDateTime.getTime())) {
        return res.status(400).json({ msg: 'Invalid end date format' });
      }
    }

    // Check date logic
    const finalStartDate = startDateTime || event.startDate;
    const finalEndDate = endDateTime || event.endDate;
    
    if (finalEndDate < finalStartDate) {
      return res.status(400).json({ msg: 'End date must be after start date' });
    }

    // Update event fields
    if (title !== undefined) event.title = title.trim();
    if (category !== undefined) event.category = category;
    if (startDateTime) event.startDate = startDateTime;
    if (endDateTime) event.endDate = endDateTime;
    if (description !== undefined) event.description = description ? description.trim() : '';
    event.updatedAt = new Date();

    await eventDoc.save();

    console.log('Event updated successfully:', { eventId: event.eventId });

    res.json({
      msg: 'Event updated successfully',
      event: event
    });

  } catch (err) {
    console.error('Error in updateEvent:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Delete an event (teacher only - creator or admin)
exports.deleteEvent = async (req, res) => {
  try {
    const { classId, eventId } = req.params;

    console.log('deleteEvent called with:', { classId, eventId, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is a teacher
    if (!req.user || req.user.role !== 'teacher') {
      return res.status(403).json({ msg: 'Not authorized - Teacher access required' });
    }

    // Find teacher
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Find event document
    const eventDoc = await Event.findOne({ 
      schoolId: teacher.schoolId, 
      classId: classId 
    });

    if (!eventDoc) {
      return res.status(404).json({ msg: 'No events found for this class' });
    }

    // Find specific event
    const eventIndex = eventDoc.events.findIndex(e => e.eventId.toString() === eventId);
    if (eventIndex === -1) {
      return res.status(404).json({ msg: 'Event not found' });
    }

    const event = eventDoc.events[eventIndex];

    // Check if teacher created this event or is class admin
    const isCreator = event.createdBy.toString() === teacher._id.toString();
    const isClassAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId;

    if (!isCreator && !isClassAdmin) {
      return res.status(403).json({ msg: 'You can only delete events you created or if you are class admin' });
    }

    // Store event info for response
    const deletedEventInfo = {
      eventId: event.eventId,
      title: event.title,
      category: event.category,
      startDate: event.startDate,
      endDate: event.endDate
    };

    // Remove event from array
    eventDoc.events.splice(eventIndex, 1);
    await eventDoc.save();

    console.log('Event deleted successfully:', { eventId: deletedEventInfo.eventId });

    res.json({
      msg: 'Event deleted successfully',
      deletedEvent: deletedEventInfo
    });

  } catch (err) {
    console.error('Error in deleteEvent:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get event categories
exports.getEventCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'exam', label: 'Exam' },
      { value: 'assignment', label: 'Assignment' },
      { value: 'project', label: 'Project' },
      { value: 'meeting', label: 'Meeting' },
      { value: 'holiday', label: 'Holiday' },
      { value: 'sports', label: 'Sports' },
      { value: 'cultural', label: 'Cultural' },
      { value: 'other', label: 'Other' }
    ];

    res.json({
      msg: 'Event categories retrieved successfully',
      categories: categories
    });
  } catch (err) {
    console.error('Error in getEventCategories:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};