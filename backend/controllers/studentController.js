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
      section: student.classId ? student.classId.section : '',
      // Editable fields
      dateOfBirth: student.dateOfBirth,
      address: student.address || '',
      admissionDate: student.admissionDate,
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      parentEmail: student.parentEmail || '',
      profileImage: student.profileImage || ''
    };

    res.json(studentProfile);
  } catch (err) {
    console.error('Error fetching student profile:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update student profile (only editable fields)
exports.updateProfile = async (req, res) => {
  try {
    // Ensure the request is from a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { 
      dateOfBirth, 
      address, 
      admissionDate, 
      parentName, 
      parentPhone, 
      parentEmail 
    } = req.body;

    // Find the student
    const student = await Student.findById(req.user.id);
    
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Validate email format if parentEmail is provided
    if (parentEmail && parentEmail.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parentEmail)) {
        return res.status(400).json({ message: 'Invalid parent email format' });
      }
    }

    // Validate date formats if provided
    if (dateOfBirth && dateOfBirth.trim() !== '') {
      const birthDate = new Date(dateOfBirth);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date of birth format' });
      }
      // Check if date of birth is not in the future
      if (birthDate > new Date()) {
        return res.status(400).json({ message: 'Date of birth cannot be in the future' });
      }
    }

    if (admissionDate && admissionDate.trim() !== '') {
      const admission = new Date(admissionDate);
      if (isNaN(admission.getTime())) {
        return res.status(400).json({ message: 'Invalid admission date format' });
      }
    }

    // Update only the editable fields
    const updateData = {};
    
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth && dateOfBirth.trim() !== '' ? new Date(dateOfBirth) : null;
    }
    if (address !== undefined) {
      updateData.address = address.trim();
    }
    if (admissionDate !== undefined) {
      updateData.admissionDate = admissionDate && admissionDate.trim() !== '' ? new Date(admissionDate) : null;
    }
    if (parentName !== undefined) {
      updateData.parentName = parentName.trim();
    }
    if (parentPhone !== undefined) {
      updateData.parentPhone = parentPhone.trim();
    }
    if (parentEmail !== undefined) {
      updateData.parentEmail = parentEmail.trim();
    }

    // Update the student
    const updatedStudent = await Student.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password')
     .populate('classId', 'name section')
     .populate('schoolId', 'name code');

    // Format the response
    const studentProfile = {
      _id: updatedStudent._id,
      name: updatedStudent.name,
      email: updatedStudent.email,
      phone: updatedStudent.phone || '',
      studentId: updatedStudent.studentId || '',
      uniqueId: updatedStudent.uniqueId || '',
      schoolCode: updatedStudent.schoolId ? updatedStudent.schoolId.code : '',
      schoolId: updatedStudent.schoolId ? updatedStudent.schoolId._id : '',
      className: updatedStudent.classId ? updatedStudent.classId.name : '',
      section: updatedStudent.classId ? updatedStudent.classId.section : '',
      dateOfBirth: updatedStudent.dateOfBirth,
      address: updatedStudent.address || '',
      admissionDate: updatedStudent.admissionDate,
      parentName: updatedStudent.parentName || '',
      parentPhone: updatedStudent.parentPhone || '',
      parentEmail: updatedStudent.parentEmail || '',
      profileImage: updatedStudent.profileImage || ''
    };

    res.json({
      message: 'Profile updated successfully',
      student: studentProfile
    });

  } catch (err) {
    console.error('Error updating student profile:', err.message);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: errors.join(', ') });
    }
    
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

// Get student details by ID (for teachers)
exports.getStudentById = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Ensure the request is from a teacher
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Find student and populate both class and school details
    const student = await Student.findById(studentId)
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
      schoolName: student.schoolId ? student.schoolId.name : '',
      className: student.classId ? student.classId.name : '',
      section: student.classId ? student.classId.section : '',
      classId: student.classId ? student.classId._id : '',
      dateOfBirth: student.dateOfBirth,
      address: student.address || '',
      admissionDate: student.admissionDate,
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      parentEmail: student.parentEmail || '',
      profileImage: student.profileImage || '',
      isActive: student.isActive !== undefined ? student.isActive : true,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    };

    res.json(studentProfile);
  } catch (err) {
    console.error('Error fetching student details:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};