// controllers/adminController.js
const Admin = require('../models/Admin');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Class = require('../models/Class');

// Get admin profile
exports.getProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }
    res.json(admin);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get admin's school details
exports.getSchool = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const school = await School.findById(admin.schoolId);
    if (!school) {
      return res.status(404).json({ msg: 'School not found' });
    }

    res.json(school);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all teachers in admin's school
exports.getTeachers = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const teachers = await Teacher.find({ schoolId: admin.schoolId }).select('-password');
    res.json(teachers);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all students in admin's school
exports.getStudents = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const students = await Student.find({ schoolId: admin.schoolId }).select('-password');
    res.json(students);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get all classes in admin's school
exports.getClasses = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const classes = await Class.find({ schoolId: admin.schoolId });
    res.json(classes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};