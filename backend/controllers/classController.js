// controllers/classController.js
const Class = require('../models/Class');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

// Create a new class (admin only)
exports.createClass = async (req, res) => {
  try {
    const { name, section } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Create new class
    const newClass = new Class({
      name,
      section,
      schoolId: admin.schoolId
    });

    await newClass.save();

    // Update school with new class
    const school = await School.findById(admin.schoolId);
    school.classIds.push(newClass._id);
    await school.save();

    res.status(201).json(newClass);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Assign teacher to class (admin only)
exports.assignTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;
    
    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    
    const admin = await Admin.findById(req.user.id);
    
    // Find class and teacher, ensure they belong to admin's school
    const classObj = await Class.findOne({ 
      _id: classId,
      schoolId: admin.schoolId
    });
    
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found' });
    }
    
    const teacher = await Teacher.findOne({
      _id: teacherId,
      schoolId: admin.schoolId
    });
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    // Update class with teacher ID
    if (!classObj.teacherIds.includes(teacherId)) {
      classObj.teacherIds.push(teacherId);
      await classObj.save();
    }
    
    // Update teacher with class ID
    if (!teacher.classIds.includes(classId)) {
      teacher.classIds.push(classId);
      await teacher.save();
    }
    
    res.json({ msg: 'Teacher assigned to class successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Get class details
exports.getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Find class and populate related data
    const classDetails = await Class.findById(classId)
      .populate('teacherIds', 'name email -_id')
      .populate('studentIds', 'name studentId -_id');
    
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }
    
    res.json(classDetails);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};