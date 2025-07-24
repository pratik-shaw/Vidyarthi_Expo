// models/Submission.js
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true // This refers to the subject._id from Subject.subjects array
  },
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  pdfData: {
    type: Buffer,
    required: true
  },
  pdfSize: {
    type: Number,
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  status: {
    type: String,
    enum: ['submitted', 'reviewed', 'graded', 'returned'],
    default: 'submitted'
  },
  teacherFeedback: {
    type: String,
    default: ''
  },
  grade: {
    type: String,
    default: ''
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  gradedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
submissionSchema.index({ studentId: 1, createdAt: -1 });
submissionSchema.index({ teacherId: 1, status: 1, createdAt: -1 });
submissionSchema.index({ classId: 1, subjectId: 1, createdAt: -1 });
submissionSchema.index({ schoolId: 1 });

// Virtual for submission age
submissionSchema.virtual('submissionAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Instance method to update status
submissionSchema.methods.updateStatus = function(status, feedback = '', grade = '') {
  this.status = status;
  if (feedback) this.teacherFeedback = feedback;
  if (grade) this.grade = grade;
  
  if (status === 'reviewed') {
    this.reviewedAt = new Date();
  } else if (status === 'graded') {
    this.gradedAt = new Date();
  }
  
  return this.save();
};

// Static method to get submissions by student
submissionSchema.statics.getByStudent = function(studentId, populate = true) {
  const query = this.find({ studentId })
    .select('-pdfData') // Exclude heavy PDF data by default
    .sort({ createdAt: -1 });
  
  if (populate) {
    return query
      .populate('teacherId', 'name email')
      .populate('classId', 'name section')
      .populate('schoolId', 'name');
  }
  
  return query;
};

// Static method to get submissions by teacher
submissionSchema.statics.getByTeacher = function(teacherId, status = null, populate = true) {
  const filter = { teacherId };
  if (status) filter.status = status;
  
  const query = this.find(filter)
    .select('-pdfData') // Exclude heavy PDF data by default
    .sort({ createdAt: -1 });
  
  if (populate) {
    return query
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('schoolId', 'name');
  }
  
  return query;
};

// Static method to get submissions by class and subject
submissionSchema.statics.getByClassAndSubject = function(classId, subjectId, populate = true) {
  const query = this.find({ classId, subjectId })
    .select('-pdfData')
    .sort({ createdAt: -1 });
  
  if (populate) {
    return query
      .populate('studentId', 'name email studentId')
      .populate('teacherId', 'name email');
  }
  
  return query;
};

// Static method to get submission statistics
submissionSchema.statics.getStats = function(teacherId) {
  return this.aggregate([
    { $match: { teacherId: new mongoose.Types.ObjectId(teacherId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Submission', submissionSchema);