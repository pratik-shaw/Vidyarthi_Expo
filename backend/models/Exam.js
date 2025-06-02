// models/Exam.js
const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  examName: {
    type: String,
    required: true,
    trim: true
  },
  examCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  examDate: {
    type: Date,
    required: true
  },
  duration: {
    type: Number, // in minutes
    required: true,
    min: 30
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subjects: [{
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true
    },
    credits: {
      type: Number,
      required: true,
      min: 1
    },
    fullMarks: {
      type: Number,
      required: true,
      min: 1,
      max: 200
    }
  }]
}, {
  timestamps: true
});

// Indexes for efficient queries
examSchema.index({ classId: 1 });
examSchema.index({ schoolId: 1 });
examSchema.index({ classAdminId: 1 });
examSchema.index({ examDate: 1 });
examSchema.index({ 'subjects.teacherId': 1 });

// Validate unique exam names within the same class
examSchema.pre('save', function(next) {
  // Check for duplicate subject IDs within the same exam
  const subjectIds = this.subjects.map(sub => sub.subjectId.toString());
  const uniqueSubjectIds = new Set(subjectIds);
  
  if (subjectIds.length !== uniqueSubjectIds.size) {
    return next(new Error('Duplicate subjects are not allowed in the same exam'));
  }
  
  next();
});

// Instance method to check if teacher can modify this exam
examSchema.methods.canModify = function(teacherId) {
  return this.classAdminId.toString() === teacherId.toString();
};

// Instance method to add subjects to exam
examSchema.methods.addSubjects = function(subjectsData) {
  // Check for duplicate subjects
  const existingSubjectIds = this.subjects.map(sub => sub.subjectId.toString());
  
  for (let subjectData of subjectsData) {
    if (existingSubjectIds.includes(subjectData.subjectId.toString())) {
      throw new Error(`Subject "${subjectData.subjectName}" is already added to this exam`);
    }
  }
  
  this.subjects.push(...subjectsData);
  return this.save();
};

// Instance method to update exam details
examSchema.methods.updateExam = function(updateData) {
  Object.assign(this, updateData);
  return this.save();
};

// Instance method to update a subject in exam
examSchema.methods.updateSubject = function(subjectId, updateData) {
  const subject = this.subjects.find(sub => sub.subjectId.toString() === subjectId.toString());
  if (!subject) {
    throw new Error('Subject not found in this exam');
  }
  
  Object.assign(subject, updateData);
  return this.save();
};

// Instance method to remove a subject from exam
examSchema.methods.removeSubject = function(subjectId) {
  this.subjects = this.subjects.filter(sub => sub.subjectId.toString() !== subjectId.toString());
  return this.save();
};

// Static method to get exams by class with teacher details
examSchema.statics.getByClassWithTeachers = function(classId) {
  return this.find({ classId })
    .populate('subjects.teacherId', 'name email')
    .populate('classAdminId', 'name email')
    .populate('classId', 'name section')
    .sort({ examDate: 1 });
};

// Static method to get exams where a teacher has subjects
examSchema.statics.getByTeacher = function(teacherId) {
  return this.find({ 'subjects.teacherId': teacherId })
    .populate('classId', 'name section')
    .populate('classAdminId', 'name email')
    .sort({ examDate: 1 });
};

module.exports = mongoose.model('Exam', examSchema);