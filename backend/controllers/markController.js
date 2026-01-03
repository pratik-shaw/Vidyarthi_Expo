// controllers/markController.js
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
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

    // SYNC CHECK: Get current subject assignments for validation
    const subjectDoc = await Subject.findOne({ classId });
    const activeSubjectTeacherMap = new Map();
    
    if (subjectDoc) {
      subjectDoc.subjects.forEach(subject => {
        if (subject.teacherId) {
          activeSubjectTeacherMap.set(subject._id.toString(), subject.teacherId.toString());
        }
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

    // Filter exams to only include subjects this teacher can score (with sync validation)
    const filteredExams = exams.map(exam => {
      const teacherSubjects = exam.subjects.filter(subject => {
        const currentTeacherId = activeSubjectTeacherMap.get(subject.subjectId.toString());
        // Only include if teacher is currently assigned to this subject
        return currentTeacherId === teacherId;
      });
      
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
            marksScored: null,
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
        // Use existing mark record data but validate against current assignments
        const filteredExamData = markRecord.exams.map(exam => {
          const teacherSubjects = exam.subjects.filter(subject => {
            const currentTeacherId = activeSubjectTeacherMap.get(subject.subjectId.toString());
            return currentTeacherId === teacherId;
          });
          
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
// Modified submitMarks function in controllers/markController.js
// Replace the existing submitMarks function with this updated version

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

    // VALIDATION: Check if teacher is currently assigned to this subject
    const subjectDoc = await Subject.findOne({ classId });
    if (subjectDoc) {
      const subject = subjectDoc.subjects.find(sub => sub._id.toString() === subjectId);
      if (!subject || !subject.teacherId || subject.teacherId.toString() !== teacherId) {
        return res.status(403).json({ msg: 'You are not currently assigned to this subject' });
      }
    }

    // Verify student exists and belongs to this class
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }
    
    if (student.classId.toString() !== classId) {
      return res.status(400).json({ msg: 'Student does not belong to this class' });
    }

    // Verify exam exists and belongs to this class
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }
    
    if (exam.classId.toString() !== classId) {
      return res.status(400).json({ msg: 'Exam does not belong to this class' });
    }

    // Verify the subject exists in the exam and get full marks
    const examSubject = exam.subjects.find(sub => sub.subjectId.toString() === subjectId);
    if (!examSubject) {
      return res.status(404).json({ msg: 'Subject not found in this exam' });
    }

    // Validate marks don't exceed full marks
    if (marksScored > examSubject.fullMarks) {
      return res.status(400).json({ 
        msg: `Marks cannot exceed full marks of ${examSubject.fullMarks}` 
      });
    }

    // Find or create student's mark record
    let markRecord = await Mark.findOne({
      studentId: studentId,
      classId: classId
    });

    // 🔥 FIX: If mark record doesn't exist, create it with all existing exams
    if (!markRecord) {
      console.log(`Mark record not found for student ${studentId}. Creating new record...`);
      
      // Get class details to find the class admin
      const classObj = await Class.findById(classId);
      if (!classObj) {
        return res.status(404).json({ msg: 'Class not found' });
      }
      
      console.log('Class object:', classObj);
      
      // Find class admin - check multiple possible field names
      let classAdminId = classObj.classAdminId || classObj.classTeacherId || classObj.adminId;
      
      // If still not found, try to find a teacher who is admin of this class
      if (!classAdminId) {
        const adminTeacher = await Teacher.findOne({ adminClassId: classId });
        if (adminTeacher) {
          classAdminId = adminTeacher._id;
          console.log('Found class admin via Teacher model:', classAdminId);
        }
      }
      
      // If still not found, use the exam's class admin
      if (!classAdminId && exam.classAdminId) {
        classAdminId = exam.classAdminId;
        console.log('Using exam classAdminId:', classAdminId);
      }
      
      if (!classAdminId) {
        console.error('Could not find classAdminId. Class fields:', Object.keys(classObj.toObject()));
        return res.status(500).json({ 
          msg: 'Could not determine class admin. Please contact administrator.' 
        });
      }
      
      console.log('Using classAdminId:', classAdminId);
      
      // Get all exams for this class
      const allExams = await Exam.find({ classId: classId });
      
      // Create mark record with all exams
      markRecord = new Mark({
        studentId: studentId,
        classId: classId,
        schoolId: exam.schoolId,
        classAdminId: classAdminId, // Required field
        exams: allExams.map(examDoc => ({
          examId: examDoc._id,
          examName: examDoc.examName,
          examCode: examDoc.examCode,
          examDate: examDoc.examDate,
          subjects: examDoc.subjects.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            teacherId: subject.teacherId,
            fullMarks: subject.fullMarks,
            marksScored: null,
            scoredBy: null,
            scoredAt: null
          }))
        }))
      });
      
      await markRecord.save();
      console.log(`Mark record created successfully for student ${studentId}`);
    } else {
      // 🔥 FIX: If mark record exists but doesn't have this exam, add it
      const examExists = markRecord.exams.find(e => e.examId.toString() === examId);
      
      if (!examExists) {
        console.log(`Exam ${examId} not found in student's mark record. Adding it...`);
        
        markRecord.exams.push({
          examId: exam._id,
          examName: exam.examName,
          examCode: exam.examCode,
          examDate: exam.examDate,
          subjects: exam.subjects.map(subject => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            teacherId: subject.teacherId,
            fullMarks: subject.fullMarks,
            marksScored: null,
            scoredBy: null,
            scoredAt: null
          }))
        });
        
        await markRecord.save();
        console.log(`Exam ${examId} added to student's mark record`);
      }
    }

    // Now update the marks
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

