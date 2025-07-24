// controllers/submissionController.js
const Submission = require('../models/Submission');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit'); // For PDF compression if needed

// Helper function to compress PDF (basic implementation)
const compressPDF = (pdfBuffer) => {
  // This is a basic implementation. For production, consider using libraries like:
  // - pdf2pic + sharp for image compression
  // - pdf-lib for PDF manipulation
  // - ghostscript wrapper for better compression
  
  // For now, we'll just return the original buffer
  // You can implement more sophisticated compression here
  return pdfBuffer;
};

// Helper function to verify student belongs to class
const verifyStudentClass = async (studentId, classId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    return { authorized: false, error: 'Student not found' };
  }

  if (!student.classId || student.classId.toString() !== classId.toString()) {
    return { authorized: false, error: 'Student not enrolled in this class' };
  }

  return { authorized: true, student };
};

// Helper function to verify teacher assignment to subject
const verifyTeacherSubject = async (teacherId, classId, subjectId) => {
  const subjectDoc = await Subject.findOne({ classId });
  if (!subjectDoc) {
    return { authorized: false, error: 'No subjects found for this class' };
  }

  const subject = subjectDoc.subjects.id(subjectId);
  if (!subject) {
    return { authorized: false, error: 'Subject not found' };
  }

  if (!subject.teacherId || subject.teacherId.toString() !== teacherId.toString()) {
    return { authorized: false, error: 'Teacher not assigned to this subject' };
  }

  return { authorized: true, subject };
};

