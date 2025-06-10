// controllers/conductController.js
const Conduct = require('../models/Conduct');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const mongoose = require('mongoose');

// Helper function to verify teacher has access to student
const verifyTeacherAccess = async (teacherId, studentId, classId) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { authorized: false, error: 'Teacher not found' };
    }

    // Verify student exists and is active
    const student = await Student.findOne({ _id: studentId, isActive: true });
    if (!student) {
      return { authorized: false, error: 'Student not found' };
    }

    // Verify class exists
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return { authorized: false, error: 'Class not found' };
    }

    // Check if student belongs to the specified class
    if (student.classId.toString() !== classId.toString()) {
      return { authorized: false, error: 'Student does not belong to this class' };
    }

    // Check if teacher has access to this student/class
    // Teacher has access if:
    // 1. They are admin of this class
    // 2. They teach any subject in this class
    // 3. They are from the same school as the student
    const isClassAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId.toString();
    const teachesClass = teacher.classesTeaching && teacher.classesTeaching.some(id => id.toString() === classId.toString());
    const sameSchool = teacher.schoolId && teacher.schoolId.toString() === student.schoolId.toString();

    if (!isClassAdmin && !teachesClass && !sameSchool) {
      return { authorized: false, error: 'Not authorized to access this student\'s records' };
    }

    return { authorized: true, teacher, student, classObj };
  } catch (error) {
    console.error('Error in verifyTeacherAccess:', error);
    return { authorized: false, error: 'Authorization check failed' };
  }
};

// Helper function for strict permissions (for update/delete operations)
const verifyStrictTeacherPermissions = async (teacherId, classId) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    return { authorized: false, error: 'Teacher not found' };
  }

  const classObj = await Class.findById(classId);
  if (!classObj) {
    return { authorized: false, error: 'Class not found' };
  }

  const isClassAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId.toString();
  const teachesClass = teacher.classesTeaching && teacher.classesTeaching.includes(classId);

  if (!isClassAdmin && !teachesClass) {
    return { authorized: false, error: 'Not authorized to access this class' };
  }

  return { authorized: true, teacher, classObj };
};

