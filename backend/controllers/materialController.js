// controllers/materialController.js - Optimized version with reduced lines
const Material = require('../models/Material');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const mongoose = require('mongoose');
const zlib = require('zlib');
const { promisify } = require('util');

// Promisify compression functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Helper functions
const compressFileData = async (buffer) => {
  try {
    const compressed = await gzip(buffer);
    return { 
      compressedData: compressed, 
      originalSize: buffer.length, 
      compressedSize: compressed.length, 
      compressionRatio: ((buffer.length - compressed.length) / buffer.length * 100).toFixed(2) 
    };
  } catch (error) {
    console.error('Compression error:', error);
    throw new Error('Failed to compress file data');
  }
};

const decompressFileData = async (compressedBuffer) => {
  try { 
    return await gunzip(compressedBuffer); 
  } catch (error) { 
    console.error('Decompression error:', error); 
    throw new Error('Failed to decompress file data'); 
  }
};

// Optimized teacher access verification
const verifyTeacherAccess = async (teacherId, classId, subjectId) => {
  try {
    console.log('Authorization check:', { teacherId: teacherId?.toString(), classId: classId?.toString(), subjectId: subjectId?.toString() });

    if (!mongoose.Types.ObjectId.isValid(teacherId) || !mongoose.Types.ObjectId.isValid(classId)) {
      return { authorized: false, error: 'Invalid ID format' };
    }

    const [teacher, classObj, subject] = await Promise.all([
      Teacher.findById(teacherId).select('name email schoolId adminClassId classesTeaching subjectsTeaching'),
      Class.findById(classId).select('name section schoolId'),
      subjectId && mongoose.Types.ObjectId.isValid(subjectId) ? Subject.findById(subjectId).select('name code') : null
    ]);

    if (!teacher || !classObj) return { authorized: false, error: 'Teacher or class not found' };

    const sameSchool = teacher.schoolId?.toString() === classObj.schoolId?.toString();
    if (!sameSchool) return { authorized: false, error: 'Not authorized: Different school or missing school information' };

    const classIdStr = classId.toString();
    const isClassAdmin = teacher.adminClassId?.toString() === classIdStr;
    const teachesClass = teacher.classesTeaching?.some(id => id.toString() === classIdStr) || false;
    const teachesSubject = subjectId && teacher.subjectsTeaching?.some(id => id.toString() === subjectId?.toString()) || false;
    const hasEnhancedAccess = isClassAdmin || teachesClass || teachesSubject;

    console.log('✅ Authorization successful');
    return { 
      authorized: true, teacher, classObj, 
      subject: subject || { _id: subjectId, name: 'Unknown Subject' }, 
      accessLevel: hasEnhancedAccess ? 'enhanced' : 'basic'
    };
    
  } catch (error) {
    console.error('❌ Authorization error:', error);
    return { authorized: false, error: 'Authorization check failed: ' + error.message };
  }
};

const verifyStudentAccess = async (studentId, classId) => {
  try {
    const student = await Student.findOne({ _id: studentId, isActive: true });
    if (!student || student.classId.toString() !== classId.toString()) {
      return { authorized: false, error: 'Student not found or does not belong to this class' };
    }
    return { authorized: true, student };
  } catch (error) {
    console.error('Error in verifyStudentAccess:', error);
    return { authorized: false, error: 'Authorization check failed' };
  }
};

const validCategories = ['lecture_notes', 'assignment', 'homework', 'reference_material', 'exam_papers', 'syllabus', 'project_guidelines', 'other'];

