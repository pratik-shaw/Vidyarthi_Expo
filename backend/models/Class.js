// models/Class.js
const mongoose = require('mongoose');
const classSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  section: {
    type: String
  },
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School',
    required: true
  },
  teacherIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Teacher' 
  }],
  studentIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Class', classSchema);