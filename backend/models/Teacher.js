// models/Teacher.js
const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  // Required fields at signup (non-editable)
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
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School',
    required: true
  },
  
  // System assigned fields (non-editable)
  classIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Class' 
  }],
  adminClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    default: null
  },
  teacherId: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  
  // Editable profile fields
  phone: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  zip: {
    type: String,
    default: ''
  },
  subjects: [{
    type: String
  }],
  joiningDate: {
    type: Date,
    default: Date.now
  },
  qualification: {
    type: String,
    default: ''
  },
  experience: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  profileImage: {
    type: String,
    default: ''
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['', 'male', 'female', 'other'],
    default: ''
  },
  emergencyContact: {
    name: {
      type: String,
      default: ''
    },
    phone: {
      type: String,
      default: ''
    },
    relation: {
      type: String,
      default: ''
    }
  },
  socialMedia: {
    linkedin: {
      type: String,
      default: ''
    },
    twitter: {
      type: String,
      default: ''
    }
  },
  bio: {
    type: String,
    default: '',
    maxlength: 500
  }
}, {
  timestamps: true
});

// Index for better performance
teacherSchema.index({ schoolId: 1, status: 1 });
teacherSchema.index({ teacherId: 1 });
teacherSchema.index({ email: 1 });

module.exports = mongoose.model('Teacher', teacherSchema);