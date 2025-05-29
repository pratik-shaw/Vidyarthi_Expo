// models/Subject.js
const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    unique: true // One subject document per class
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
  subjects: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    credits: {
      type: Number,
      default: 1,
      min: 0,
      max: 10
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Index for efficient queries
subjectSchema.index({ classId: 1 });
subjectSchema.index({ schoolId: 1 });
subjectSchema.index({ classAdminId: 1 });
subjectSchema.index({ 'subjects.teacherId': 1 });

// Validate unique subject names and codes within the same class
subjectSchema.pre('save', function(next) {
  const subjects = this.subjects;
  const names = new Set();
  const codes = new Set();
  
  for (let subject of subjects) {
    // Check for duplicate names
    const nameLower = subject.name.toLowerCase();
    if (names.has(nameLower)) {
      return next(new Error(`Duplicate subject name: ${subject.name}`));
    }
    names.add(nameLower);
    
    // Check for duplicate codes
    const codeUpper = subject.code.toUpperCase();
    if (codes.has(codeUpper)) {
      return next(new Error(`Duplicate subject code: ${subject.code}`));
    }
    codes.add(codeUpper);
  }
  
  next();
});

// Instance method to check if teacher can modify this subject document
subjectSchema.methods.canModify = function(teacherId) {
  return this.classAdminId.toString() === teacherId.toString();
};

// Instance method to add a subject
subjectSchema.methods.addSubject = function(subjectData) {
  // Generate code if not provided
  if (!subjectData.code && subjectData.name) {
    const nameCode = subjectData.name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
    const randomNum = Math.floor(Math.random() * 99) + 1;
    subjectData.code = `${nameCode}${randomNum.toString().padStart(2, '0')}`;
  }
  
  this.subjects.push(subjectData);
  return this.save();
};

// Instance method to update a subject
subjectSchema.methods.updateSubject = function(subjectId, updateData) {
  const subject = this.subjects.id(subjectId);
  if (!subject) {
    throw new Error('Subject not found');
  }
  
  Object.assign(subject, updateData);
  return this.save();
};

// Instance method to remove a subject
subjectSchema.methods.removeSubject = function(subjectId) {
  this.subjects.pull({ _id: subjectId });
  return this.save();
};

// Instance method to assign teacher to subject
subjectSchema.methods.assignTeacher = function(subjectId, teacherId) {
  const subject = this.subjects.id(subjectId);
  if (!subject) {
    throw new Error('Subject not found');
  }
  
  subject.teacherId = teacherId;
  return this.save();
};

// Instance method to remove teacher from subject
subjectSchema.methods.removeTeacher = function(subjectId) {
  const subject = this.subjects.id(subjectId);
  if (!subject) {
    throw new Error('Subject not found');
  }
  
  subject.teacherId = null;
  return this.save();
};

// Static method to get subjects by class with teacher details
subjectSchema.statics.getByClassWithTeachers = function(classId) {
  return this.findOne({ classId })
    .populate('subjects.teacherId', 'name email subject')
    .populate('classAdminId', 'name email')
    .populate('classId', 'name section');
};

// Static method to get subjects assigned to a teacher across all classes
subjectSchema.statics.getByTeacher = function(teacherId) {
  return this.find({ 'subjects.teacherId': teacherId })
    .populate('classId', 'name section')
    .populate('classAdminId', 'name email');
};

module.exports = mongoose.model('Subject', subjectSchema);