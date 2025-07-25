// controllers/queryController.js
const Query = require('../models/Query');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const Class = require('../models/Class');
const mongoose = require('mongoose');

// Helper function to verify student belongs to class
const verifyStudentClass = async (studentId, classId) => {
  const student = await Student.findById(studentId);
  if (!student) {
    return { authorized: false, error: 'Student not found' };
  }

  if (!student.classId || student.classId.toString() !== classId.toString()) {
    return { authorized: false, error: 'Student not enrolled in this class' };
  }

  return { authorized: true, student };
};

// Create new query (Student only)
exports.createQuery = async (req, res) => {
  try {
    const { title, description, category, priority = 'medium', isUrgent = false } = req.body;
    const studentId = req.user.id;

    console.log('createQuery called:', { title, category, studentId });

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({ msg: 'Title, description, and category are required' });
    }

    // Find student to get their class and school
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    if (!student.classId) {
      return res.status(400).json({ msg: 'Student not assigned to any class' });
    }

    // Handle file attachments if present
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        fileName: file.originalname,
        fileData: file.buffer,
        fileSize: file.size,
        mimeType: file.mimetype
      }));
    }

    // Create query
    const query = new Query({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      isUrgent,
      studentId,
      schoolId: student.schoolId,
      classId: student.classId,
      attachments
    });

    await query.save();

    // Return query without file data
    const queryResponse = await Query.findById(query._id)
      .select('-attachments.fileData')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section');

    console.log('Query created successfully:', query._id);

    res.status(201).json({
      msg: 'Query submitted successfully',
      query: queryResponse
    });

  } catch (err) {
    console.error('Error in createQuery:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get student's queries (Student only)
exports.getStudentQueries = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { status, category, page = 1, limit = 10 } = req.query;

    console.log('getStudentQueries called:', { studentId, status, category });

    // Build filter
    const filter = { studentId };
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Get queries with pagination
    const skip = (page - 1) * limit;
    const queries = await Query.find(filter)
      .select('-attachments.fileData')
      .populate('classId', 'name section')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Query.countDocuments(filter);

    console.log('Student queries retrieved:', queries.length);

    res.json({
      queries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (err) {
    console.error('Error in getStudentQueries:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get all queries for admin (Admin only)
exports.getAdminQueries = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { status, category, classId, priority, search, page = 1, limit = 10 } = req.query;

    console.log('getAdminQueries called:', { adminId, status, category, classId });

    // Find admin to get school
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Build filter
    const filter = { schoolId: admin.schoolId };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (classId) filter.classId = classId;
    if (priority) filter.priority = priority;

    // Add search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Get queries with pagination
    const skip = (page - 1) * limit;
    const queries = await Query.find(filter)
      .select('-attachments.fileData')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ isUrgent: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Query.countDocuments(filter);

    console.log('Admin queries retrieved:', queries.length);

    res.json({
      queries,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (err) {
    console.error('Error in getAdminQueries:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get queries by class (Admin only)
exports.getQueriesByClass = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { classId } = req.params;
    const { status, category, page = 1, limit = 10 } = req.query;

    console.log('getQueriesByClass called:', { adminId, classId });

    // Find admin to verify school
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Verify class belongs to admin's school
    const classDoc = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classDoc) {
      return res.status(404).json({ msg: 'Class not found in your school' });
    }

    // Build filter
    const filter = { classId, schoolId: admin.schoolId };
    if (status) filter.status = status;
    if (category) filter.category = category;

    // Get queries with pagination
    const skip = (page - 1) * limit;
    const queries = await Query.find(filter)
      .select('-attachments.fileData')
      .populate('studentId', 'name email studentId')
      .populate('adminResponse.respondedBy', 'name email')
      .sort({ isUrgent: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Query.countDocuments(filter);

    res.json({
      queries,
      classInfo: {
        _id: classDoc._id,
        name: classDoc.name,
        section: classDoc.section
      },
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (err) {
    console.error('Error in getQueriesByClass:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get query by ID
exports.getQueryById = async (req, res) => {
  try {
    const { queryId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('getQueryById called:', { queryId, userId, userRole });

    const query = await Query.findById(queryId)
      .select('-attachments.fileData')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('adminResponse.respondedBy', 'name email')
      .populate('schoolId', 'name');

    if (!query) {
      return res.status(404).json({ msg: 'Query not found' });
    }

    // Authorization check
    if (userRole === 'student' && query.studentId._id.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to view this query' });
    }

    if (userRole === 'admin') {
      const admin = await Admin.findById(userId);
      if (!admin || query.schoolId._id.toString() !== admin.schoolId.toString()) {
        return res.status(403).json({ msg: 'Not authorized to view this query' });
      }

      // Mark as viewed by admin if not already viewed
      if (!query.viewedByAdmin) {
        await query.updateStatus(query.status);
      }
    }

    res.json({ query });

  } catch (err) {
    console.error('Error in getQueryById:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid query ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update query status (Admin only)
exports.updateQueryStatus = async (req, res) => {
  try {
    const { queryId } = req.params;
    const { status, adminResponse } = req.body;
    const adminId = req.user.id;

    console.log('updateQueryStatus called:', { queryId, status, adminId });

    // Validate status
    const validStatuses = ['submitted', 'in_review', 'resolved', 'rejected', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    // Find admin to verify school
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const query = await Query.findById(queryId);
    if (!query) {
      return res.status(404).json({ msg: 'Query not found' });
    }

    // Verify query belongs to admin's school
    if (query.schoolId.toString() !== admin.schoolId.toString()) {
      return res.status(403).json({ msg: 'Not authorized to update this query' });
    }

    // Update query
    await query.updateStatus(status, adminResponse, adminId);

    // Get updated query
    const updatedQuery = await Query.findById(queryId)
      .select('-attachments.fileData')
      .populate('studentId', 'name email studentId')
      .populate('classId', 'name section')
      .populate('adminResponse.respondedBy', 'name email');

    console.log('Query status updated successfully:', queryId);

    res.json({
      msg: 'Query status updated successfully',
      query: updatedQuery
    });

  } catch (err) {
    console.error('Error in updateQueryStatus:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid query ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get query statistics (Admin only)
exports.getQueryStats = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { classId } = req.query;

    console.log('getQueryStats called:', { adminId, classId });

    // Find admin to get school
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    const stats = await Query.getStats(admin.schoolId, classId);

    // Format stats
    const formattedStats = {
      submitted: 0,
      in_review: 0,
      resolved: 0,
      rejected: 0,
      closed: 0,
      total: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    // Get urgent queries count
    const urgentCount = await Query.countDocuments({
      schoolId: admin.schoolId,
      isUrgent: true,
      status: { $in: ['submitted', 'in_review'] }
    });

    res.json({ 
      stats: formattedStats,
      urgentQueries: urgentCount
    });

  } catch (err) {
    console.error('Error in getQueryStats:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Download attachment (Student can download own, Admin can download from their school)
exports.downloadAttachment = async (req, res) => {
  try {
    const { queryId, attachmentIndex } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    console.log('downloadAttachment called:', { queryId, attachmentIndex, userId, userRole });

    const query = await Query.findById(queryId);
    if (!query) {
      return res.status(404).json({ msg: 'Query not found' });
    }

    // Authorization check
    if (userRole === 'student' && query.studentId.toString() !== userId) {
      return res.status(403).json({ msg: 'Not authorized to download this file' });
    }

    if (userRole === 'admin') {
      const admin = await Admin.findById(userId);
      if (!admin || query.schoolId.toString() !== admin.schoolId.toString()) {
        return res.status(403).json({ msg: 'Not authorized to download this file' });
      }
    }

    // Get attachment
    const attachmentIdx = parseInt(attachmentIndex);
    if (attachmentIdx < 0 || attachmentIdx >= query.attachments.length) {
      return res.status(404).json({ msg: 'Attachment not found' });
    }

    const attachment = query.attachments[attachmentIdx];

    // Set response headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.fileName}"`);
    res.setHeader('Content-Length', attachment.fileSize);

    // Send file data
    res.send(attachment.fileData);

  } catch (err) {
    console.error('Error in downloadAttachment:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid query ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

module.exports = {
  createQuery: exports.createQuery,
  getStudentQueries: exports.getStudentQueries,
  getAdminQueries: exports.getAdminQueries,
  getQueriesByClass: exports.getQueriesByClass,
  getQueryById: exports.getQueryById,
  updateQueryStatus: exports.updateQueryStatus,
  getQueryStats: exports.getQueryStats,
  downloadAttachment: exports.downloadAttachment
};