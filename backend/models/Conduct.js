// models/Conduct.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const conductSchema = new Schema({
  studentId: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['positive', 'negative', 'neutral'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  actionTaken: {
    type: String,
    trim: true,
    maxlength: 300
  },
  parentNotified: {
    type: Boolean,
    default: false
  },
  followUpRequired: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
conductSchema.index({ studentId: 1, date: -1 });
conductSchema.index({ teacherId: 1, date: -1 });
conductSchema.index({ classId: 1, date: -1 });
conductSchema.index({ type: 1, date: -1 });
conductSchema.index({ date: -1 });

// Virtual for teacher name (populated)
conductSchema.virtual('teacherName').get(function() {
  return this.teacherId && this.teacherId.name ? this.teacherId.name : 'Unknown Teacher';
});

// Virtual for student name (populated)
conductSchema.virtual('studentName').get(function() {
  return this.studentId && this.studentId.name ? this.studentId.name : 'Unknown Student';
});

// Static method to get conduct records by student
conductSchema.statics.getByStudent = function(studentId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    type = null,
    startDate = null,
    endDate = null,
    isActive = true
  } = options;

  const query = { studentId, isActive };
  
  if (type) {
    query.type = type;
  }
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('studentId', 'name email studentId')
    .populate('classId', 'name section')
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get conduct records by class
conductSchema.statics.getByClass = function(classId, options = {}) {
  const {
    limit = 100,
    skip = 0,
    type = null,
    startDate = null,
    endDate = null,
    isActive = true
  } = options;

  const query = { classId, isActive };
  
  if (type) {
    query.type = type;
  }
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('studentId', 'name email studentId')
    .populate('classId', 'name section')
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get conduct records by teacher
conductSchema.statics.getByTeacher = function(teacherId, options = {}) {
  const {
    limit = 100,
    skip = 0,
    type = null,
    startDate = null,
    endDate = null,
    isActive = true
  } = options;

  const query = { teacherId, isActive };
  
  if (type) {
    query.type = type;
  }
  
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('studentId', 'name email studentId')
    .populate('classId', 'name section')
    .sort({ date: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get conduct summary for a student
conductSchema.statics.getStudentSummary = async function(studentId, options = {}) {
  const {
    startDate = null,
    endDate = null,
    isActive = true
  } = options;

  const matchQuery = { studentId, isActive };
  
  if (startDate || endDate) {
    matchQuery.date = {};
    if (startDate) matchQuery.date.$gte = new Date(startDate);
    if (endDate) matchQuery.date.$lte = new Date(endDate);
  }

  const summary = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        latestDate: { $max: '$date' }
      }
    }
  ]);

  const result = {
    positive: 0,
    negative: 0,
    neutral: 0,
    total: 0,
    lastEntry: null
  };

  summary.forEach(item => {
    result[item._id] = item.count;
    result.total += item.count;
    if (!result.lastEntry || item.latestDate > result.lastEntry) {
      result.lastEntry = item.latestDate;
    }
  });

  return result;
};

// Instance method to update conduct record
conductSchema.methods.updateConduct = async function(updateData, updatedBy) {
  const allowedUpdates = ['title', 'description', 'type', 'severity', 'actionTaken', 'parentNotified', 'followUpRequired', 'followUpDate'];
  
  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updateData[key];
    }
  });
  
  this.updatedBy = updatedBy;
  
  return this.save();
};

// Instance method to soft delete
conductSchema.methods.softDelete = async function(deletedBy) {
  this.isActive = false;
  this.updatedBy = deletedBy;
  return this.save();
};

// Pre-save middleware to validate dates
conductSchema.pre('save', function(next) {
  if (this.followUpRequired && !this.followUpDate) {
    this.followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  }
  next();
});

// Pre-save middleware to set severity based on type for negative conducts
conductSchema.pre('save', function(next) {
  if (this.type === 'negative' && !this.severity) {
    this.severity = 'medium';
  }
  next();
});

module.exports = mongoose.model('Conduct', conductSchema);