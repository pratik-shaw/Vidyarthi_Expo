// models/Query.js
const mongoose = require('mongoose');

const querySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  category: {
    type: String,
    required: true,
    enum: [
      'leave_application',
      'document_request',
      'bonafide_certificate',
      'transfer_certificate',
      'fee_related',
      'academic_issue',
      'disciplinary_matter',
      'general_inquiry',
      'other'
    ]
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['submitted', 'in_review', 'resolved', 'rejected', 'closed'],
    default: 'submitted'
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  adminResponse: {
    message: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    respondedAt: {
      type: Date
    }
  },
  attachments: [{
    fileName: String,
    fileData: Buffer,
    fileSize: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  isUrgent: {
    type: Boolean,
    default: false
  },
  tags: [String],
  viewedByAdmin: {
    type: Boolean,
    default: false
  },
  viewedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
querySchema.index({ schoolId: 1, status: 1, createdAt: -1 });
querySchema.index({ studentId: 1, createdAt: -1 });
querySchema.index({ classId: 1, status: 1 });
querySchema.index({ category: 1, status: 1 });

// Static method to get query statistics
querySchema.statics.getStats = async function(schoolId, classId = null) {
  const matchCondition = { schoolId };
  if (classId) matchCondition.classId = classId;

  return await this.aggregate([
    { $match: matchCondition },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
};

// Method to update status with admin response
querySchema.methods.updateStatus = async function(status, adminResponse = null, adminId = null) {
  this.status = status;
  
  if (adminResponse && adminId) {
    this.adminResponse = {
      message: adminResponse,
      respondedBy: adminId,
      respondedAt: new Date()
    };
  }

  if (!this.viewedByAdmin) {
    this.viewedByAdmin = true;
    this.viewedAt = new Date();
  }

  return await this.save();
};

module.exports = mongoose.model('Query', querySchema);