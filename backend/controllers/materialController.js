// controllers/materialController.js - Fixed version with relaxed authorization
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

// FIXED: Much more flexible teacher access verification
const verifyTeacherAccess = async (teacherId, classId, subjectId) => {
  try {
    console.log('=== AUTHORIZATION DEBUG START ===');
    console.log('Input parameters:', { 
      teacherId: teacherId?.toString(), 
      classId: classId?.toString(), 
      subjectId: subjectId?.toString() 
    });

    // Validate MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      console.log('❌ Invalid teacher ObjectId format');
      return { authorized: false, error: 'Invalid teacher ID format' };
    }

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      console.log('❌ Invalid class ObjectId format');
      return { authorized: false, error: 'Invalid class ID format' };
    }

    // Get teacher first
    const teacher = await Teacher.findById(teacherId).select('name email schoolId adminClassId classesTeaching subjectsTeaching');
    
    if (!teacher) {
      console.log('❌ Teacher not found in database');
      return { authorized: false, error: 'Teacher not found' };
    }

    console.log('Teacher found:', {
      id: teacher._id.toString(),
      name: teacher.name,
      schoolId: teacher.schoolId?.toString(),
      adminClassId: teacher.adminClassId?.toString(),
      classesTeaching: teacher.classesTeaching?.map(id => id.toString()) || [],
      subjectsTeaching: teacher.subjectsTeaching?.map(id => id.toString()) || []
    });

    // Get class - this is mandatory
    const classObj = await Class.findById(classId).select('name section schoolId');
    
    if (!classObj) {
      console.log('❌ Class not found in database');
      return { authorized: false, error: 'Class not found' };
    }

    console.log('Class found:', {
      id: classObj._id.toString(),
      name: classObj.name,
      schoolId: classObj.schoolId?.toString()
    });

    // Check school authorization first
    const teacherSchoolId = teacher.schoolId?.toString();
    const classSchoolId = classObj.schoolId?.toString();
    const sameSchool = teacherSchoolId && classSchoolId && (teacherSchoolId === classSchoolId);
    
    console.log('School verification:', {
      teacherSchool: teacherSchoolId,
      classSchool: classSchoolId,
      sameSchool
    });

    if (!sameSchool) {
      console.log('❌ Teacher and class belong to different schools or missing school info');
      return { authorized: false, error: 'Not authorized: Different school or missing school information' };
    }

    // Get subject if provided and valid
    let subject = null;
    let subjectValid = false;
    
    if (subjectId && mongoose.Types.ObjectId.isValid(subjectId)) {
      subject = await Subject.findById(subjectId).select('name code');
      if (subject) {
        subjectValid = true;
        console.log('Subject found:', {
          id: subject._id.toString(),
          name: subject.name
        });
      } else {
        console.log('⚠️ Subject ID provided but subject not found in database');
      }
    } else {
      console.log('⚠️ Invalid or missing subject ID');
    }

    // RELAXED AUTHORIZATION LOGIC:
    // 1. If teacher is same school - allow basic access
    // 2. Enhanced access for class admin or if assigned to class/subject
    
    const classIdStr = classId.toString();
    const subjectIdStr = subjectId?.toString();
    
    const isClassAdmin = teacher.adminClassId?.toString() === classIdStr;
    const teachesClass = teacher.classesTeaching?.some(id => id.toString() === classIdStr) || false;
    const teachesSubject = subjectIdStr && teacher.subjectsTeaching?.some(id => id.toString() === subjectIdStr) || false;

    console.log('Authorization checks:', {
      isClassAdmin,
      teachesClass,
      teachesSubject,
      adminClassId: teacher.adminClassId?.toString(),
      targetClassId: classIdStr,
      classesTeaching: teacher.classesTeaching?.map(id => id.toString()) || [],
      subjectsTeaching: teacher.subjectsTeaching?.map(id => id.toString()) || []
    });

    // VERY RELAXED: Allow if teacher is from same school
    // This gives teachers more flexibility to upload materials
    const hasBasicAccess = sameSchool;
    const hasEnhancedAccess = isClassAdmin || teachesClass || teachesSubject;

    if (hasBasicAccess) {
      console.log('✅ Teacher authorization successful (same school access)');
      if (hasEnhancedAccess) {
        console.log('✅ Enhanced access granted (admin/assigned)');
      }
      console.log('=== AUTHORIZATION DEBUG END ===');
      return { 
        authorized: true, 
        teacher, 
        classObj, 
        subject: subject || { _id: subjectId, name: 'Unknown Subject' }, // Fallback for missing subject
        accessLevel: hasEnhancedAccess ? 'enhanced' : 'basic'
      };
    }

    console.log('❌ No authorization conditions met');
    console.log('=== AUTHORIZATION DEBUG END ===');
    return { 
      authorized: false, 
      error: 'Not authorized: You must belong to the same school as the class.' 
    };
    
  } catch (error) {
    console.error('❌ Error in verifyTeacherAccess:', error);
    return { authorized: false, error: 'Authorization check failed: ' + error.message };
  }
};

