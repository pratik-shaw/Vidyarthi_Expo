// models/Attendance.js
const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late'],
    required: true
  },
  remarks: {
    type: String,
    default: ''
  }
});

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  schoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  classAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  dateString: {
    type: String,
    required: true // Format: YYYY-MM-DD
  },
  records: [attendanceRecordSchema],
  totalStudents: {
    type: Number,
    required: true
  },
  presentCount: {
    type: Number,
    default: 0
  },
  absentCount: {
    type: Number,
    default: 0
  },
  lateCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure one attendance record per class per date
attendanceSchema.index({ classId: 1, dateString: 1 }, { unique: true });
attendanceSchema.index({ schoolId: 1 });
attendanceSchema.index({ classAdminId: 1 });
attendanceSchema.index({ date: 1 });

// Calculate attendance counts before saving
attendanceSchema.pre('save', function(next) {
  this.presentCount = this.records.filter(r => r.status === 'present').length;
  this.absentCount = this.records.filter(r => r.status === 'absent').length;
  this.lateCount = this.records.filter(r => r.status === 'late').length;
  this.totalStudents = this.records.length;
  next();
});

// Method to get attendance percentage
attendanceSchema.methods.getAttendancePercentage = function() {
  if (this.totalStudents === 0) return 0;
  return Math.round((this.presentCount / this.totalStudents) * 100);
};

// Static method to get attendance for date range
attendanceSchema.statics.getByDateRange = function(classId, startDate, endDate) {
  return this.find({
    classId,
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ date: -1 });
};

module.exports = mongoose.model('Attendance', attendanceSchema);