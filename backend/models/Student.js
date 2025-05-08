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
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', StudentSchema);