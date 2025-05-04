// models/Student.js
const mongoose = require('mongoose');
const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String
  },
  email: { 
    type: String, 
    required: true,
    unique: true 
  },
  studentId: {
    type: String,
    required: true
  },
  uniqueId: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  schoolCode: {
    type: String,
    required: true
  },
  class: {
    type: String
  },
  section: {
    type: String
  },
  classId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  },
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School' 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);