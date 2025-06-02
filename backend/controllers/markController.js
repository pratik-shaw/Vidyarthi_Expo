// controllers/markController.js
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const mongoose = require('mongoose');

// Helper function to verify teacher permissions
const verifyTeacherAccess = async (userId, classId) => {
  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    return { authorized: false, error: 'Teacher not found' };
  }

  // Check if teacher is class admin or teaches in this class
  const classObj = await Class.findById(classId);
  if (!classObj) {
    return { authorized: false, error: 'Class not found' };
  }

  const isClassAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId.toString();
  const isClassTeacher = classObj.teacherIds.includes(teacher._id);

  if (!isClassAdmin && !isClassTeacher) {
    return { authorized: false, error: 'Not authorized to access this class' };
  }

  return { authorized: true, teacher, classObj };
};

// Initialize marks for an exam (called when exam is created)
exports.initializeExamMarks = async (examId) => {
  try {
    const exam = await Exam.findById(examId);
    if (!exam) {
      throw new Error('Exam not found');
    }

    // Get all students in the class
    const students = await Student.find({ classId: exam.classId, isActive: true });

    // Create mark records for all students
    const promises = students.map(student => 
      Mark.createFromExam(exam, student._id)
    );

    await Promise.all(promises);
    console.log(`Marks initialized for ${students.length} students for exam: ${exam.examName}`);
    
    return { success: true, studentsCount: students.length };
  } catch (err) {
    console.error('Error initializing exam marks:', err);
    throw err;
  }
};

