// controllers/studentController.js
const Student = require('../models/Student');
const Class = require('../models/Class');

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
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
      return res.status(404).json({ msg: 'Student not found' });
    }

    const classDetails = await Class.findById(student.classId)
      .populate('teacherIds', 'name email uniqueCode -_id');
    
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    res.json(classDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};