// Create new submission (Student only)
exports.createSubmission = async (req, res) => {
  try {
    const { title, classId, subjectId } = req.body;
    const studentId = req.user.id;

    console.log('createSubmission called:', { title, classId, subjectId, studentId });

    // Validate required fields
    if (!title || !classId || !subjectId) {
      return res.status(400).json({ msg: 'Title, class ID, and subject ID are required' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ msg: 'PDF file is required' });
    }

    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ msg: 'Only PDF files are allowed' });
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ msg: 'File size must be less than 10MB' });
    }

    // Verify student belongs to the class
    const studentCheck = await verifyStudentClass(studentId, classId);
    if (!studentCheck.authorized) {
      return res.status(403).json({ msg: studentCheck.error });
    }

    // Get subject document and find the specific subject
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    const subject = subjectDoc.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    if (!subject.teacherId) {
      return res.status(400).json({ msg: 'No teacher assigned to this subject yet' });
    }

    // Compress PDF
    const compressedPDF = compressPDF(req.file.buffer);

    // Create submission
    const submission = new Submission({
      title: title.trim(),
      studentId,
      schoolId: studentCheck.student.schoolId,
      classId,
      subjectId,
      teacherId: subject.teacherId,
      pdfData: compressedPDF,
      pdfSize: compressedPDF.length,
      originalFileName: req.file.originalname,
      mimeType: req.file.mimetype
    });

    await submission.save();

    // Return submission without PDF data
    const submissionResponse = await Submission.findById(submission._id)
      .select('-pdfData')
      .populate('teacherId', 'name email')
      .populate('classId', 'name section');

    console.log('Submission created successfully:', submission._id);

    res.status(201).json({
      msg: 'Submission created successfully',
      submission: {
        ...submissionResponse.toObject(),
        subjectName: subject.name,
        subjectCode: subject.code
      }
    });

  } catch (err) {
    console.error('Error in createSubmission:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get student's submissions (Student only)
exports.getStudentSubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    console.log('getStudentSubmissions called:', { studentId, status, page, limit });

    // Build filter
    const filter = { studentId };
    if (status) filter.status = status;

    // Get submissions with pagination
    const skip = (page - 1) * limit;
    const submissions = await Submission.find(filter)
      .select('-pdfData')
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Submission.countDocuments(filter);

    // Get subject details for each submission
    const submissionsWithSubjects = await Promise.all(
      submissions.map(async (submission) => {
        const subjectDoc = await Subject.findOne({ classId: submission.classId });
        const subject = subjectDoc ? subjectDoc.subjects.id(submission.subjectId) : null;
        
        return {
          ...submission.toObject(),
          subjectName: subject ? subject.name : 'Unknown Subject',
          subjectCode: subject ? subject.code : 'N/A'
        };
      })
    );

    console.log('Student submissions retrieved:', submissions.length);

    res.json({
      submissions: submissionsWithSubjects,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (err) {
    console.error('Error in getStudentSubmissions:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get teacher's submissions (Teacher only)
exports.getTeacherSubmissions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { status, classId, subjectId, page = 1, limit = 10 } = req.query;

    console.log('getTeacherSubmissions called:', { teacherId, status, classId, subjectId });

    // Build filter
    const filter = { teacherId };
    if (status) filter.status = status;
    if (classId) filter.classId = classId;
    if (subjectId) filter.subjectId = subjectId;

    // Get submissions with pagination
    const skip = (page - 1) * limit;
    const submissions = await Submission.find(filter)
      .select('-pdfData')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Submission.countDocuments(filter);

    // Get subject details for each submission
    const submissionsWithSubjects = await Promise.all(
      submissions.map(async (submission) => {
        const subjectDoc = await Subject.findOne({ classId: submission.classId });
        const subject = subjectDoc ? subjectDoc.subjects.id(submission.subjectId) : null;
        
        return {
          ...submission.toObject(),
          subjectName: subject ? subject.name : 'Unknown Subject',
          subjectCode: subject ? subject.code : 'N/A'
        };
      })
    );

    console.log('Teacher submissions retrieved:', submissions.length);

    res.json({
      submissions: submissionsWithSubjects,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (err) {
    console.error('Error in getTeacherSubmissions:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get submission by ID (Student can see own, Teacher can see assigned)
exports.getSubmissionById = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('getSubmissionById called:', { submissionId, userId, userRole });

    const submission = await Submission.findById(submissionId)
      .select('-pdfData') // Exclude PDF data by default
      .populate('studentId', 'name email studentId')
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .populate('schoolId', 'name');

    if (!submission) {
      return res.status(404).json({ msg: 'Submission not found' });
    }

    // Authorization check
    if (userRole === 'student' && submission.studentId._id.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to view this submission' });
    }

    if (userRole === 'teacher' && submission.teacherId._id.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to view this submission' });
    }

    // Get subject details
    const subjectDoc = await Subject.findOne({ classId: submission.classId });
    const subject = subjectDoc ? subjectDoc.subjects.id(submission.subjectId) : null;

    const submissionWithSubject = {
      ...submission.toObject(),
      subjectName: subject ? subject.name : 'Unknown Subject',
      subjectCode: subject ? subject.code : 'N/A'
    };

    res.json({ submission: submissionWithSubject });

  } catch (err) {
    console.error('Error in getSubmissionById:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid submission ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Download PDF (Student can download own, Teacher can download assigned)
exports.downloadPDF = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('downloadPDF called:', { submissionId, userId, userRole });

    const submission = await Submission.findById(submissionId)
      .populate('studentId', 'name email studentId')
      .populate('teacherId', 'name email');

    if (!submission) {
      return res.status(404).json({ msg: 'Submission not found' });
    }

    // Authorization check
    if (userRole === 'student' && submission.studentId._id.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to download this file' });
    }

    if (userRole === 'teacher' && submission.teacherId._id.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to download this file' });
    }

    // Set response headers
    res.setHeader('Content-Type', submission.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${submission.originalFileName}"`);
    res.setHeader('Content-Length', submission.pdfSize);

    // Send PDF data
    res.send(submission.pdfData);

  } catch (err) {
    console.error('Error in downloadPDF:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid submission ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update submission status (Teacher only)
exports.updateSubmissionStatus = async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { status, feedback, grade } = req.body;
    const teacherId = req.user.id;

    console.log('updateSubmissionStatus called:', { submissionId, status, teacherId });

    // Validate status
    const validStatuses = ['submitted', 'reviewed', 'graded', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).json({ msg: 'Submission not found' });
    }

    // Verify teacher is assigned to this submission
    if (submission.teacherId.toString() !== teacherId) {
      return res.status(403).json({ msg: 'Not authorized to update this submission' });
    }

    // Update submission
    await submission.updateStatus(status, feedback, grade);

    // Get updated submission
    const updatedSubmission = await Submission.findById(submissionId)
      .select('-pdfData')
      .populate('studentId', 'name email studentId')
      .populate('teacherId', 'name email')
      .populate('classId', 'name section');

    console.log('Submission status updated successfully:', submissionId);

    res.json({
      msg: 'Submission status updated successfully',
      submission: updatedSubmission
    });

  } catch (err) {
    console.error('Error in updateSubmissionStatus:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid submission ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get available subjects for student submission
exports.getAvailableSubjects = async (req, res) => {
  try {
    const studentId = req.user.id;

    console.log('getAvailableSubjects called:', { studentId });

    // Find student to get their class
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    if (!student.classId) {
      return res.status(400).json({ msg: 'Student not assigned to any class' });
    }

    // Get subjects for student's class
    const subjectDoc = await Subject.findOne({ classId: student.classId })
      .populate('subjects.teacherId', 'name email');

    if (!subjectDoc) {
      return res.json({ subjects: [] });
    }

    // Filter active subjects with assigned teachers
    const availableSubjects = subjectDoc.subjects
      .filter(subject => subject.isActive && subject.teacherId)
      .map(subject => ({
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        teacher: {
          id: subject.teacherId._id,
          name: subject.teacherId.name,
          email: subject.teacherId.email
        }
      }));

    console.log('Available subjects retrieved:', availableSubjects.length);

    res.json({
      subjects: availableSubjects,
      classInfo: {
        id: student.classId,
        name: student.className,
        section: student.section
      }
    });

  } catch (err) {
    console.error('Error in getAvailableSubjects:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get submission statistics for teacher
exports.getSubmissionStats = async (req, res) => {
  try {
    const teacherId = req.user.id;

    console.log('getSubmissionStats called:', { teacherId });

    const stats = await Submission.getStats(teacherId);

    // Format stats
    const formattedStats = {
      submitted: 0,
      reviewed: 0,
      graded: 0,
      returned: 0,
      total: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    res.json({ stats: formattedStats });

  } catch (err) {
    console.error('Error in getSubmissionStats:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = {
  createSubmission: exports.createSubmission,
  getStudentSubmissions: exports.getStudentSubmissions,
  getTeacherSubmissions: exports.getTeacherSubmissions,
  getSubmissionById: exports.getSubmissionById,
  downloadPDF: exports.downloadPDF,
  updateSubmissionStatus: exports.updateSubmissionStatus,
  getAvailableSubjects: exports.getAvailableSubjects,
  getSubmissionStats: exports.getSubmissionStats
};