// models/School.js
const mongoose = require('mongoose');
const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  code: { 
    type: String, 
    required: true,
    unique: true 
  },
  adminId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  teacherIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher' 
  }],
  studentIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }],
  classIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('School', schoolSchema);