const verifyStudentAccess = async (studentId, classId) => {
  try {
    const student = await Student.findOne({ _id: studentId, isActive: true });
    if (!student) return { authorized: false, error: 'Student not found' };
    if (student.classId.toString() !== classId.toString()) {
      return { authorized: false, error: 'Student does not belong to this class' };
    }
    return { authorized: true, student };
  } catch (error) {
    console.error('Error in verifyStudentAccess:', error);
    return { authorized: false, error: 'Authorization check failed' };
  }
};

const validCategories = ['lecture_notes', 'assignment', 'homework', 'reference_material', 'exam_papers', 'syllabus', 'project_guidelines', 'other'];

// FIXED: Upload material with better error handling and more flexible authorization
exports.uploadMaterial = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { documentTitle, documentCategory, description, tags } = req.body;

    console.log('=== UPLOAD MATERIAL DEBUG START ===');
    console.log('Request params:', { classId, subjectId });
    console.log('Request body:', { documentTitle, documentCategory, description, tags });
    console.log('User info:', { 
      userId: req.user.id, 
      userRole: req.user.role,
      userSchoolId: req.user.schoolId 
    });
    console.log('File info:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    } : 'No file uploaded');

    // Validate required fields
    if (!documentTitle || !documentCategory) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        msg: 'Document title and category are required',
        received: { documentTitle: !!documentTitle, documentCategory: !!documentCategory }
      });
    }

    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ msg: 'No file uploaded' });
    }

    // Validate category
    if (!validCategories.includes(documentCategory)) {
      console.log('❌ Invalid category:', documentCategory);
      return res.status(400).json({ 
        msg: 'Invalid document category',
        validCategories
      });
    }

    // Authorization check with more flexible logic
    console.log('🔍 Starting authorization check...');
    const accessCheck = await verifyTeacherAccess(req.user.id, classId, subjectId);
    
    if (!accessCheck.authorized) {
      console.log('❌ Authorization failed:', accessCheck.error);
      return res.status(403).json({ 
        msg: 'Access Denied',
        error: accessCheck.error,
        details: 'Please ensure you belong to the same school. Contact your administrator if this seems incorrect.'
      });
    }

    console.log('✅ Authorization successful - proceeding with upload');
    const { teacher, classObj, subject } = accessCheck;

    // Process file
    const fileBuffer = req.file.buffer;
    const originalFileName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || '';

    console.log('📁 Processing file:', { originalFileName, mimeType, fileSize, fileExtension });

    // Compress file data
    const compressionResult = await compressFileData(fileBuffer);
    console.log('🗜️ File compressed successfully:', {
      originalSize: compressionResult.originalSize,
      compressedSize: compressionResult.compressedSize,
      ratio: compressionResult.compressionRatio + '%'
    });

    // Process tags
    const processedTags = tags ? 
      (Array.isArray(tags) ? tags : tags.split(',')).map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0) : 
      [];

    // Use teacher's schoolId or class's schoolId as fallback
    const materialSchoolId = teacher.schoolId || classObj.schoolId;

    // Create new material with fallback subject handling
    const materialData = {
      schoolId: materialSchoolId,
      classId,
      teacherId: teacher._id,
      documentTitle: documentTitle.trim(),
      documentCategory,
      originalFileName,
      fileType: fileExtension,
      fileSize,
      compressedSize: compressionResult.compressedSize,
      compressionRatio: compressionResult.compressionRatio,
      documentData: compressionResult.compressedData,
      mimeType,
      description: description?.trim(),
      tags: processedTags,
      createdBy: teacher._id
    };

    // Only add subjectId if we have a valid subject
    if (subject && subject._id && subject._id.toString() !== 'Unknown Subject') {
      materialData.subjectId = subject._id;
    }

    const newMaterial = new Material(materialData);

    console.log('💾 Saving material to database...');
    await newMaterial.save();
    console.log('✅ Material saved successfully with ID:', newMaterial._id);

    // Populate and return material
    const populatedMaterial = await Material.findById(newMaterial._id)
      .populate('teacherId', 'name email')
      .populate('subjectId', 'name code')
      .populate('classId', 'name section')
      .select('-documentData');

    console.log('=== UPLOAD MATERIAL DEBUG END ===');

    res.status(201).json({
      msg: 'Material uploaded successfully',
      material: populatedMaterial,
      compressionInfo: {
        originalSize: fileSize,
        compressedSize: compressionResult.compressedSize,
        compressionRatio: compressionResult.compressionRatio + '%',
        spaceSaved: fileSize - compressionResult.compressedSize
      },
      accessLevel: accessCheck.accessLevel
    });

  } catch (err) {
    console.error('❌ Error in uploadMaterial:', err);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        msg: 'Validation error', 
        error: err.message,
        details: Object.keys(err.errors).map(key => ({
          field: key,
          message: err.errors[key].message
        }))
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({ 
        msg: 'Duplicate entry', 
        error: 'A material with similar details already exists' 
      });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
};

