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

// Get all classes in admin's school - FIXED VERSION
exports.getClasses = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Fixed: Populate teacherIds and studentIds with the required fields
    const classes = await Class.find({ schoolId: admin.schoolId })
      .populate('teacherIds', '_id name email') // Include _id, name, and email
      .populate('studentIds', '_id name studentId email'); // Include _id, name, studentId, and email

    res.json(classes);
  } catch (err) {
    console.error('Error in getClasses:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// controllers/adminController.js - ADD THESE NEW FUNCTIONS

// Get complete teacher profile by ID (Admin only)
exports.getTeacherProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const { teacherId } = req.params;
    
    // Find teacher and ensure they belong to admin's school
    const teacher = await Teacher.findOne({ 
      _id: teacherId, 
      schoolId: admin.schoolId 
    })
    .select('-password')
    .populate('adminClassId', 'name section grade')
    .populate('classIds', 'name section grade')
    .populate('schoolId', 'name code');

    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found in your school' });
    }

    // Get additional statistics
    const totalClasses = teacher.classIds ? teacher.classIds.length : 0;
    const isClassAdmin = teacher.adminClassId ? true : false;
    
    // Count total students taught by this teacher
    let totalStudents = 0;
    if (teacher.classIds && teacher.classIds.length > 0) {
      const classIds = teacher.classIds.map(c => c._id);
      totalStudents = await Student.countDocuments({ classId: { $in: classIds } });
    }

    const teacherProfile = {
      _id: teacher._id,
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone || '',
      subject: teacher.subject || '',
      uniqueCode: teacher.uniqueCode,
      schoolCode: teacher.schoolId ? teacher.schoolId.code : '',
      school: teacher.schoolId ? {
        _id: teacher.schoolId._id,
        name: teacher.schoolId.name,
        code: teacher.schoolId.code
      } : null,
      profileImage: teacher.profileImage || '',
      classes: teacher.classIds || [],
      adminClass: teacher.adminClassId || null,
      statistics: {
        totalClasses,
        totalStudents,
        isClassAdmin
      },
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    };

    res.json(teacherProfile);
  } catch (err) {
    console.error('Error fetching teacher profile:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get complete student profile by ID (Admin only)
exports.getStudentProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const { studentId } = req.params;
    
    // Find student and ensure they belong to admin's school
    const student = await Student.findOne({ 
      _id: studentId, 
      schoolId: admin.schoolId 
    })
    .select('-password')
    .populate('classId', 'name section grade room schedule')
    .populate('schoolId', 'name code');

    if (!student) {
      return res.status(404).json({ msg: 'Student not found in your school' });
    }

    // Get class teachers if student has a class
    let classTeachers = [];
    let classAdmin = null;
    if (student.classId) {
      classTeachers = await Teacher.find({ 
        classIds: student.classId._id 
      }).select('name email subject');
      
      classAdmin = await Teacher.findOne({ 
        adminClassId: student.classId._id 
      }).select('name email');
    }

    const studentProfile = {
      _id: student._id,
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      studentId: student.studentId || '',
      uniqueId: student.uniqueId || '',
      schoolCode: student.schoolId ? student.schoolId.code : '',
      school: student.schoolId ? {
        _id: student.schoolId._id,
        name: student.schoolId.name,
        code: student.schoolId.code
      } : null,
      class: student.classId ? {
        _id: student.classId._id,
        name: student.classId.name,
        section: student.classId.section,
        grade: student.classId.grade || '',
        room: student.classId.room || '',
        schedule: student.classId.schedule || ''
      } : null,
      classTeachers: classTeachers || [],
      classAdmin: classAdmin || null,
      profileImage: student.profileImage || '',
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      address: student.address || '',
      dateOfBirth: student.dateOfBirth || null,
      gender: student.gender || '',
      bloodGroup: student.bloodGroup || '',
      emergencyContact: student.emergencyContact || '',
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    res.json(studentProfile);
  } catch (err) {
    console.error('Error fetching student profile:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get all teachers with complete data (Enhanced version)
exports.getTeachersComplete = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const teachers = await Teacher.find({ schoolId: admin.schoolId })
      .select('-password')
      .populate('adminClassId', 'name section')
      .populate('classIds', 'name section')
      .sort({ createdAt: -1 });

    // Add statistics for each teacher
    const teachersWithStats = await Promise.all(teachers.map(async (teacher) => {
      let totalStudents = 0;
      if (teacher.classIds && teacher.classIds.length > 0) {
        const classIds = teacher.classIds.map(c => c._id);
        totalStudents = await Student.countDocuments({ classId: { $in: classIds } });
      }

      return {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone || '',
        subject: teacher.subject || '',
        uniqueCode: teacher.uniqueCode,
        classes: teacher.classIds || [],
        adminClass: teacher.adminClassId || null,
        statistics: {
          totalClasses: teacher.classIds ? teacher.classIds.length : 0,
          totalStudents,
          isClassAdmin: teacher.adminClassId ? true : false
        },
        createdAt: teacher.createdAt
      };
    }));

    res.json(teachersWithStats);
  } catch (err) {
    console.error('Error fetching complete teachers data:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get all students with complete data (Enhanced version)
// Get all students with complete data (Enhanced version) - FIXED
exports.getStudentsComplete = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const students = await Student.find({ schoolId: admin.schoolId })
      .select('-password')
      .populate('classId', 'name section grade')
      .sort({ createdAt: -1 });

    const studentsWithClassInfo = students.map(student => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      studentId: student.studentId || '',
      uniqueId: student.uniqueId || '',
      schoolId: student.schoolId || '', // Add schoolId
      classId: student.classId ? student.classId._id : '', // Add classId
      className: student.classId ? student.classId.name : '', // Map class.name to className
      section: student.classId ? student.classId.section : '', // Add section
      grade: student.classId ? student.classId.grade : '', // Add grade if needed
      isActive: student.isActive !== false, // Ensure isActive is boolean (default to true if undefined)
      guardianName: student.guardianName || '',
      guardianPhone: student.guardianPhone || '',
      guardianEmail: student.guardianEmail || '',
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    }));

    res.json(studentsWithClassInfo);
  } catch (err) {
    console.error('Error fetching complete students data:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};