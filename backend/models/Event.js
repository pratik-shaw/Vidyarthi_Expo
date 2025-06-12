// models/Event.js
const mongoose = require('mongoose');

const eventItemSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['exam', 'assignment', 'project', 'meeting', 'holiday', 'sports', 'cultural', 'other'],
    default: 'other'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const eventSchema = new mongoose.Schema({
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
  events: [eventItemSchema]
}, {
  timestamps: true
});

// Index for better query performance
eventSchema.index({ schoolId: 1, classId: 1 });
eventSchema.index({ 'events.startDate': 1, 'events.endDate': 1 });
eventSchema.index({ 'events.category': 1 });

// Validate that endDate is after startDate
eventItemSchema.pre('validate', function() {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after start date');
  }
});

module.exports = mongoose.model('Event', eventSchema);