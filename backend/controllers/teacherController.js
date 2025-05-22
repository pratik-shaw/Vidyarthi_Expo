// controllers/teacherController.js
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');
const mongoose = require('mongoose');

// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('-password')
      .populate('adminClassId', 'name section');
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    // Return the formatted teacher data to match the client expectations
    res.json({ 
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        schoolCode: teacher.schoolCode,
        schoolId: teacher.schoolId,
        classIds: teacher.classIds,
        adminClassId: teacher.adminClassId,
        uniqueCode: teacher.uniqueCode,
        subject: teacher.subject || '',
        phone: teacher.phone || '',
        profileImage: teacher.profileImage || ''
      }
    });
  } catch (err) {
    console.error('Error fetching teacher profile:', err.message);
    res.status(500).send('Server error');
  }
};

// Get classes for a teacher
exports.getClasses = async (req, res) => {
  try {
    // Get teacher data
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    // If teacher has no classes
    if (!teacher.classIds || teacher.classIds.length === 0) {
      return res.json({ classes: [] });
    }
    
    // Get all classes assigned to this teacher
    const classes = await Class.find({
      _id: { $in: teacher.classIds }
    });
    
    // For each class, count the number of students and check if teacher is admin
    const classesWithDetails = await Promise.all(classes.map(async (classItem) => {
      const studentsCount = await Student.countDocuments({ classId: classItem._id });
      const isAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classItem._id.toString();
      
      return {
        _id: classItem._id,
        name: classItem.name,
        grade: classItem.grade,
        section: classItem.section,
        studentsCount,
        schedule: classItem.schedule || '',
        room: classItem.room || '',
        isAdmin
      };
    }));
    
    // Return with the classes array in a nested object to match the client expectation
    res.json({ classes: classesWithDetails });
  } catch (err) {
    console.error('Error fetching teacher classes:', err.message);
    res.status(500).send('Server error');
  }
};

// Get students by class ID
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
    
    // Get class details
    const classDetails = await Class.findById(classId);
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    const students = await Student.find({ classId }).select('-password');
    
    // Check if teacher is admin of this class
    const isAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId;
    
    // Format the response to include both class details and students
    res.json({
      class: {
        _id: classDetails._id,
        name: classDetails.name,
        grade: classDetails.grade,
        section: classDetails.section,
        isAdmin
      },
      students
    });
  } catch (err) {
    console.error('Error fetching students by class:', err.message);
    
    // Check if the classId is not a valid ObjectId
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid class ID format' });
    }
    
    res.status(500).send('Server error');
  }
};

// Get admin class details and students (for class admin)
exports.getAdminClass = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('adminClassId');
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    if (!teacher.adminClassId) {
      return res.status(404).json({ msg: 'No admin class assigned' });
    }
    
    // Get students in the admin class
    const students = await Student.find({ classId: teacher.adminClassId._id }).select('-password');
    
    // Get all teachers assigned to this class
    const teachers = await Teacher.find({ 
      classIds: teacher.adminClassId._id 
    }).select('name email');
    
    res.json({
      adminClass: {
        _id: teacher.adminClassId._id,
        name: teacher.adminClassId.name,
        section: teacher.adminClassId.section,
        grade: teacher.adminClassId.grade || '',
        studentsCount: students.length,
        teachersCount: teachers.length
      },
      students,
      teachers
    });
  } catch (err) {
    console.error('Error fetching admin class:', err.message);
    res.status(500).send('Server error');
  }
};