// controllers/studentController.js
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');

// Get student profile
exports.getProfile = async (req, res) => {
  try {
    // Ensure the request is from a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find student and populate both class and school details
    const student = await Student.findById(req.user.id)
      .select('-password')
      .populate('classId', 'name section')
      .populate('schoolId', 'name code');

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Format the response to include all requested fields
    const studentProfile = {
      _id: student._id,
      name: student.name,
      email: student.email,
      phone: student.phone || '',
      studentId: student.studentId || '',
      uniqueId: student.uniqueId || '',
      schoolCode: student.schoolId ? student.schoolId.code : '',
      schoolId: student.schoolId ? student.schoolId._id : '',
      className: student.classId ? student.classId.name : '',
      section: student.classId ? student.classId.section : ''
    };

    res.json(studentProfile);
  } catch (err) {
    console.error('Error fetching student profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get student class details
exports.getClass = async (req, res) => {
  try {
    // Ensure the request is from a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Check if student has a class assigned
    if (!student.classId) {
      return res.status(404).json({ message: 'No class assigned to this student' });
    }

    const classDetails = await Class.findById(student.classId)
      .populate('teacherIds', 'name email')
      .select('name section teacherIds');

    if (!classDetails) {
      return res.status(404).json({ message: 'Class not found' });
    }

    res.json(classDetails);
  } catch (err) {
    console.error('Error fetching student class:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get available classes by school code
exports.getAvailableClasses = async (req, res) => {
  try {
    const { schoolCode } = req.params;

    // Find the school by code
    const school = await School.findOne({ code: schoolCode });
    
    if (!school) {
      return res.status(404).json({ message: 'School not found with this code' });
    }

    // Find all classes in the school
    const classes = await Class.find({ schoolId: school._id })
      .select('name section')
      .sort({ name: 1, section: 1 });

    res.json(classes);
  } catch (err) {
    console.error('Error fetching available classes:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Select/update student class
exports.selectClass = async (req, res) => {
  try {
    const { classId } = req.body;

    // Ensure the request is from a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find the student
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the class and verify it exists in the student's school
    const classObj = await Class.findOne({ 
      _id: classId, 
      schoolId: student.schoolId 
    });

    if (!classObj) {
      return res.status(404).json({ 
        message: 'Class not found or not available in your school' 
      });
    }

    // Remove student from previous class if they had one
    if (student.classId) {
      await Class.findByIdAndUpdate(
        student.classId,
        { $pull: { studentIds: student._id } }
      );
    }

    // Update student with new class
    student.classId = classId;
    student.class = classObj.name;  // Update class name
    student.section = classObj.section;  // Update section
    await student.save();

    // Add student to new class
    if (!classObj.studentIds.includes(student._id)) {
      classObj.studentIds.push(student._id);
      await classObj.save();
    }

    res.json({ message: 'Class selected successfully', classDetails: {
      id: classObj._id,
      name: classObj.name,
      section: classObj.section
    }});
  } catch (err) {
    console.error('Error selecting class:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};