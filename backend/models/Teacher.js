// models/Teacher.js
const mongoose = require('mongoose');
const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: { 
    type: String, 
    required: true,
    unique: true 
  },
  uniqueCode: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  schoolCode: {
    type: String,
    required: true
  },
  classIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }],
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School' 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Teacher', teacherSchema);