// models/Student.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StudentSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    default: ''
  },
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  uniqueId: {
    type: String,
    required: true,
    unique: true
  },
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    // Not required during registration - will be set when student chooses a class
    required: false
  },
  className: {
    type: String,
    default: ''
  },
  section: {
    type: String,
    default: ''
  },
  password: {
    type: String,
    required: true
  },
  // Editable profile fields
  dateOfBirth: {
    type: Date,
    default: null
  },
  address: {
    type: String,
    default: ''
  },
  admissionDate: {
    type: Date,
    default: null
  },
  // Parent information
  parentName: {
    type: String,
    default: ''
  },
  parentPhone: {
    type: String,
    default: ''
  },
  parentEmail: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
StudentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Student', StudentSchema);