// FIXED: More flexible access for other methods too
exports.getMaterialsForTeachers = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { category, teacherId, limit = 50, skip = 0, search } = req.query;

    console.log('getMaterialsForTeachers called:', { classId, subjectId, teacherId: req.user.id });

    const accessCheck = await verifyTeacherAccess(req.user.id, classId, subjectId);
    if (!accessCheck.authorized) {
      return res.status(403).json({ 
        msg: 'Access Denied', 
        error: accessCheck.error,
        details: 'You need to belong to the same school to view materials.'
      });
    }

    const options = { limit: parseInt(limit), skip: parseInt(skip), category: category || null, teacherId: teacherId || null };

    const materials = search ?
      await Material.searchMaterials(search, { classId, subjectId, category, teacherId, limit: parseInt(limit), skip: parseInt(skip) }) :
      await Material.getByClassAndSubject(classId, subjectId, options);

    console.log('Materials retrieved for teacher:', materials.length);

    res.json({ 
      materials, 
      classInfo: accessCheck.classObj, 
      subjectInfo: accessCheck.subject,
      totalRecords: materials.length,
      accessLevel: accessCheck.accessLevel
    });
  } catch (err) {
    console.error('Error in getMaterialsForTeachers:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Continue with existing methods but with more flexible authorization...
exports.getMaterialsForStudents = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { category, limit = 50, skip = 0, search } = req.query;

    console.log('getMaterialsForStudents called:', { classId, subjectId, studentId: req.user.id });

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

    console.log('Materials retrieved for student:', materials.length);

    res.json({
      materials, classInfo, subjectInfo,
      studentInfo: { id: accessCheck.student._id, name: accessCheck.student.name, studentId: accessCheck.student.studentId },
      totalRecords: materials.length
    });
  } catch (err) {
    console.error('Error in getMaterialsForStudents:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getMyMaterials = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { category, classId, subjectId, limit = 50, skip = 0, search } = req.query;

    console.log('getMyMaterials called:', { teacherId });

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) return res.status(404).json({ msg: 'Teacher not found' });

    const options = { limit: parseInt(limit), skip: parseInt(skip), category: category || null, classId: classId || null, subjectId: subjectId || null };

    const materials = search ?
      await Material.searchMaterials(search, { teacherId, classId, subjectId, category, limit: parseInt(limit), skip: parseInt(skip) }) :
      await Material.getByTeacher(teacherId, options);

    const stats = await Material.getMaterialStats({ teacherId });

    console.log('Teacher materials retrieved:', materials.length);

    res.json({
      materials, stats,
      teacherInfo: { id: teacher._id, name: teacher.name, email: teacher.email },
      totalRecords: materials.length
    });
  } catch (err) {
    console.error('Error in getMyMaterials:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.downloadMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { download = 'false' } = req.query;

    console.log('downloadMaterial called:', { materialId, userId: req.user.id, download });

    const material = await Material.findOne({ _id: materialId, isActive: true })
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section');

    if (!material) return res.status(404).json({ msg: 'Material not found' });

    let hasAccess = false;
    let userType = '';

    if (req.user.role === 'student') {
      const studentAccess = await verifyStudentAccess(req.user.id, material.classId._id);
      if (studentAccess.authorized) { hasAccess = true; userType = 'student'; }
    }

    if (!hasAccess && req.user.role === 'teacher') {
      const teacherAccess = await verifyTeacherAccess(req.user.id, material.classId._id, material.subjectId?._id);
      if (teacherAccess.authorized) { hasAccess = true; userType = 'teacher'; }
    }

    if (!hasAccess) return res.status(403).json({ msg: 'Not authorized to access this material' });

    const decompressedData = await decompressFileData(material.documentData);
    await material.incrementDownload();

    res.set({
      'Content-Type': material.mimeType,
      'Content-Length': decompressedData.length,
      'Content-Disposition': download === 'true' ? `attachment; filename="${material.originalFileName}"` : `inline; filename="${material.originalFileName}"`
    });

    console.log(`Material ${download === 'true' ? 'downloaded' : 'viewed'} by ${userType}:`, materialId);
    res.send(decompressedData);
  } catch (err) {
    console.error('Error in downloadMaterial:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getMaterialById = async (req, res) => {
  try {
    const { materialId } = req.params;

    console.log('getMaterialById called:', { materialId, userId: req.user.id });

    const material = await Material.findOne({ _id: materialId, isActive: true })
      .populate('teacherId', 'name email').populate('subjectId', 'name code').populate('classId', 'name section')
      .populate('createdBy', 'name email').populate('updatedBy', 'name email').select('-documentData');

    if (!material) return res.status(404).json({ msg: 'Material not found' });

    let hasAccess = false;

    if (req.user.role === 'student') {
      const studentAccess = await verifyStudentAccess(req.user.id, material.classId._id);
      if (studentAccess.authorized) hasAccess = true;
    }

    if (!hasAccess && req.user.role === 'teacher') {
      const teacherAccess = await verifyTeacherAccess(req.user.id, material.classId._id, material.subjectId?._id);
      if (teacherAccess.authorized) hasAccess = true;
    }

    if (!hasAccess) return res.status(403).json({ msg: 'Not authorized to access this material' });

    res.json({ material });
  } catch (err) {
    console.error('Error in getMaterialById:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const updateData = req.body;

    console.log('updateMaterial called:', { materialId, teacherId: req.user.id });

    const material = await Material.findOne({ _id: materialId, isActive: true });
    if (!material) return res.status(404).json({ msg: 'Material not found' });

    const accessCheck = await verifyTeacherAccess(req.user.id, material.classId, material.subjectId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: accessCheck.error });

    const isOwner = material.teacherId.toString() === req.user.id;
    const isClassAdmin = accessCheck.teacher.adminClassId?.toString() === material.classId.toString();
    const hasBasicAccess = accessCheck.accessLevel === 'basic' || accessCheck.accessLevel === 'enhanced';

    // More flexible update permissions
    if (!isOwner && !isClassAdmin && !hasBasicAccess) {
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

    console.log('Material updated successfully:', materialId);

    res.json({ msg: 'Material updated successfully', material: populatedMaterial });
  } catch (err) {
    console.error('Error in updateMaterial:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ msg: 'Validation error', details: err.message });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    console.log('deleteMaterial called:', { materialId, teacherId: req.user.id });

    const material = await Material.findOne({ _id: materialId, isActive: true });
    if (!material) return res.status(404).json({ msg: 'Material not found' });

    const accessCheck = await verifyTeacherAccess(req.user.id, material.classId, material.subjectId);
    if (!accessCheck.authorized) return res.status(403).json({ msg: accessCheck.error });

    const isOwner = material.teacherId.toString() === req.user.id;
    const isClassAdmin = accessCheck.teacher.adminClassId?.toString() === material.classId.toString();
    const hasBasicAccess = accessCheck.accessLevel === 'basic' || accessCheck.accessLevel === 'enhanced';

    // More flexible delete permissions - but prefer owner/admin for delete operations
    if (!isOwner && !isClassAdmin) {
      return res.status(403).json({ msg: 'Not authorized to delete this material. Only owners and class admins can delete materials.' });
    }

    await material.softDelete(req.user.id);

    console.log('Material deleted successfully:', materialId);
    res.json({ msg: 'Material deleted successfully' });
  } catch (err) {
    console.error('Error in deleteMaterial:', err);
    if (err instanceof mongoose.Error.CastError) return res.status(400).json({ msg: 'Invalid material ID format' });
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

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
    console.error('Error in getMaterialCategories:', err);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

exports.getMaterialStatistics = async (req, res) => {
  try {
    const { classId, subjectId } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;
    const schoolId = req.user.schoolId;

    const filters = {
      isActive: true
    };

    // Add schoolId if available
    if (schoolId) {
      filters.schoolId = schoolId;
    }

    if (userRole === 'teacher') {
      if (classId) filters.classId = classId;
      if (subjectId) filters.subjectId = subjectId;
    } else if (userRole === 'student') {
      filters.classId = classId;
      if (subjectId) filters.subjectId = subjectId;
      
      const Student = require('../models/Student');
      const student = await Student.findById(userId).populate('classId');
      
      if (!student || !student.classId || student.classId._id.toString() !== classId) {
        return res.status(403).json({ 
          msg: 'Access denied. You are not enrolled in this class.' 
        });
      }
    } else {
      return res.status(403).json({ 
        msg: 'Access denied. Invalid user role.' 
      });
    }

    const stats = await Material.getMaterialStats(filters);

    res.json({
      success: true,
      stats: stats,
      message: 'Statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Error in getMaterialStatistics:', error);
    res.status(500).json({
      success: false,
      msg: 'Server error while fetching statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};