// Add this to controllers/markController.js
// Add this new method to your markController.js

// Get subject-wise marks report for a teacher
// Get subject-wise marks report for a teacher
exports.getTeacherSubjectReport = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    console.log('getTeacherSubjectReport called:', { classId, teacherId });

    // Verify teacher access
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get class details with section
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    // Get current subject assignments to validate teacher's subjects
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Get subjects taught by this teacher
    const teacherSubjects = subjectDoc.subjects.filter(subject => 
      subject.teacherId && subject.teacherId.toString() === teacherId
    );

    if (teacherSubjects.length === 0) {
      return res.json({
        classInfo: {
          id: classObj._id,
          name: classObj.name,
          section: classObj.section || ''
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        subjects: [],
        message: 'No subjects assigned to you in this class'
      });
    }

    // Get all mark records for this class
    const markRecords = await Mark.find({ classId })
      .populate('studentId', 'name studentId')
      .sort({ 'studentId.name': 1 });

    // Process data for each subject taught by the teacher
    const subjectReports = teacherSubjects.map(subject => {
      const subjectData = {
        subjectId: subject._id,
        subjectName: subject.name || subject.subjectName || 'Unknown Subject',
        students: [],
        exams: [],
        summary: {
          totalStudents: 0,
          averagePerformance: 0,
          completionRate: 0,
          highestScore: 0,
          lowestScore: 100,
          passCount: 0,
          failCount: 0
        }
      };

      const examMap = new Map();
      const studentPerformanceMap = new Map();
      let totalScores = 0;
      let totalPossibleScores = 0;
      let completedAssessments = 0;
      let passCount = 0;
      let failCount = 0;

      // Process each student's marks for this subject
      markRecords.forEach(record => {
        const studentId = record.studentId._id.toString();
        const studentName = record.studentId.name;
        const studentNumber = record.studentId.studentId;

        if (!studentPerformanceMap.has(studentId)) {
          studentPerformanceMap.set(studentId, {
            studentId: studentId,
            studentName: studentName,
            studentNumber: studentNumber,
            exams: [],
            overallPerformance: {
              totalMarks: 0,
              totalFullMarks: 0,
              averagePercentage: 0,
              grade: 'N/A',
              completedExams: 0,
              totalExams: 0
            }
          });
        }

        const studentData = studentPerformanceMap.get(studentId);

        // Check each exam for this subject
        record.exams.forEach(exam => {
          const subjectMark = exam.subjects.find(sub => 
            sub.subjectId.toString() === subject._id.toString()
          );

          if (subjectMark) {
            // Track unique exams
            if (!examMap.has(exam.examId.toString())) {
              examMap.set(exam.examId.toString(), {
                examId: exam.examId,
                examName: exam.examName,
                examCode: exam.examCode,
                examDate: exam.examDate,
                fullMarks: subjectMark.fullMarks,
                studentsCompleted: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: subjectMark.fullMarks
              });
            }

            const examData = examMap.get(exam.examId.toString());
            studentData.overallPerformance.totalExams++;

            if (subjectMark.marksScored !== null) {
              const percentage = (subjectMark.marksScored / subjectMark.fullMarks) * 100;
              
              studentData.exams.push({
                examId: exam.examId,
                examName: exam.examName,
                examCode: exam.examCode,
                examDate: exam.examDate,
                marksScored: subjectMark.marksScored,
                fullMarks: subjectMark.fullMarks,
                percentage: percentage,
                grade: calculateGrade(percentage),
                scoredAt: subjectMark.scoredAt
              });

              // Update student overall performance
              studentData.overallPerformance.totalMarks += subjectMark.marksScored;
              studentData.overallPerformance.totalFullMarks += subjectMark.fullMarks;
              studentData.overallPerformance.completedExams++;

              // Update exam statistics
              examData.studentsCompleted++;
              examData.averageScore = (examData.averageScore * (examData.studentsCompleted - 1) + subjectMark.marksScored) / examData.studentsCompleted;
              examData.highestScore = Math.max(examData.highestScore, subjectMark.marksScored);
              examData.lowestScore = Math.min(examData.lowestScore, subjectMark.marksScored);

              // Update subject summary
              totalScores += subjectMark.marksScored;
              totalPossibleScores += subjectMark.fullMarks;
              completedAssessments++;

              // Track pass/fail (assuming 40% is pass)
              if (percentage >= 40) {
                passCount++;
              } else {
                failCount++;
              }

              // Update highest/lowest for subject
              subjectData.summary.highestScore = Math.max(subjectData.summary.highestScore, percentage);
              subjectData.summary.lowestScore = Math.min(subjectData.summary.lowestScore, percentage);
            }
          }
        });

        // Calculate student's overall performance for this subject
        if (studentData.overallPerformance.totalFullMarks > 0) {
          studentData.overallPerformance.averagePercentage = 
            (studentData.overallPerformance.totalMarks / studentData.overallPerformance.totalFullMarks) * 100;
          studentData.overallPerformance.grade = calculateGrade(studentData.overallPerformance.averagePercentage);
        }
      });

      // Finalize subject data
      subjectData.students = Array.from(studentPerformanceMap.values());
      subjectData.exams = Array.from(examMap.values());
      
      // Calculate subject summary
      subjectData.summary.totalStudents = subjectData.students.length;
      subjectData.summary.averagePerformance = totalPossibleScores > 0 ? 
        ((totalScores / totalPossibleScores) * 100).toFixed(2) : 0;
      subjectData.summary.completionRate = subjectData.students.length > 0 ? 
        ((completedAssessments / (subjectData.students.length * subjectData.exams.length)) * 100).toFixed(2) : 0;
      subjectData.summary.passCount = passCount;
      subjectData.summary.failCount = failCount;

      return subjectData;
    });

    console.log('Teacher subject report generated:', subjectReports.length, 'subjects');

    res.json({
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section || ''
      },
      teacherInfo: {
        id: authCheck.teacher._id,
        name: authCheck.teacher.name
      },
      subjects: subjectReports,
      totalSubjects: subjectReports.length
    });

  } catch (err) {
    console.error('Error in getTeacherSubjectReport:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get comprehensive academic data for a student
exports.getStudentAcademicReport = async (req, res) => {
  try {
    const studentId = req.user.id; // Get student ID from JWT token
    
    console.log('getStudentAcademicReport called for student:', studentId);

    // Get student details
    const student = await Student.findById(studentId).populate('classId');
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    const classId = student.classId._id;

    // Get student's mark record
    const markRecord = await Mark.findOne({
      studentId: studentId,
      classId: classId
    })
    .populate('exams.subjects.teacherId', 'name')
    .populate('exams.subjects.scoredBy', 'name');

    if (!markRecord || markRecord.exams.length === 0) {
      return res.json({
        studentInfo: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
          className: student.classId.name,
          section: student.classId.section
        },
        hasData: false,
        message: 'No academic records found',
        exams: [],
        summary: null
      });
    }

    // Process academic data
    const processedExams = [];
    const subjectPerformance = new Map();
    const examPerformance = [];
    
    let totalExams = 0;
    let completedExams = 0;
    let totalSubjects = 0;
    let completedSubjects = 0;
    let overallMarksScored = 0;
    let overallFullMarks = 0;

    // Process each exam
    markRecord.exams.forEach(exam => {
      let examMarksScored = 0;
      let examFullMarks = 0;
      let examCompletedSubjects = 0;

      const processedSubjects = exam.subjects.map(subject => {
        const isCompleted = subject.marksScored !== null;
        
        // Update subject performance tracking
        if (!subjectPerformance.has(subject.subjectName)) {
          subjectPerformance.set(subject.subjectName, {
            subjectName: subject.subjectName,
            totalMarks: 0,
            totalFullMarks: 0,
            examCount: 0,
            completedCount: 0,
            averagePercentage: 0,
            grades: []
          });
        }
        
        const subjectData = subjectPerformance.get(subject.subjectName);
        subjectData.examCount++;
        
        if (isCompleted) {
          subjectData.totalMarks += subject.marksScored;
          subjectData.completedCount++;
          examCompletedSubjects++;
          completedSubjects++;
          
          const percentage = (subject.marksScored / subject.fullMarks) * 100;
          subjectData.grades.push({
            examName: exam.examName,
            marks: subject.marksScored,
            fullMarks: subject.fullMarks,
            percentage: percentage,
            grade: calculateGrade(percentage)
          });
        }
        
        subjectData.totalFullMarks += subject.fullMarks;
        
        examFullMarks += subject.fullMarks;
        if (isCompleted) {
          examMarksScored += subject.marksScored;
        }
        totalSubjects++;

        return {
          subjectId: subject.subjectId,
          subjectName: subject.subjectName,
          teacherName: subject.teacherId ? subject.teacherId.name : 'Unknown',
          fullMarks: subject.fullMarks,
          marksScored: subject.marksScored,
          percentage: isCompleted ? ((subject.marksScored / subject.fullMarks) * 100).toFixed(2) : null,
          grade: isCompleted ? calculateGrade((subject.marksScored / subject.fullMarks) * 100) : null,
          isCompleted: isCompleted,
          scoredBy: subject.scoredBy ? subject.scoredBy.name : null,
          scoredAt: subject.scoredAt
        };
      });

      const examPercentage = examFullMarks > 0 ? (examMarksScored / examFullMarks) * 100 : 0;
      const isExamCompleted = examCompletedSubjects === exam.subjects.length;
      
      totalExams++;
      if (isExamCompleted) {
        completedExams++;
      }
      
      overallMarksScored += examMarksScored;
      overallFullMarks += examFullMarks;

      // Store exam performance for trends
      examPerformance.push({
        examName: exam.examName,
        examCode: exam.examCode,
        examDate: exam.examDate,
        percentage: examPercentage,
        marksScored: examMarksScored,
        fullMarks: examFullMarks,
        isCompleted: isExamCompleted
      });

      processedExams.push({
        examId: exam.examId,
        examName: exam.examName,
        examCode: exam.examCode,
        examDate: exam.examDate,
        subjects: processedSubjects,
        totalMarksScored: examMarksScored,
        totalFullMarks: examFullMarks,
        percentage: examPercentage.toFixed(2),
        grade: calculateGrade(examPercentage),
        isCompleted: isExamCompleted,
        completedSubjects: examCompletedSubjects,
        totalSubjects: exam.subjects.length
      });
    });

    // Calculate subject averages
    const subjectSummary = Array.from(subjectPerformance.values()).map(subject => {
      const avgPercentage = subject.completedCount > 0 ? 
        (subject.totalMarks / (subject.totalFullMarks * subject.completedCount / subject.examCount)) * 100 : 0;
      
      return {
        ...subject,
        averagePercentage: avgPercentage.toFixed(2),
        averageGrade: calculateGrade(avgPercentage),
        completionRate: ((subject.completedCount / subject.examCount) * 100).toFixed(2)
      };
    });

    // Overall performance summary
    const overallPercentage = overallFullMarks > 0 ? (overallMarksScored / overallFullMarks) * 100 : 0;
    const completionRate = totalSubjects > 0 ? (completedSubjects / totalSubjects) * 100 : 0;

    const summary = {
      overallPercentage: overallPercentage.toFixed(2),
      overallGrade: calculateGrade(overallPercentage),
      totalExams: totalExams,
      completedExams: completedExams,
      totalSubjects: totalSubjects,
      completedSubjects: completedSubjects,
      completionRate: completionRate.toFixed(2),
      totalMarksScored: overallMarksScored,
      totalFullMarks: overallFullMarks,
      examCompletionRate: totalExams > 0 ? ((completedExams / totalExams) * 100).toFixed(2) : 0
    };

    console.log('Student academic report generated successfully');

    res.json({
      studentInfo: {
        id: student._id,
        name: student.name,
        studentId: student.studentId,
        className: student.classId.name,
        section: student.classId.section
      },
      hasData: true,
      exams: processedExams,
      subjectSummary: subjectSummary,
      examTrends: examPerformance.filter(exam => exam.isCompleted),
      summary: summary,
      lastUpdated: markRecord.updatedAt
    });

  } catch (err) {
    console.error('Error in getStudentAcademicReport:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};
// Get exam performance details for a specific exam and subject
// Replace the existing getExamPerformanceDetails function with this updated version:

// Get exam performance details for a specific exam and subject
exports.getExamPerformanceDetails = async (req, res) => {
  try {
    const { classId, examId, subjectId } = req.params;
    const teacherId = req.user.id;

    console.log('getExamPerformanceDetails called:', { classId, examId, subjectId, teacherId });

    // Verify teacher access
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get class details with section
    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    // Get subject document and find the specific subject
    const subjectDoc = await Subject.findOne({ classId });
    let subjectName = 'Unknown';
    
    if (subjectDoc) {
      const subject = subjectDoc.subjects.find(sub => sub._id.toString() === subjectId);
      if (subject) {
        subjectName = subject.name || subject.subjectName || 'Unknown Subject';
        // VALIDATION: Check if teacher is currently assigned to this subject
        if (!subject.teacherId || subject.teacherId.toString() !== teacherId) {
          return res.status(403).json({ msg: 'You are not currently assigned to this subject' });
        }
      } else {
        return res.status(404).json({ msg: 'Subject not found in this class' });
      }
    } else {
      return res.status(404).json({ msg: 'Subject document not found for this class' });
    }

    // Get exam details
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ msg: 'Exam not found' });
    }

    // Get all mark records for this class
    const markRecords = await Mark.find({ classId })
      .populate('studentId', 'name studentId')
      .sort({ 'studentId.name': 1 });

    // Extract performance data for this specific exam and subject
    const studentPerformances = [];
    
    markRecords.forEach(record => {
      const examData = record.exams.find(e => e.examId.toString() === examId);
      if (examData) {
        const subjectData = examData.subjects.find(s => s.subjectId.toString() === subjectId);
        if (subjectData && subjectData.marksScored !== null) {
          const percentage = (subjectData.marksScored / subjectData.fullMarks) * 100;
          const grade = calculateGrade(percentage);
          
          studentPerformances.push({
            studentId: record.studentId._id,
            studentName: record.studentId.name,
            studentNumber: record.studentId.studentId,
            marksScored: subjectData.marksScored,
            fullMarks: subjectData.fullMarks,
            percentage: percentage,
            grade: grade,
            scoredAt: subjectData.scoredAt,
            scoredBy: subjectData.scoredBy
          });
        }
      }
    });

    if (studentPerformances.length === 0) {
      return res.json({
        examInfo: {
          examId: exam._id,
          examName: exam.examName,
          examCode: exam.examCode,
          examDate: exam.examDate
        },
        subjectInfo: {
          subjectId: subjectId,
          subjectName: subjectName
        },
        classInfo: {
          id: classObj._id,
          name: classObj.name,
          section: classObj.section || ''
        },
        statistics: null,
        students: [],
        message: 'No student performances found for this exam and subject'
      });
    }

    // Calculate statistics
    const marks = studentPerformances.map(p => p.marksScored);
    const percentages = studentPerformances.map(p => p.percentage);
    const fullMarks = studentPerformances[0].fullMarks;
    
    // Sort marks for median calculation
    const sortedMarks = [...marks].sort((a, b) => a - b);
    const sortedPercentages = [...percentages].sort((a, b) => a - b);
    
    // Calculate median
    const getMedian = (arr) => {
      const mid = Math.floor(arr.length / 2);
      return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
    };

    // Find min and max performers
    const minPerformer = studentPerformances.find(p => p.marksScored === Math.min(...marks));
    const maxPerformer = studentPerformances.find(p => p.marksScored === Math.max(...marks));

    // Helper function to get marks range for percentage
    const getMarksRange = (minPerc, maxPerc) => {
      const minMarks = Math.ceil((minPerc / 100) * fullMarks);
      const maxMarks = maxPerc === 100 ? fullMarks : Math.floor((maxPerc / 100) * fullMarks);
      return `${minMarks}-${maxMarks}`;
    };

    // Build grade distribution with student lists
    const gradeDistribution = {
      'A+': {
        count: 0,
        marksRange: getMarksRange(90, 100),
        students: []
      },
      'A': {
        count: 0,
        marksRange: getMarksRange(80, 89),
        students: []
      },
      'B+': {
        count: 0,
        marksRange: getMarksRange(70, 79),
        students: []
      },
      'B': {
        count: 0,
        marksRange: getMarksRange(60, 69),
        students: []
      },
      'C+': {
        count: 0,
        marksRange: getMarksRange(50, 59),
        students: []
      },
      'C': {
        count: 0,
        marksRange: getMarksRange(40, 49),
        students: []
      },
      'D': {
        count: 0,
        marksRange: getMarksRange(33, 39),
        students: []
      },
      'F': {
        count: 0,
        marksRange: getMarksRange(0, 32),
        students: []
      }
    };

    // Populate grade distribution with students
    studentPerformances.forEach(student => {
      const gradeKey = student.grade;
      if (gradeDistribution[gradeKey]) {
        gradeDistribution[gradeKey].count++;
        gradeDistribution[gradeKey].students.push({
          studentId: student.studentId,
          studentName: student.studentName,
          studentNumber: student.studentNumber,
          marksScored: student.marksScored,
          percentage: student.percentage.toFixed(2)
        });
      }
    });

    const statistics = {
      totalStudents: studentPerformances.length,
      averageMarks: (marks.reduce((sum, mark) => sum + mark, 0) / marks.length).toFixed(2),
      averagePercentage: (percentages.reduce((sum, perc) => sum + perc, 0) / percentages.length).toFixed(2),
      medianMarks: getMedian(sortedMarks),
      medianPercentage: getMedian(sortedPercentages).toFixed(2),
      minMarks: Math.min(...marks),
      maxMarks: Math.max(...marks),
      minPercentage: Math.min(...percentages).toFixed(2),
      maxPercentage: Math.max(...percentages).toFixed(2),
      fullMarks: fullMarks,
      minPerformer: {
        studentId: minPerformer.studentId,
        studentName: minPerformer.studentName,
        studentNumber: minPerformer.studentNumber,
        marksScored: minPerformer.marksScored,
        percentage: minPerformer.percentage.toFixed(2),
        grade: minPerformer.grade
      },
      maxPerformer: {
        studentId: maxPerformer.studentId,
        studentName: maxPerformer.studentName,
        studentNumber: maxPerformer.studentNumber,
        marksScored: maxPerformer.marksScored,
        percentage: maxPerformer.percentage.toFixed(2),
        grade: maxPerformer.grade
      },
      passCount: studentPerformances.filter(p => p.percentage >= 40).length,
      failCount: studentPerformances.filter(p => p.percentage < 40).length,
      gradeDistribution: gradeDistribution
    };

    console.log('Exam performance details retrieved:', studentPerformances.length, 'students');

    res.json({
      examInfo: {
        examId: exam._id,
        examName: exam.examName,
        examCode: exam.examCode,
        examDate: exam.examDate
      },
      subjectInfo: {
        subjectId: subjectId,
        subjectName: subjectName
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section || ''
      },
      statistics,
      students: studentPerformances.sort((a, b) => b.marksScored - a.marksScored),
      totalStudents: studentPerformances.length
    });

  } catch (err) {
    console.error('Error in getExamPerformanceDetails:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};


// Helper function to calculate grade based on percentage
const calculateGrade = (percentage) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
};
exports.getClassCompleteAcademicData = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.user.id;

    console.log('getClassCompleteAcademicData called:', { classId, teacherId });

    // Verify teacher access (must be class admin or class teacher)
    const authCheck = await verifyTeacherAccess(teacherId, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // ENHANCED: Get all students in the class with complete details populated
    const classObj = await Class.findById(classId)
      .populate({
        path: 'studentIds',
        select: 'name studentId email parentContact phoneNumber address dateOfBirth' // Include all student fields
      });
      
    if (!classObj || !classObj.studentIds || classObj.studentIds.length === 0) {
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section || ''
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        // ENHANCED: Added subjects and exams arrays for consistency
        subjects: [],
        exams: [],
        totalStudents: 0,
        message: 'No students found in this class'
      });
    }

    // Get all subjects for this class - FIXED: Added better error handling and logging
    console.log('Searching for subjects with classId:', classId);
    const subjectDoc = await Subject.findOne({ classId: classId });
    console.log('Subject document found:', subjectDoc);
    
    if (!subjectDoc || !subjectDoc.subjects || subjectDoc.subjects.length === 0) {
      console.log('No subjects found for classId:', classId);
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section || ''
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        // ENHANCED: Added subjects and exams arrays
        subjects: [],
        exams: [],
        totalStudents: 0,
        message: 'No subjects found for this class'
      });
    }

    // Get all exams for this class
    const exams = await Exam.find({ classId: classId });
    if (exams.length === 0) {
      return res.json({
        students: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section || ''
        },
        teacherInfo: {
          id: authCheck.teacher._id,
          name: authCheck.teacher.name
        },
        // ENHANCED: Added subjects data even when no exams exist
        subjects: subjectDoc.subjects.map(subject => ({
          subjectId: subject._id,
          subjectName: subject.name || subject.subjectName || 'Unknown Subject',
          teacherName: subject.teacherName || 'Unknown Teacher'
        })),
        exams: [],
        totalStudents: 0,
        message: 'No exams created for this class yet'
      });
    }

    // Get all mark records for this class
    const markRecords = await Mark.find({ classId })
      .populate('studentId', 'name studentId email parentContact phoneNumber')
      .populate('exams.subjects.teacherId', 'name')
      .populate('exams.subjects.scoredBy', 'name');

    // Create a map of existing mark records
    const markRecordMap = new Map();
    markRecords.forEach(record => {
      markRecordMap.set(record.studentId._id.toString(), record);
    });

    // ENHANCED: Helper function to calculate grade
    const calculateGrade = (percentage) => {
      if (percentage >= 90) return 'A+';
      if (percentage >= 80) return 'A';
      if (percentage >= 70) return 'B';
      if (percentage >= 60) return 'C';
      if (percentage >= 50) return 'D';
      return 'F';
    };

    // Build comprehensive student data
    const studentsData = [];

    for (const studentInfo of classObj.studentIds) {
      const studentId = studentInfo._id || studentInfo.studentId;
      const markRecord = markRecordMap.get(studentId.toString());

      // ENHANCED: Maintain original structure while adding student details
      const studentData = {
        studentId: studentId,
        studentName: studentInfo.name,
        studentNumber: studentInfo.studentId,
        // ENHANCED: Added additional student details
        student: {
          _id: studentId,
          name: studentInfo.name || 'Unknown Student',
          studentId: studentInfo.studentId || 'Unknown ID',
          email: studentInfo.email || '',
          parentContact: studentInfo.parentContact || studentInfo.phoneNumber || ''
        },
        exams: []
      };

      // Process each exam
      exams.forEach(exam => {
        let examData = {
          examId: exam._id,
          examName: exam.examName,
          examCode: exam.examCode || '',
          examDate: exam.examDate || '',
          subjects: [],
          totalMarksScored: 0,
          totalFullMarks: 0,
          percentage: '0',
          isCompleted: false,
          completedSubjects: 0,
          totalSubjects: exam.subjects.length
        };

        let completedSubjects = 0;
        let totalMarksScored = 0;
        let totalFullMarks = 0;

        // Process each subject in the exam
        exam.subjects.forEach(examSubject => {
          let subjectMarks = null;
          let scoredBy = null;
          let scoredAt = null;

          // Check if marks exist in the mark record
          if (markRecord) {
            const examRecord = markRecord.exams.find(e => e.examId.toString() === exam._id.toString());
            if (examRecord) {
              const subjectRecord = examRecord.subjects.find(s => s.subjectId.toString() === examSubject.subjectId.toString());
              if (subjectRecord) {
                subjectMarks = subjectRecord.marksScored;
                scoredBy = subjectRecord.scoredBy;
                scoredAt = subjectRecord.scoredAt;
              }
            }
          }

          // FIXED: Better subject lookup with correct field name mapping
          let subjectName = 'Unknown Subject';
          let teacherId = null;
          let teacherName = 'Unknown Teacher';
          
          try {
            const subjectInfo = subjectDoc.subjects.find(s => 
              s._id.toString() === examSubject.subjectId.toString()
            );
            
            if (subjectInfo) {
              // FIXED: Use 'name' field from database, not 'subjectName'  
              subjectName = subjectInfo.name || subjectInfo.subjectName || 'Unknown Subject';
              teacherId = subjectInfo.teacherId;
              teacherName = subjectInfo.teacherName || 'Unknown Teacher';
              console.log(`Found subject: ${subjectName} for ID: ${examSubject.subjectId}`);
            } else {
              console.log(`Subject not found for ID: ${examSubject.subjectId} in exam: ${exam.examName}`);
              console.log('Available subjects:', subjectDoc.subjects.map(s => ({ id: s._id.toString(), name: s.name })));
            }
          } catch (error) {
            console.error('Error finding subject info:', error);
          }

          // ENHANCED: Calculate percentage and grade if marks exist
          const percentage = subjectMarks !== null && examSubject.fullMarks > 0
            ? (subjectMarks / examSubject.fullMarks) * 100
            : null;

          const grade = percentage !== null ? calculateGrade(percentage) : null;

          examData.subjects.push({
            subjectId: examSubject.subjectId,
            subjectName: subjectName, // This will be sent to frontend
            teacherId: teacherId,
            // ENHANCED: Added teacherName for better frontend display
            teacherName: teacherName,
            fullMarks: examSubject.fullMarks,
            marksScored: subjectMarks,
            // ENHANCED: Added percentage and grade calculations
            percentage: percentage,
            grade: grade,
            scoredBy: scoredBy,
            scoredAt: scoredAt
          });

          totalFullMarks += examSubject.fullMarks;
          if (subjectMarks !== null) {
            totalMarksScored += subjectMarks;
            completedSubjects++;
          }
        });

        examData.totalMarksScored = totalMarksScored;
        examData.totalFullMarks = totalFullMarks;
        examData.completedSubjects = completedSubjects;
        examData.isCompleted = completedSubjects === exam.subjects.length;
        examData.percentage = totalFullMarks > 0 ? ((totalMarksScored / totalFullMarks) * 100).toFixed(2) : '0';

        // ENHANCED: Added overall exam performance metrics
        const overallPercentage = totalFullMarks > 0 ? (totalMarksScored / totalFullMarks) * 100 : 0;
        examData.overallPercentage = overallPercentage;
        examData.overallGrade = calculateGrade(overallPercentage);
        examData.totalMarks = totalMarksScored; // Alternative field name for compatibility

        studentData.exams.push(examData);
      });

      // ENHANCED: Calculate overall statistics for the student
      if (studentData.exams.length > 0) {
        const totalExams = studentData.exams.length;
        const averagePercentage = studentData.exams.reduce((sum, exam) => sum + parseFloat(exam.percentage), 0) / totalExams;
        
        // Find best performance
        const bestPerformance = studentData.exams.reduce((best, exam) => 
          parseFloat(exam.percentage) > best.percentage 
            ? { examName: exam.examName, percentage: parseFloat(exam.percentage) }
            : best
        , { examName: '', percentage: 0 });

        // Calculate subject performance for strongest/weakest
        const subjectPerformances = new Map();
        studentData.exams.forEach(exam => {
          exam.subjects.forEach(subject => {
            if (subject.percentage !== null) {
              const existing = subjectPerformances.get(subject.subjectName) || { total: 0, count: 0 };
              subjectPerformances.set(subject.subjectName, {
                total: existing.total + subject.percentage,
                count: existing.count + 1
              });
            }
          });
        });

        let strongestSubject = 'N/A';
        let weakestSubject = 'N/A';
        let maxAvg = -1;
        let minAvg = 101;

        subjectPerformances.forEach((perf, subjectName) => {
          const avg = perf.total / perf.count;
          if (avg > maxAvg) {
            maxAvg = avg;
            strongestSubject = subjectName;
          }
          if (avg < minAvg) {
            minAvg = avg;
            weakestSubject = subjectName;
          }
        });

        studentData.overallStats = {
          totalExams,
          averagePercentage,
          bestPerformance,
          strongestSubject,
          weakestSubject
        };
      }

      studentsData.push(studentData);
    }

    // ENHANCED: Prepare subjects and exams data as expected by frontend
    const subjectsData = subjectDoc.subjects.map(subject => ({
      subjectId: subject._id,
      subjectName: subject.name || subject.subjectName || 'Unknown Subject',
      teacherName: subject.teacherName || 'Unknown Teacher'
    }));

    const examsData = exams.map(exam => ({
      examId: exam._id,
      examName: exam.examName,
      examCode: exam.examCode || '',
      examDate: exam.examDate || ''
    }));

    console.log('Complete academic data retrieved:', studentsData.length, 'students');
    
    // Add debug logging for subject names
    if (studentsData.length > 0 && studentsData[0].exams.length > 0) {
      console.log('Sample subject data being sent:', 
        studentsData[0].exams[0].subjects.map(s => ({ 
          id: s.subjectId, 
          name: s.subjectName 
        }))
      );
    }

    // ENHANCED: Return data with both original and new structure for compatibility
    res.json({
      students: studentsData,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section || ''
      },
      teacherInfo: {
        id: authCheck.teacher._id,
        name: authCheck.teacher.name
      },
      // ENHANCED: Added subjects and exams arrays for frontend compatibility
      subjects: subjectsData,
      exams: examsData,
      totalStudents: studentsData.length
    });

  } catch (err) {
    console.error('Error in getClassCompleteAcademicData:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = exports;