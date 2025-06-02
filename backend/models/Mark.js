// models/Mark.js
const mongoose = require('mongoose');

const markSchema = new mongoose.Schema({
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  classAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  exams: [{
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    examName: {
      type: String,
      required: true
    },
    examCode: {
      type: String,
      required: true
    },
    examDate: {
      type: Date,
      required: true
    },
    subjects: [{
      subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      subjectName: {
        type: String,
        required: true
      },
      teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
      },
      fullMarks: {
        type: Number,
        required: true
      },
      marksScored: {
        type: Number,
        default: null, // null means not scored yet
        min: 0
      },
      scoredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        default: null
      },
      scoredAt: {
        type: Date,
        default: null
      }
    }]
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
markSchema.index({ schoolId: 1 });
markSchema.index({ studentId: 1 });
markSchema.index({ classId: 1 });
markSchema.index({ 'exams.subjects.teacherId': 1 });

// Instance method to add or update marks for a subject
markSchema.methods.updateSubjectMarks = function(examId, subjectId, marksScored, teacherId) {
  const exam = this.exams.find(e => e.examId.toString() === examId.toString());
  if (!exam) {
    throw new Error('Exam not found for this student');
  }

  const subject = exam.subjects.find(s => s.subjectId.toString() === subjectId.toString());
  if (!subject) {
    throw new Error('Subject not found in this exam');
  }

  // Verify teacher can score this subject
  if (subject.teacherId.toString() !== teacherId.toString()) {
    throw new Error('Not authorized to score this subject');
  }

  // Validate marks
  if (marksScored > subject.fullMarks) {
    throw new Error(`Marks cannot exceed full marks (${subject.fullMarks})`);
  }

  subject.marksScored = marksScored;
  subject.scoredBy = teacherId;
  subject.scoredAt = new Date();

  return this.save();
};

// Static method to create mark record from exam
markSchema.statics.createFromExam = async function(exam, studentId) {
  const examData = {
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
  };

  // Find existing mark record for this student
  let markRecord = await this.findOne({
    studentId: studentId,
    classId: exam.classId
  });

  if (markRecord) {
    // Check if exam already exists
    const existingExamIndex = markRecord.exams.findIndex(
      e => e.examId.toString() === exam._id.toString()
    );

    if (existingExamIndex >= 0) {
      // Update existing exam
      markRecord.exams[existingExamIndex] = examData;
    } else {
      // Add new exam
      markRecord.exams.push(examData);
    }
  } else {
    // Create new mark record
    markRecord = new this({
      schoolId: exam.schoolId,
      studentId: studentId,
      classAdminId: exam.classAdminId,
      classId: exam.classId,
      exams: [examData]
    });
  }

  return markRecord.save();
};

// Static method to get marks by teacher (subjects they can score)
markSchema.statics.getMarksByTeacher = function(teacherId, classId) {
  return this.find({
    classId: classId,
    'exams.subjects.teacherId': teacherId
  })
  .populate('studentId', 'name studentId')
  .populate('exams.subjects.teacherId', 'name email')
  .sort({ 'studentId.name': 1 });
};

// Static method to get student marks
markSchema.statics.getStudentMarks = function(studentId, classId) {
  return this.findOne({
    studentId: studentId,
    classId: classId
  })
  .populate('exams.subjects.teacherId', 'name email')
  .populate('exams.subjects.scoredBy', 'name email');
};

module.exports = mongoose.model('Mark', markSchema);