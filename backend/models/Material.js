// models/Material.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const materialSchema = new Schema({
  schoolId: {
    type: Schema.Types.ObjectId,
    ref: 'School',
    required: true,
    index: true
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true,
    index: true
  },
  subjectId: {
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true,
    index: true
  },
  documentTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  documentCategory: {
    type: String,
    enum: ['lecture_notes', 'assignment', 'homework', 'reference_material', 'exam_papers', 'syllabus', 'project_guidelines', 'other'],
    required: true,
    index: true
  },
  originalFileName: {
    type: String,
    required: true,
    trim: true
  },
  fileType: {
    type: String,
    required: true,
    lowercase: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  compressedSize: {
    type: Number,
    required: true
  },
  compressionRatio: {
    type: Number,
    default: 0
  },
  documentData: {
    type: Buffer,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  dateOfSubmission: {
    type: Date,
    default: Date.now,
    index: true
  },
  downloadCount: {
    type: Number,
    default: 0
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
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Don't include the actual document data in JSON responses
      delete ret.documentData;
      return ret;
    }
  },
  toObject: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.documentData;
      return ret;
    }
  }
});

// Indexes for better performance
materialSchema.index({ schoolId: 1, classId: 1, subjectId: 1 });
materialSchema.index({ teacherId: 1, dateOfSubmission: -1 });
materialSchema.index({ documentCategory: 1, dateOfSubmission: -1 });
materialSchema.index({ tags: 1 });
materialSchema.index({ createdAt: -1 });

// Virtual for teacher name (populated)
materialSchema.virtual('teacherName').get(function() {
  return this.teacherId && this.teacherId.name ? this.teacherId.name : 'Unknown Teacher';
});

// Virtual for subject name (populated)
materialSchema.virtual('subjectName').get(function() {
  return this.subjectId && this.subjectId.name ? this.subjectId.name : 'Unknown Subject';
});

// Virtual for class name (populated)
materialSchema.virtual('className').get(function() {
  return this.classId && this.classId.name ? this.classId.name : 'Unknown Class';
});

// Virtual for file size in human readable format
materialSchema.virtual('fileSizeFormatted').get(function() {
  const bytes = this.fileSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for compressed file size in human readable format
materialSchema.virtual('compressedSizeFormatted').get(function() {
  const bytes = this.compressedSize;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Static method to get materials by class and subject
materialSchema.statics.getByClassAndSubject = function(classId, subjectId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    category = null,
    startDate = null,
    endDate = null,
    isActive = true,
    teacherId = null
  } = options;

  const query = { classId, subjectId, isActive };
  
  if (category) {
    query.documentCategory = category;
  }
  
  if (teacherId) {
    query.teacherId = teacherId;
  }
  
  if (startDate || endDate) {
    query.dateOfSubmission = {};
    if (startDate) query.dateOfSubmission.$gte = new Date(startDate);
    if (endDate) query.dateOfSubmission.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .populate('classId', 'name section')
    .sort({ dateOfSubmission: -1 })
    .limit(limit)
    .skip(skip)
    .select('-documentData'); // Exclude file data from list queries
};

// Static method to get materials by teacher
materialSchema.statics.getByTeacher = function(teacherId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    category = null,
    classId = null,
    subjectId = null,
    startDate = null,
    endDate = null,
    isActive = true
  } = options;

  const query = { teacherId, isActive };
  
  if (category) {
    query.documentCategory = category;
  }
  
  if (classId) {
    query.classId = classId;
  }
  
  if (subjectId) {
    query.subjectId = subjectId;
  }
  
  if (startDate || endDate) {
    query.dateOfSubmission = {};
    if (startDate) query.dateOfSubmission.$gte = new Date(startDate);
    if (endDate) query.dateOfSubmission.$lte = new Date(endDate);
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .populate('classId', 'name section')
    .sort({ dateOfSubmission: -1 })
    .limit(limit)
    .skip(skip)
    .select('-documentData');
};

// Static method to search materials
materialSchema.statics.searchMaterials = function(searchQuery, filters = {}) {
  const {
    classId = null,
    subjectId = null,
    teacherId = null,
    category = null,
    limit = 50,
    skip = 0,
    isActive = true
  } = filters;

  const query = { isActive };
  
  if (classId) query.classId = classId;
  if (subjectId) query.subjectId = subjectId;
  if (teacherId) query.teacherId = teacherId;
  if (category) query.documentCategory = category;

  // Text search
  if (searchQuery) {
    query.$or = [
      { documentTitle: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } },
      { tags: { $in: [new RegExp(searchQuery, 'i')] } }
    ];
  }

  return this.find(query)
    .populate('teacherId', 'name email')
    .populate('subjectId', 'name code')
    .populate('classId', 'name section')
    .sort({ dateOfSubmission: -1 })
    .limit(limit)
    .skip(skip)
    .select('-documentData');
};

// Static method to get material statistics
materialSchema.statics.getMaterialStats = async function(filters = {}) {
  const {
    classId = null,
    subjectId = null,
    teacherId = null,
    isActive = true
  } = filters;

  const matchQuery = { isActive };
  if (classId) matchQuery.classId = classId;
  if (subjectId) matchQuery.subjectId = subjectId;
  if (teacherId) matchQuery.teacherId = teacherId;

  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalMaterials: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalCompressedSize: { $sum: '$compressedSize' },
        totalDownloads: { $sum: '$downloadCount' },
        avgCompressionRatio: { $avg: '$compressionRatio' },
        categories: { $addToSet: '$documentCategory' }
      }
    }
  ]);

  const categoryStats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$documentCategory',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' }
      }
    }
  ]);

  return {
    overall: stats[0] || {
      totalMaterials: 0,
      totalSize: 0,
      totalCompressedSize: 0,
      totalDownloads: 0,
      avgCompressionRatio: 0,
      categories: []
    },
    byCategory: categoryStats
  };
};

// Instance method to increment download count
materialSchema.methods.incrementDownload = async function() {
  this.downloadCount += 1;
  return this.save();
};

// Instance method to update metadata
materialSchema.methods.updateMetadata = async function(updateData, updatedBy) {
  const allowedUpdates = ['documentTitle', 'documentCategory', 'description', 'tags'];
  
  Object.keys(updateData).forEach(key => {
    if (allowedUpdates.includes(key)) {
      this[key] = updateData[key];
    }
  });
  
  this.updatedBy = updatedBy;
  
  return this.save();
};

// Instance method to soft delete
materialSchema.methods.softDelete = async function(deletedBy) {
  this.isActive = false;
  this.updatedBy = deletedBy;
  return this.save();
};

// Pre-save middleware to calculate compression ratio
materialSchema.pre('save', function(next) {
  if (this.fileSize > 0) {
    this.compressionRatio = ((this.fileSize - this.compressedSize) / this.fileSize * 100).toFixed(2);
  }
  next();
});

// Pre-save middleware to process tags
materialSchema.pre('save', function(next) {
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = this.tags.map(tag => tag.toLowerCase().trim()).filter(tag => tag.length > 0);
  }
  next();
});

module.exports = mongoose.model('Material', materialSchema);