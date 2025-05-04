// models/Admin.js
const mongoose = require('mongoose');
const adminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: { 
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
  schoolId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School' 
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Admin', adminSchema);