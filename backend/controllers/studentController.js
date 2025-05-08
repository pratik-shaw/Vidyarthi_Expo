// controllers/studentController.js
const Student = require('../models/Student');
const Class = require('../models/Class');
const mongoose = require('mongoose');

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    res.json(student);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get student class details
exports.getClass = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if student has a class assigned
    if (!student.classId) {
      return res.status(404).json({ message: 'No class assigned to this student' });
    }

    const classDetails = await Class.findById(student.classId)
      .populate('teacherIds', 'name email uniqueCode -_id');

    if (!classDetails) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json(classDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// NEW: Select or update student's class
exports.selectClass = async (req, res) => {
  try {
    const { classId } = req.body;

    // Validate class ID
    if (!classId || !mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Valid class ID is required' });
    }

    // Check if class exists
    const classExists = await Class.findById(classId);
    if (!classExists) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // Update student's class
    const student = await Student.findByIdAndUpdate(
      req.user.id,
      { 
        classId,
        className: classExists.name,
        section: classExists.section
      },
      { new: true }
    ).select('-password');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      message: 'Class selected successfully',
      student
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};