// Upload material with optimized error handling
exports.uploadMaterial = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { documentTitle, documentCategory, description, tags } = req.body;

    console.log('Upload request:', { classId, subjectId, userId: req.user.id, file: !!req.file });

    // Validation
    if (!documentTitle || !documentCategory || !req.file) {
      return res.status(400).json({ msg: 'Document title, category and file are required' });
    }
    if (!validCategories.includes(documentCategory)) {
      return res.status(400).json({ msg: 'Invalid document category', validCategories });
    }

    // Authorization
    const accessCheck = await verifyTeacherAccess(req.user.id, classId, subjectId);
    if (!accessCheck.authorized) {
      return res.status(403).json({ msg: 'Access Denied', error: accessCheck.error });
    }

    const { teacher, classObj, subject } = accessCheck;

    // Process file
    const compressionResult = await compressFileData(req.file.buffer);
    const processedTags = tags ? (Array.isArray(tags) ? tags : tags.split(',')).map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0) : [];

    // Create material
    const materialData = {
      schoolId: teacher.schoolId || classObj.schoolId,
      classId, teacherId: teacher._id,
      documentTitle: documentTitle.trim(), documentCategory,
      originalFileName: req.file.originalname, fileType: req.file.originalname.split('.').pop()?.toLowerCase() || '',
      fileSize: req.file.size, compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio, documentData: compressionResult.compressedData,
      mimeType: req.file.mimetype, description: description?.trim(), tags: processedTags, createdBy: teacher._id
    };

    if (subject && subject._id && subject._id.toString() !== 'Unknown Subject') {
      materialData.subjectId = subject._id;
    }

    const newMaterial = new Material(materialData);
    await newMaterial.save();

    const populatedMaterial = await Material.findById(newMaterial._id)
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section')
      .select('-documentData');

    console.log('✅ Material uploaded:', newMaterial._id);

    res.status(201).json({
      msg: 'Material uploaded successfully', material: populatedMaterial,
      compressionInfo: { originalSize: req.file.size, compressedSize: compressionResult.compressedSize, compressionRatio: compressionResult.compressionRatio + '%' },
      accessLevel: accessCheck.accessLevel
    });

  } catch (err) {
    console.error('❌ Upload error:', err);
    if (err.name === 'ValidationError') return res.status(400).json({ msg: 'Validation error', error: err.message });
    if (err.code === 11000) return res.status(400).json({ msg: 'Duplicate entry' });
    res.status(500).json({ msg: 'Server error', error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' });
  }
};

// Get materials for teachers
exports.getMaterialsForTeachers = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { category, teacherId, limit = 50, skip = 0, search } = req.query;

    const accessCheck = await verifyTeacherAccess(req.user.id, classId, subjectId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: 'Access Denied', error: accessCheck.error });

    const options = { limit: parseInt(limit), skip: parseInt(skip), category: category || null, teacherId: teacherId || null };
    const materials = search ? 
      await Material.searchMaterials(search, { classId, subjectId, category, teacherId, limit: parseInt(limit), skip: parseInt(skip) }) :
      await Material.getByClassAndSubject(classId, subjectId, options);

    res.json({ materials, classInfo: accessCheck.classObj, subjectInfo: accessCheck.subject, totalRecords: materials.length, accessLevel: accessCheck.accessLevel });
  } catch (err) {
    console.error('Error getting materials for teachers:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get materials for students
exports.getMaterialsForStudents = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { category, limit = 50, skip = 0, search } = req.query;

    const accessCheck = await verifyStudentAccess(req.user.id, classId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: accessCheck.error });

    const options = { limit: parseInt(limit), skip: parseInt(skip), category: category || null };
    const materials = search ? 
      await Material.searchMaterials(search, { classId, subjectId, category, limit: parseInt(limit), skip: parseInt(skip) }) :
      await Material.getByClassAndSubject(classId, subjectId, options);

    const [classInfo, subjectInfo] = await Promise.all([
      Class.findById(classId).select('name section'),
      Subject.findById(subjectId).select('name code')
    ]);

    res.json({
      materials, classInfo, subjectInfo,
      studentInfo: { id: accessCheck.student._id, name: accessCheck.student.name, studentId: accessCheck.student.studentId },
      totalRecords: materials.length
    });
  } catch (err) {
    console.error('Error getting materials for students:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get teacher's own materials
exports.getMyMaterials = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { category, classId, subjectId, limit = 50, skip = 0, search } = req.query;

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });

    const options = { limit: parseInt(limit), skip: parseInt(skip), category: category || null, classId: classId || null, subjectId: subjectId || null };
    const materials = search ?
      await Material.searchMaterials(search, { teacherId, classId, subjectId, category, limit: parseInt(limit), skip: parseInt(skip) }) :
      await Material.getByTeacher(teacherId, options);

    const stats = await Material.getMaterialStats({ teacherId });

    res.json({
      materials, stats,
      teacherInfo: { id: teacher._id, name: teacher.name, email: teacher.email },
      totalRecords: materials.length
    });
  } catch (err) {
    console.error('Error getting teacher materials:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Download/view material
exports.downloadMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { download = 'false' } = req.query;

    const material = await Material.findOne({ _id: materialId, isActive: true })
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section');

    if (!material) return res.status(404).json({ msg: 'Material not found' });

    // Check access based on user role
    const accessCheck = req.user.role === 'student' ? 
      await verifyStudentAccess(req.user.id, material.classId._id) :
      await verifyTeacherAccess(req.user.id, material.classId._id, material.subjectId?._id);
    
    if (!accessCheck.authorized) return res.status(403).json({ msg: 'Not authorized to access this material' });

    const decompressedData = await decompressFileData(material.documentData);
    await material.incrementDownload();

    res.set({
      'Content-Type': material.mimeType,
      'Content-Length': decompressedData.length,
      'Content-Disposition': download === 'true' ? `attachment; filename="${material.originalFileName}"` : `inline; filename="${material.originalFileName}"`
    });

    console.log(`Material ${download === 'true' ? 'downloaded' : 'viewed'}:`, materialId);
    res.send(decompressedData);
  } catch (err) {
    console.error('Error downloading material:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get material by ID
exports.getMaterialById = async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findOne({ _id: materialId, isActive: true })
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section')
      .populate('createdBy', 'name email').populate('updatedBy', 'name email').select('-documentData');

    if (!material) return res.status(404).json({ msg: 'Material not found' });

    const accessCheck = req.user.role === 'student' ? 
      await verifyStudentAccess(req.user.id, material.classId._id) :
      await verifyTeacherAccess(req.user.id, material.classId._id, material.subjectId?._id);
    
    if (!accessCheck.authorized) return res.status(403).json({ msg: 'Not authorized to access this material' });

    res.json({ material });
  } catch (err) {
    console.error('Error getting material by ID:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Update material
exports.updateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;

    const material = await Material.findOne({ _id: materialId, isActive: true });
    if (!material) return res.status(404).json({ msg: 'Material not found' });

    const accessCheck = await verifyTeacherAccess(req.user.id, material.classId, material.subjectId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: accessCheck.error });

    const isOwner = material.teacherId.toString() === req.user.id;
    const isClassAdmin = accessCheck.teacher.adminClassId?.toString() === material.classId.toString();
    
    if (!isOwner && !isClassAdmin && accessCheck.accessLevel !== 'enhanced') {
      return res.status(403).json({ msg: 'Not authorized to update this material' });
    }

    const allowedUpdates = ['documentTitle', 'documentCategory', 'description', 'tags'];
    const updates = {};
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key) && updateData[key] !== undefined) updates[key] = updateData[key];
    });

    if (Object.keys(updates).length === 0) return res.status(400).json({ msg: 'No valid updates provided' });
    if (updates.documentCategory && !validCategories.includes(updates.documentCategory)) {
      return res.status(400).json({ msg: 'Invalid document category' });
    }

    const updatedMaterial = await material.updateMetadata(updates, req.user.id);
    const populatedMaterial = await Material.findById(updatedMaterial._id)
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section')
      .populate('updatedBy', 'name email').select('-documentData');

    res.json({ msg: 'Material updated successfully', material: populatedMaterial });
  } catch (err) {
    console.error('Error updating material:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ msg: 'Validation error', details: err.message });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Delete material
exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    const material = await Material.findOne({ _id: materialId, isActive: true });
    if (!material) return res.status(404).json({ msg: 'Material not found' });

    const accessCheck = await verifyTeacherAccess(req.user.id, material.classId, material.subjectId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: accessCheck.error });

    const isOwner = material.teacherId.toString() === req.user.id;
    const isClassAdmin = accessCheck.teacher.adminClassId?.toString() === material.classId.toString();

    if (!isOwner && !isClassAdmin) {
      return res.status(403).json({ msg: 'Not authorized to delete this material. Only owners and class admins can delete materials.' });
    }

    await material.softDelete(req.user.id);
    res.json({ msg: 'Material deleted successfully' });
  } catch (err) {
    console.error('Error deleting material:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get material categories
exports.getMaterialCategories = async (req, res) => {
  try {
    const categories = [
      { value: 'lecture_notes', label: 'Lecture Notes', description: 'Class notes and presentations' },
      { value: 'assignment', label: 'Assignment', description: 'Student assignments and tasks' },
      { value: 'homework', label: 'Homework', description: 'Take-home assignments' },
      { value: 'reference_material', label: 'Reference Material', description: 'Additional reading materials' },
      { value: 'exam_papers', label: 'Exam Papers', description: 'Test papers and solutions' },
      { value: 'syllabus', label: 'Syllabus', description: 'Course syllabus and curriculum' },
      { value: 'project_guidelines', label: 'Project Guidelines', description: 'Project instructions and rubrics' },
      { value: 'other', label: 'Other', description: 'Miscellaneous materials' }
    ];
    res.json({ categories });
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Get material statistics
exports.getMaterialStatistics = async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    const { id: userId, role: userRole, schoolId } = req.user;

    const filters = { isActive: true };
    if (schoolId) filters.schoolId = schoolId;

    if (userRole === 'teacher') {
      if (classId) filters.classId = classId;
      if (subjectId) filters.subjectId = subjectId;
    } else if (userRole === 'student') {
      const student = await Student.findById(userId).populate('classId');
      if (!student || !student.classId || student.classId._id.toString() !== classId) {
        return res.status(403).json({ msg: 'Access denied. You are not enrolled in this class.' });
      }
      filters.classId = classId;
      if (subjectId) filters.subjectId = subjectId;
    } else {
      return res.status(403).json({ msg: 'Access denied. Invalid user role.' });
    }

    const stats = await Material.getMaterialStats(filters);
    res.json({ success: true, stats, message: 'Statistics retrieved successfully' });

  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false, msg: 'Server error while fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};
// Get all materials for student's class
exports.getStudentClassMaterials = async (req, res) => {
  try {
    const studentId = req.user.id;
    const { limit = 50, skip = 0, category, search, subjectId } = req.query;

    console.log('Fetching materials for student:', studentId);

    // First, get the student and their class information
    const student = await Student.findOne({ _id: studentId, isActive: true })
      .populate('classId', 'name section schoolId');

    if (!student) {
      return res.status(404).json({ msg: 'Student not found or inactive' });
    }

    if (!student.classId) {
      return res.status(400).json({ msg: 'Student is not assigned to any class' });
    }

    const classId = student.classId._id;
    console.log('Student class:', classId.toString());

    // Build query filters
    const filters = {
      classId: classId,
      isActive: true,
      schoolId: student.classId.schoolId
    };

    // Add optional filters
    if (category && validCategories.includes(category)) {
      filters.documentCategory = category;
    }

    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      filters.subjectId = subjectId;
    }

    let materials;

    if (search && search.trim().length > 0) {
      // If search query is provided, use search functionality
      const searchOptions = {
        classId: classId.toString(),
        category: category || null,
        subjectId: subjectId || null,
        limit: parseInt(limit),
        skip: parseInt(skip)
      };
      materials = await Material.searchMaterials(search.trim(), searchOptions);
    } else {
      // Regular query without search
      materials = await Material.find(filters)
        .populate('teacherId', 'name email')
        .populate('subjectId', 'name code')
        .populate('classId', 'name section')
        .populate('createdBy', 'name email')
        .select('-documentData') // Exclude the actual file data
        .sort({ createdAt: -1 }) // Most recent first
        .limit(parseInt(limit))
        .skip(parseInt(skip));
    }

    // Get total count for pagination
    const totalCount = await Material.countDocuments(filters);

    // Get materials grouped by category for summary
    const categoryStats = await Material.aggregate([
      { $match: filters },
      { $group: { _id: '$documentCategory', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get materials grouped by subject for summary
    const subjectStats = await Material.aggregate([
      { $match: { ...filters, subjectId: { $exists: true } } },
      { 
        $lookup: {
          from: 'subjects',
          localField: 'subjectId',
          foreignField: '_id',
          as: 'subject'
        }
      },
      { $unwind: '$subject' },
      { $group: { _id: '$subjectId', name: { $first: '$subject.name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log(`✅ Found ${materials.length} materials for student's class`);

    res.json({
      success: true,
      materials,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: (parseInt(skip) + materials.length) < totalCount
      },
      studentInfo: {
        id: student._id,
        name: student.name,
        studentId: student.studentId,
        rollNumber: student.rollNumber
      },
      classInfo: {
        id: student.classId._id,
        name: student.classId.name,
        section: student.classId.section
      },
      summary: {
        totalMaterials: totalCount,
        categoriesBreakdown: categoryStats,
        subjectsBreakdown: subjectStats
      },
      appliedFilters: {
        category: category || 'all',
        subjectId: subjectId || 'all',
        search: search || null
      }
    });

  } catch (err) {
    console.error('❌ Error fetching student class materials:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }
    
    res.status(500).json({ 
      msg: 'Server error while fetching materials', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error' 
    });
  }
};