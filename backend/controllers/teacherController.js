// controllers/teacherController.js
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');

// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select('-password');
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    res.json(teacher);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all classes assigned to teacher
exports.getClasses = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    const classes = await Class.find({ 
      _id: { $in: teacher.classIds }
    });
    
    res.json(classes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all students in a specific class
exports.getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Check if teacher is assigned to this class
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    if (!teacher.classIds.includes(classId)) {
      return res.status(403).json({ msg: 'Not authorized to access this class' });
    }

    const students = await Student.find({ classId }).select('-password');
    res.json(students);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};