// Create a new conduct record
exports.createConduct = async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { type, title, description, severity, actionTaken, parentNotified, followUpRequired, followUpDate } = req.body;

    console.log('createConduct called:', { studentId, classId, type, title, userId: req.user.id });

    // Validate required fields
    if (!type || !title || !description) {
      return res.status(400).json({ msg: 'Type, title, and description are required' });
    }

    // Validate type
    if (!['positive', 'negative', 'neutral'].includes(type)) {
      return res.status(400).json({ msg: 'Invalid conduct type' });
    }

    // Validate severity if provided
    if (severity && !['low', 'medium', 'high'].includes(severity)) {
      return res.status(400).json({ msg: 'Invalid severity level' });
    }

    // Use flexible access verification for creating conduct
    const accessCheck = await verifyTeacherAccess(req.user.id, studentId, classId);
    if (!accessCheck.authorized) {
      console.log('Access denied:', accessCheck.error);
      return res.status(403).json({ msg: accessCheck.error });
    }

    const { teacher, student, classObj } = accessCheck;

    // Create new conduct record
    const newConduct = new Conduct({
      studentId,
      teacherId: teacher._id,
      classId,
      schoolId: teacher.schoolId,
      type,
      title: title.trim(),
      description: description.trim(),
      severity: severity || (type === 'negative' ? 'medium' : 'low'),
      actionTaken: actionTaken?.trim(),
      parentNotified: parentNotified || false,
      followUpRequired: followUpRequired || false,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      createdBy: teacher._id
    });

    await newConduct.save();

    // Get populated conduct record
    const populatedConduct = await Conduct.findById(newConduct._id)
      .populate('teacherId', 'name email')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section');

    console.log('Conduct record created successfully:', newConduct._id);

    res.status(201).json({
      msg: 'Conduct record created successfully',
      conduct: populatedConduct,
      studentInfo: {
        id: student._id,
        name: student.name,
        studentId: student.studentId
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in createConduct:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get conduct records for a specific student
exports.getConductByStudent = async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { type, startDate, endDate, limit = 50, skip = 0 } = req.query;

    console.log('getConductByStudent called:', { studentId, classId, userId: req.user.id });

    // Use flexible access verification
    const accessCheck = await verifyTeacherAccess(req.user.id, studentId, classId);
    if (!accessCheck.authorized) {
      return res.status(403).json({ msg: accessCheck.error });
    }

    const { student, classObj } = accessCheck;

    // Get conduct records
    const conducts = await Conduct.getByStudent(studentId, {
      type,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    // Get conduct summary
    const summary = await Conduct.getStudentSummary(studentId, {
      startDate,
      endDate
    });

    console.log('Conduct records retrieved:', conducts.length);

    res.json({
      conducts,
      summary,
      studentInfo: {
        id: student._id,
        name: student.name,
        studentId: student.studentId
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      },
      totalRecords: conducts.length
    });

  } catch (err) {
    console.error('Error in getConductByStudent:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get conduct records for a class
exports.getConductByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { type, studentId, startDate, endDate, limit = 100, skip = 0 } = req.query;

    console.log('getConductByClass called:', { classId, userId: req.user.id });

    // Use strict permissions for class-wide access
    const authCheck = await verifyStrictTeacherPermissions(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Build query options
    const options = {
      type,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    // Get conduct records
    let conducts;
    if (studentId) {
      // Get records for specific student in class
      conducts = await Conduct.getByStudent(studentId, options);
    } else {
      // Get all records for class
      conducts = await Conduct.getByClass(classId, options);
    }

    console.log('Class conduct records retrieved:', conducts.length);

    res.json({
      conducts,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      },
      totalRecords: conducts.length
    });

  } catch (err) {
    console.error('Error in getConductByClass:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get conduct records created by a teacher
exports.getConductByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { type, classId, studentId, startDate, endDate, limit = 100, skip = 0 } = req.query;

    console.log('getConductByTeacher called:', { teacherId });

    // Verify teacher exists
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Build query options
    const options = {
      type,
      startDate,
      endDate,
      limit: parseInt(limit),
      skip: parseInt(skip)
    };

    // Get conduct records created by this teacher
    let conducts = await Conduct.getByTeacher(teacherId, options);

    // Filter by class if specified
    if (classId) {
      conducts = conducts.filter(conduct => conduct.classId._id.toString() === classId);
    }

    // Filter by student if specified
    if (studentId) {
      conducts = conducts.filter(conduct => conduct.studentId._id.toString() === studentId);
    }

    console.log('Teacher conduct records retrieved:', conducts.length);

    res.json({
      conducts,
      teacherInfo: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      },
      totalRecords: conducts.length
    });

  } catch (err) {
    console.error('Error in getConductByTeacher:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get a specific conduct record
exports.getConductById = async (req, res) => {
  try {
    const { conductId } = req.params;

    console.log('getConductById called:', { conductId, userId: req.user.id });

    // Find conduct record
    const conduct = await Conduct.findOne({ _id: conductId, isActive: true })
      .populate('teacherId', 'name email')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!conduct) {
      return res.status(404).json({ msg: 'Conduct record not found' });
    }

    // Use flexible access verification
    const accessCheck = await verifyTeacherAccess(req.user.id, conduct.studentId._id, conduct.classId._id);
    if (!accessCheck.authorized) {
      return res.status(403).json({ msg: accessCheck.error });
    }

    res.json({
      conduct,
      classInfo: {
        id: conduct.classId._id,
        name: conduct.classId.name,
        section: conduct.classId.section
      }
    });

  } catch (err) {
    console.error('Error in getConductById:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid conduct ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update a conduct record
exports.updateConduct = async (req, res) => {
  try {
    const { conductId } = req.params;
    const updateData = req.body;

    console.log('updateConduct called:', { conductId, userId: req.user.id });

    // Find conduct record
    const conduct = await Conduct.findOne({ _id: conductId, isActive: true });
    if (!conduct) {
      return res.status(404).json({ msg: 'Conduct record not found' });
    }

    // Use strict permissions for updates
    const authCheck = await verifyStrictTeacherPermissions(req.user.id, conduct.classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Only allow the original creator or class admin to update
    const isCreator = conduct.createdBy.toString() === req.user.id;
    const isClassAdmin = authCheck.teacher.adminClassId && 
                        authCheck.teacher.adminClassId.toString() === conduct.classId.toString();

    if (!isCreator && !isClassAdmin) {
      return res.status(403).json({ msg: 'Only the original creator or class admin can update this record' });
    }

    // Update conduct record
    await conduct.updateConduct(updateData, req.user.id);

    // Get updated conduct with populated data
    const updatedConduct = await Conduct.findById(conductId)
      .populate('teacherId', 'name email')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('updatedBy', 'name email');

    console.log('Conduct record updated successfully:', conductId);

    res.json({
      msg: 'Conduct record updated successfully',
      conduct: updatedConduct
    });

  } catch (err) {
    console.error('Error in updateConduct:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid conduct ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Delete a conduct record (soft delete)
exports.deleteConduct = async (req, res) => {
  try {
    const { conductId } = req.params;

    console.log('deleteConduct called:', { conductId, userId: req.user.id });

    // Find conduct record
    const conduct = await Conduct.findOne({ _id: conductId, isActive: true });
    if (!conduct) {
      return res.status(404).json({ msg: 'Conduct record not found' });
    }

    // Use flexible access verification (same as other operations)
    const accessCheck = await verifyTeacherAccess(req.user.id, conduct.studentId, conduct.classId);
    if (!accessCheck.authorized) {
      return res.status(403).json({ msg: accessCheck.error });
    }

    // Additional permission check - only creator or class admin can delete
    const teacher = await Teacher.findById(req.user.id);
    const isCreator = conduct.createdBy.toString() === req.user.id;
    const isClassAdmin = teacher.adminClassId && 
                        teacher.adminClassId.toString() === conduct.classId.toString();

    if (!isCreator && !isClassAdmin) {
      return res.status(403).json({ msg: 'Only the original creator or class admin can delete this record' });
    }

    // Permanently delete the conduct record from database
    const deletedConduct = await Conduct.findByIdAndDelete(conductId);

    if (!deletedConduct) {
      return res.status(404).json({ msg: 'Failed to delete conduct record' });
    }

    console.log('Conduct record permanently deleted from database:', conductId);

    res.json({
      msg: 'Conduct record permanently deleted from database',
      deletedConductId: conductId,
      deletedAt: new Date()
    });

  } catch (err) {
    console.error('Error in deleteConduct:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid conduct ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = exports;