// Get students and their marks for subjects taught by the teacher
// Fixed getStudentsForScoring function
exports.getStudentsForScoring = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    console.log('getStudentsForScoring called:', { classId, teacherId });

    // Verify teacher access
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get all students in the class
    const classObj = await Class.findById(classId).populate('studentIds');
    if (!classObj || !classObj.studentIds || classObj.studentIds.length === 0) {
      console.log('No students found in class');
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        totalStudents: 0
      });
    }

    // Get all exams for this class
    const exams = await Exam.find({ classId: classId });
    console.log('Exams found for class:', exams.length);

    if (exams.length === 0) {
      console.log('No exams found for class');
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        totalStudents: 0,
        message: 'No exams created for this class yet'
      });
    }

    // Filter exams to only include subjects this teacher can score
    const filteredExams = exams.map(exam => {
      const teacherSubjects = exam.subjects.filter(
        subject => subject.teacherId.toString() === teacherId
      );
      
      if (teacherSubjects.length === 0) {
        return null;
      }

      return {
        examId: exam._id,
        examName: exam.examName,
        examCode: exam.examCode,
        examDate: exam.examDate,
        subjects: teacherSubjects
      };
    }).filter(exam => exam !== null);

    console.log('Filtered exams for teacher:', filteredExams.length);

    if (filteredExams.length === 0) {
      console.log('No exams with teacher subjects found');
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        totalStudents: 0,
        message: 'No subjects assigned to you in any exams for this class'
      });
    }

    // Now build student data with marks (if they exist)
    const studentsData = [];

    for (const studentInfo of classObj.studentIds) {
      // Try to find existing mark record for this student
      let markRecord = await Mark.findOne({
        studentId: studentInfo._id || studentInfo.studentId,
        classId: classId
      });

      // If no mark record exists, create a temporary structure
      if (!markRecord) {
        console.log(`No mark record found for student ${studentInfo.name}, creating temporary structure`);
        
        const studentExams = filteredExams.map(exam => ({
          examId: exam.examId,
          examName: exam.examName,
          examCode: exam.examCode,
          examDate: exam.examDate,
          subjects: exam.subjects.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            teacherId: subject.teacherId,
            fullMarks: subject.fullMarks,
            marksScored: null, // Not scored yet
            scoredBy: null,
            scoredAt: null
          }))
        }));

        studentsData.push({
          studentId: studentInfo._id || studentInfo.studentId,
          studentName: studentInfo.name,
          studentNumber: studentInfo.studentId,
          exams: studentExams
        });
      } else {
        // Use existing mark record data
        const filteredExamData = markRecord.exams.map(exam => {
          const teacherSubjects = exam.subjects.filter(
            subject => subject.teacherId.toString() === teacherId
          );
          
          if (teacherSubjects.length === 0) {
            return null;
          }

          return {
            examId: exam.examId,
            examName: exam.examName,
            examCode: exam.examCode,
            examDate: exam.examDate,
            subjects: teacherSubjects
          };
        }).filter(exam => exam !== null);

        if (filteredExamData.length > 0) {
          studentsData.push({
            studentId: markRecord.studentId,
            studentName: studentInfo.name,
            studentNumber: studentInfo.studentId,
            exams: filteredExamData
          });
        }
      }
    }

    console.log('Students data retrieved:', studentsData.length);

    res.json({
      students: studentsData,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      },
      teacherInfo: {
        id: authCheck.teacher._id,
        name: authCheck.teacher.name
      },
      totalStudents: studentsData.length
    });

  } catch (err) {
    console.error('Error in getStudentsForScoring:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Submit marks for a student's subject
exports.submitMarks = async (req, res) => {
  try {
    const { classId, studentId, examId, subjectId } = req.params;
    const { marksScored } = req.body;
    const teacherId = req.user.id;

    console.log('submitMarks called:', { classId, studentId, examId, subjectId, marksScored, teacherId });

    // Validate input
    if (marksScored === undefined || marksScored === null) {
      return res.status(400).json({ msg: 'Marks scored is required' });
    }

    if (marksScored < 0) {
      return res.status(400).json({ msg: 'Marks cannot be negative' });
    }

    // Verify teacher access
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find student's mark record
    const markRecord = await Mark.findOne({
      studentId: studentId,
      classId: classId
    });

    if (!markRecord) {
      return res.status(404).json({ msg: 'Mark record not found for this student' });
    }

    // Update marks
    await markRecord.updateSubjectMarks(examId, subjectId, marksScored, teacherId);

    // Get updated record with populated data
    const updatedRecord = await Mark.findById(markRecord._id)
      .populate('studentId', 'name studentId')
      .populate('exams.subjects.teacherId', 'name email')
      .populate('exams.subjects.scoredBy', 'name email');

    console.log('Marks submitted successfully');

    res.json({
      msg: 'Marks submitted successfully',
      studentName: updatedRecord.studentId.name,
      marksScored: marksScored,
      updatedAt: new Date()
    });

  } catch (err) {
    console.error('Error in submitMarks:', err);
    
    if (err.message.includes('Not authorized') || err.message.includes('not found')) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get detailed marks for a specific student (for class admin)
exports.getStudentDetailedMarks = async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const teacherId = req.user.id;

    console.log('getStudentDetailedMarks called:', { classId, studentId, teacherId });

    // Verify teacher access
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get student's complete mark record
    const markRecord = await Mark.getStudentMarks(studentId, classId);

    if (!markRecord) {
      return res.status(404).json({ msg: 'No marks found for this student' });
    }

    // Calculate totals and percentages for each exam
    const processedExams = markRecord.exams.map(exam => {
      let totalMarksScored = 0;
      let totalFullMarks = 0;
      let completedSubjects = 0;

      exam.subjects.forEach(subject => {
        totalFullMarks += subject.fullMarks;
        if (subject.marksScored !== null) {
          totalMarksScored += subject.marksScored;
          completedSubjects++;
        }
      });

      const percentage = totalFullMarks > 0 ? ((totalMarksScored / totalFullMarks) * 100).toFixed(2) : 0;
      const isCompleted = completedSubjects === exam.subjects.length;

      return {
        ...exam.toObject(),
        totalMarksScored,
        totalFullMarks,
        percentage: parseFloat(percentage),
        completedSubjects,
        totalSubjects: exam.subjects.length,
        isCompleted
      };
    });

    console.log('Student detailed marks retrieved');

    res.json({
      studentInfo: {
        id: markRecord.studentId,
        name: markRecord.studentId.name || 'Unknown',
        studentNumber: markRecord.studentId.studentId || 'Unknown'
      },
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      },
      exams: processedExams,
      totalExams: processedExams.length
    });

  } catch (err) {
    console.error('Error in getStudentDetailedMarks:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get class-wise marks summary (for class admin)
exports.getClassMarksSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    console.log('getClassMarksSummary called:', { classId, teacherId });

    // Verify teacher is class admin
    const teacher = await Teacher.findById(teacherId);
    if (!teacher || !teacher.adminClassId || teacher.adminClassId.toString() !== classId.toString()) {
      return res.status(403).json({ msg: 'Not authorized as class admin for this class' });
    }

    // Get all mark records for this class
    const markRecords = await Mark.find({ classId })
      .populate('studentId', 'name studentId')
      .sort({ 'studentId.name': 1 });

    // Process summary data
    const classData = markRecords.map(record => {
      const studentSummary = {
        studentId: record.studentId._id,
        studentName: record.studentId.name,
        studentNumber: record.studentId.studentId,
        exams: []
      };

      record.exams.forEach(exam => {
        let totalMarksScored = 0;
        let totalFullMarks = 0;
        let completedSubjects = 0;

        exam.subjects.forEach(subject => {
          totalFullMarks += subject.fullMarks;
          if (subject.marksScored !== null) {
            totalMarksScored += subject.marksScored;
            completedSubjects++;
          }
        });

        const percentage = totalFullMarks > 0 ? ((totalMarksScored / totalFullMarks) * 100).toFixed(2) : 0;

        studentSummary.exams.push({
          examId: exam.examId,
          examName: exam.examName,
          examCode: exam.examCode,
          examDate: exam.examDate,
          totalMarksScored,
          totalFullMarks,
          percentage: parseFloat(percentage),
          completedSubjects,
          totalSubjects: exam.subjects.length,
          isCompleted: completedSubjects === exam.subjects.length
        });
      });

      return studentSummary;
    });

    console.log('Class marks summary retrieved:', classData.length);

    res.json({
      classInfo: {
        id: classId,
        name: teacher.adminClassName || 'Unknown',
        section: teacher.adminClassSection || 'Unknown'
      },
      students: classData,
      totalStudents: classData.length
    });

  } catch (err) {
    console.error('Error in getClassMarksSummary:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = exports;