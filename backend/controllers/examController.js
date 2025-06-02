// controllers/examController.js
const Exam = require('../models/Exam');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const markController = require('./markController'); // Add this import
const mongoose = require('mongoose');

// Helper function to verify class admin permissions
const verifyClassAdmin = async (userId, classId) => {
  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    return { authorized: false, error: 'Teacher not found' };
  }

  if (!teacher.adminClassId || teacher.adminClassId.toString() !== classId.toString()) {
    return { authorized: false, error: 'Not authorized as class admin for this class' };
  }

  const classObj = await Class.findById(classId);
  if (!classObj) {
    return { authorized: false, error: 'Class not found' };
  }

  return { authorized: true, teacher, classObj };
};

// Create a new exam (class admin only)
exports.createExam = async (req, res) => {
  try {
    const { classId } = req.params;
    const { examName, examCode, examDate, duration, subjects } = req.body;

    console.log('createExam called:', { classId, examName, userId: req.user.id });

    // Validate required fields
    if (!examName || !examCode || !examDate || !duration || !subjects || subjects.length === 0) {
      return res.status(400).json({ msg: 'All fields are required and at least one subject must be added' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Check if exam with same name already exists in this class
    const existingExam = await Exam.findOne({ 
      classId, 
      examName: examName.trim(),
      isActive: true 
    });

    if (existingExam) {
      return res.status(400).json({ msg: 'Exam with this name already exists in this class' });
    }

    // Check if exam code already exists in this class
    const existingCode = await Exam.findOne({ 
      classId, 
      examCode: examCode.trim().toUpperCase(),
      isActive: true 
    });

    if (existingCode) {
      return res.status(400).json({ msg: 'Exam with this code already exists in this class' });
    }

    // Create new exam
    const newExam = new Exam({
      classId,
      schoolId: teacher.schoolId,
      classAdminId: teacher._id,
      examName: examName.trim(),
      examCode: examCode.trim().toUpperCase(),
      examDate: new Date(examDate),
      duration,
      subjects: subjects.map(sub => ({
        subjectId: sub.subjectId,
        subjectName: sub.subjectName,
        teacherId: sub.teacherId,
        credits: sub.credits,
        fullMarks: sub.fullMarks
      }))
    });

    await newExam.save();

    // CRITICAL: Initialize mark records for all students in the class
    try {
      const markInitResult = await markController.initializeExamMarks(newExam._id);
      console.log('Mark records initialized:', markInitResult);
    } catch (markError) {
      console.error('Error initializing marks:', markError);
      // You might want to delete the exam if mark initialization fails
      await Exam.findByIdAndDelete(newExam._id);
      return res.status(500).json({ 
        msg: 'Exam created but failed to initialize mark records. Exam has been rolled back.',
        error: markError.message 
      });
    }

    // Get populated exam data
    const populatedExam = await Exam.findById(newExam._id)
      .populate('subjects.teacherId', 'name email')
      .populate('classAdminId', 'name email');

    console.log('Exam created successfully:', newExam._id);

    res.status(201).json({
      msg: 'Exam created successfully',
      exam: populatedExam,
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in createExam:', err);
    
    if (err.message.includes('Duplicate')) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get all exams for a class (class admin only)
exports.getExamsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('getExamsByClass called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get exams for this class
    const exams = await Exam.getByClassWithTeachers(classId);

    console.log('Exams retrieved:', exams.length);

    res.json({
      exams: exams,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      },
      totalExams: exams.length
    });

  } catch (err) {
    console.error('Error in getExamsByClass:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get a specific exam (class admin only)
exports.getExamById = async (req, res) => {
  try {
    const { classId, examId } = req.params;

    console.log('getExamById called:', { classId, examId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find exam
    const exam = await Exam.findOne({ _id: examId, classId })
      .populate('subjects.teacherId', 'name email')
      .populate('classAdminId', 'name email');

    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    res.json({
      exam: exam,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      }
    });

  } catch (err) {
    console.error('Error in getExamById:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid exam ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update an exam (class admin only)
exports.updateExam = async (req, res) => {
  try {
    const { classId, examId } = req.params;
    const { examName, examCode, examDate, duration, isActive } = req.body;

    console.log('updateExam called:', { classId, examId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find exam
    const exam = await Exam.findOne({ _id: examId, classId });
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    // Check for duplicate name (if being updated)
    if (examName && examName.trim() !== exam.examName) {
      const existingExam = await Exam.findOne({ 
        _id: { $ne: examId },
        classId, 
        examName: examName.trim(),
        isActive: true 
      });
      if (existingExam) {
        return res.status(400).json({ msg: 'Exam name already exists in this class' });
      }
    }

    // Check for duplicate code (if being updated)
    if (examCode && examCode.trim().toUpperCase() !== exam.examCode) {
      const existingCode = await Exam.findOne({ 
        _id: { $ne: examId },
        classId, 
        examCode: examCode.trim().toUpperCase(),
        isActive: true 
      });
      if (existingCode) {
        return res.status(400).json({ msg: 'Exam code already exists in this class' });
      }
    }

    // Prepare update data
    const updateData = {};
    if (examName) updateData.examName = examName.trim();
    if (examCode) updateData.examCode = examCode.trim().toUpperCase();
    if (examDate) updateData.examDate = new Date(examDate);
    if (duration) updateData.duration = duration;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update exam
    await exam.updateExam(updateData);

    // Get updated exam with populated data
    const updatedExam = await Exam.findById(examId)
      .populate('subjects.teacherId', 'name email')
      .populate('classAdminId', 'name email');

    console.log('Exam updated successfully:', examId);

    res.json({
      msg: 'Exam updated successfully',
      exam: updatedExam
    });

  } catch (err) {
    console.error('Error in updateExam:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid exam ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Delete an exam (class admin only)
exports.deleteExam = async (req, res) => {
  try {
    const { classId, examId } = req.params;

    console.log('deleteExam called:', { classId, examId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find and delete exam
    const exam = await Exam.findOneAndDelete({ _id: examId, classId });
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    // TODO: Consider whether to also delete associated mark records
    // This depends on your business logic - you might want to keep historical data
    // or implement soft deletion instead

    console.log('Exam deleted successfully:', examId);

    res.json({
      msg: `Exam "${exam.examName}" deleted successfully`,
      deletedExamId: examId
    });

  } catch (err) {
    console.error('Error in deleteExam:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid exam ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Add subjects to an exam (class admin only)
exports.addSubjectsToExam = async (req, res) => {
  try {
    const { classId, examId } = req.params;
    const { subjects } = req.body;

    console.log('addSubjectsToExam called:', { classId, examId, userId: req.user.id });

    // Validate required fields
    if (!subjects || subjects.length === 0) {
      return res.status(400).json({ msg: 'At least one subject is required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find exam
    const exam = await Exam.findOne({ _id: examId, classId });
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    // Add subjects to exam
    await exam.addSubjects(subjects);

    // IMPORTANT: Re-initialize mark records to include new subjects
    try {
      await markController.initializeExamMarks(examId);
      console.log('Mark records updated with new subjects');
    } catch (markError) {
      console.error('Error updating marks with new subjects:', markError);
      // Log the error but don't fail the request since exam was already updated
    }

    // Get updated exam with populated data
    const updatedExam = await Exam.findById(examId)
      .populate('subjects.teacherId', 'name email')
      .populate('classAdminId', 'name email');

    console.log('Subjects added to exam successfully');

    res.json({
      msg: 'Subjects added to exam successfully',
      exam: updatedExam,
      totalSubjects: updatedExam.subjects.length
    });

  } catch (err) {
    console.error('Error in addSubjectsToExam:', err);
    
    if (err.message.includes('already added')) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Remove a subject from exam (class admin only)
exports.removeSubjectFromExam = async (req, res) => {
  try {
    const { classId, examId, subjectId } = req.params;

    console.log('removeSubjectFromExam called:', { classId, examId, subjectId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find exam
    const exam = await Exam.findOne({ _id: examId, classId });
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    // Find subject in exam
    const subject = exam.subjects.find(sub => sub.subjectId.toString() === subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found in this exam' });
    }

    const subjectName = subject.subjectName;

    // Remove subject from exam
    await exam.removeSubject(subjectId);

    // TODO: Consider updating mark records to remove the subject
    // This depends on your business logic - you might want to keep historical data

    console.log('Subject removed from exam successfully');

    res.json({
      msg: `Subject "${subjectName}" removed from exam successfully`,
      removedSubjectId: subjectId,
      remainingSubjects: exam.subjects.length
    });

  } catch (err) {
    console.error('Error in removeSubjectFromExam:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get exams assigned to a teacher (for teachers to see their exam schedule)
exports.getExamsByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    console.log('getExamsByTeacher called:', { teacherId });

    // Verify teacher exists
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Get all exams where this teacher has subjects
    const exams = await Exam.getByTeacher(teacherId);

    // Filter and format exam data for teacher view
    const teacherExams = exams.map(exam => {
      const teacherSubjects = exam.subjects.filter(
        sub => sub.teacherId.toString() === teacherId
      );

      return {
        _id: exam._id,
        examName: exam.examName,
        examCode: exam.examCode,
        examDate: exam.examDate,
        duration: exam.duration,
        isActive: exam.isActive,
        classInfo: {
          id: exam.classId._id,
          name: exam.classId.name,
          section: exam.classId.section
        },
        classAdmin: {
          id: exam.classAdminId._id,
          name: exam.classAdminId.name,
          email: exam.classAdminId.email
        },
        mySubjects: teacherSubjects,
        totalSubjects: exam.subjects.length
      };
    });

    console.log('Teacher exams retrieved:', teacherExams.length);

    res.json({
      exams: teacherExams,
      totalExams: teacherExams.length,
      teacherInfo: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      }
    });

  } catch (err) {
    console.error('Error in getExamsByTeacher:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = exports;