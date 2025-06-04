// controllers/subjectController.js
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Mark = require('../models/Mark');
const Exam = require('../models/Exam');
const mongoose = require('mongoose');

// Helper function to verify class admin permissions
const verifyClassAdmin = async (userId, classId) => {
  const teacher = await Teacher.findById(userId);
  if (!teacher) {
    return { authorized: false, error: 'Teacher not found' };
  }

  if (!teacher.adminClassId || teacher.adminClassId.toString() !== classId.toString()) {
    return { authorized: false, error: 'Not authorized as class admin for this class' };
  }

  const classObj = await Class.findById(classId);
  if (!classObj) {
    return { authorized: false, error: 'Class not found' };
  }

  return { authorized: true, teacher, classObj };
};

// Initialize subjects for a class (create subject document for class)
exports.initializeSubjects = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('initializeSubjects called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Check if subjects document already exists for this class
    let subjectDoc = await Subject.findOne({ classId });
    
    if (subjectDoc) {
      return res.status(400).json({ msg: 'Subjects already initialized for this class' });
    }

    // Create new subject document for the class
    subjectDoc = new Subject({
      classId,
      schoolId: teacher.schoolId,
      classAdminId: teacher._id,
      subjects: []
    });

    await subjectDoc.save();

    console.log('Subjects initialized successfully for class:', classId);

    res.status(201).json({
      msg: 'Subjects initialized successfully for class',
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      },
      subjects: []
    });

  } catch (err) {
    console.error('Error in initializeSubjects:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Add a new subject to class (class admin only)
exports.addSubject = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, code, description, credits } = req.body;

    console.log('addSubject called:', { classId, name, userId: req.user.id });

    // Validate required fields
    if (!name) {
      return res.status(400).json({ msg: 'Subject name is required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find or create subject document for the class
    let subjectDoc = await Subject.findOne({ classId });
    
    if (!subjectDoc) {
      subjectDoc = new Subject({
        classId,
        schoolId: authCheck.teacher.schoolId,
        classAdminId: authCheck.teacher._id,
        subjects: []
      });
    }

    // Check if subject with same name already exists
    const existingSubject = subjectDoc.subjects.find(
      sub => sub.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (existingSubject) {
      return res.status(400).json({ msg: 'Subject with this name already exists in this class' });
    }

    // Check if subject code already exists (if provided)
    if (code) {
      const existingCode = subjectDoc.subjects.find(
        sub => sub.code && sub.code.toUpperCase() === code.trim().toUpperCase()
      );
      if (existingCode) {
        return res.status(400).json({ msg: 'Subject with this code already exists in this class' });
      }
    }

    // Add new subject
    const newSubjectData = {
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      description: description || '',
      credits: credits || 1
    };

    await subjectDoc.addSubject(newSubjectData);

    // Get updated document with populated data
    const updatedDoc = await Subject.findOne({ classId })
      .populate('subjects.teacherId', 'name email subject')
      .populate('classAdminId', 'name email');

    const newSubject = updatedDoc.subjects[updatedDoc.subjects.length - 1];

    console.log('Subject added successfully:', newSubject._id);

    res.status(201).json({
      msg: 'Subject added successfully',
      subject: newSubject,
      totalSubjects: updatedDoc.subjects.length
    });

  } catch (err) {
    console.error('Error in addSubject:', err);
    
    if (err.message.includes('Duplicate')) {
      return res.status(400).json({ msg: err.message });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get all subjects for a class (class admin only)
exports.getSubjectsByClass = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('getSubjectsByClass called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get subjects for this class
    const subjectDoc = await Subject.getByClassWithTeachers(classId);

    if (!subjectDoc) {
      return res.json({
        subjects: [],
        classInfo: {
          id: authCheck.classObj._id,
          name: authCheck.classObj.name,
          section: authCheck.classObj.section
        },
        isInitialized: false
      });
    }

    console.log('Subjects retrieved:', subjectDoc.subjects.length);

    res.json({
      subjects: subjectDoc.subjects,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      },
      isInitialized: true,
      totalSubjects: subjectDoc.subjects.length
    });

  } catch (err) {
    console.error('Error in getSubjectsByClass:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update a subject (class admin only)
exports.updateSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { name, code, description, credits, isActive } = req.body;

    console.log('updateSubject called:', { classId, subjectId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find subject document
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Find the specific subject
    const subject = subjectDoc.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    // Check for duplicate name (if being updated)
    if (name && name.trim().toLowerCase() !== subject.name.toLowerCase()) {
      const existingSubject = subjectDoc.subjects.find(
        sub => sub._id.toString() !== subjectId && 
               sub.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (existingSubject) {
        return res.status(400).json({ msg: 'Subject name already exists in this class' });
      }
    }

    // Check for duplicate code (if being updated)
    if (code && subject.code && code.trim().toUpperCase() !== subject.code) {
      const existingCode = subjectDoc.subjects.find(
        sub => sub._id.toString() !== subjectId && 
               sub.code && sub.code.toUpperCase() === code.trim().toUpperCase()
      );
      if (existingCode) {
        return res.status(400).json({ msg: 'Subject code already exists in this class' });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (code) updateData.code = code.trim().toUpperCase();
    if (description !== undefined) updateData.description = description;
    if (credits !== undefined) updateData.credits = credits;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update subject
    await subjectDoc.updateSubject(subjectId, updateData);

    // Get updated document with populated data
    const updatedDoc = await Subject.findOne({ classId })
      .populate('subjects.teacherId', 'name email subject')
      .populate('classAdminId', 'name email');

    const updatedSubject = updatedDoc.subjects.id(subjectId);

    console.log('Subject updated successfully:', subjectId);

    res.json({
      msg: 'Subject updated successfully',
      subject: updatedSubject
    });

  } catch (err) {
    console.error('Error in updateSubject:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid subject ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Delete a subject (class admin only)
exports.deleteSubject = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;

    console.log('deleteSubject called:', { classId, subjectId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find subject document
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Find the specific subject
    const subject = subjectDoc.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    const subjectName = subject.name;

    // Remove subject
    await subjectDoc.removeSubject(subjectId);

    console.log('Subject deleted successfully:', subjectId);

    res.json({
      msg: `Subject "${subjectName}" deleted successfully`,
      deletedSubjectId: subjectId,
      remainingSubjects: subjectDoc.subjects.length
    });

  } catch (err) {
    console.error('Error in deleteSubject:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid subject ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Assign teacher to subject (class admin only)
exports.assignTeacher = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { teacherId } = req.body;

    console.log('assignTeacher called:', { classId, subjectId, teacherId, userId: req.user.id });

    // Validate required fields
    if (!teacherId) {
      return res.status(400).json({ msg: 'Teacher ID is required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find subject document
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Find the specific subject
    const subject = subjectDoc.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    // Verify teacher exists and belongs to the same school
    const teacher = await Teacher.findOne({ 
      _id: teacherId, 
      schoolId: authCheck.teacher.schoolId 
    });
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found or not from same school' });
    }

    // Check if teacher is assigned to this class
    if (!teacher.classIds.includes(classId)) {
      return res.status(400).json({ msg: 'Teacher must be assigned to this class first' });
    }

    const subjectObjectId = new mongoose.Types.ObjectId(subjectId);

    // Assign teacher to subject
    await subjectDoc.assignTeacher(subjectId, teacherId);

    // SYNC WITH EXAM COLLECTION - Update all exams for this class
    try {
      const examUpdateResult = await Exam.updateMany(
        { 
          classId: classId,
          'subjects.subjectId': subjectObjectId
        },
        { 
          $set: { 'subjects.$.teacherId': new mongoose.Types.ObjectId(teacherId) }
        }
      );
      console.log(`Updated ${examUpdateResult.modifiedCount} exam records`);
    } catch (examError) {
      console.error('Error updating exam records:', examError);
    }

    // SYNC WITH MARK COLLECTION - Update all mark records for this class
    try {
      const markUpdateResult = await Mark.updateMany(
        { 
          classId: new mongoose.Types.ObjectId(classId)
        },
        { 
          $set: { 
            'exams.$[exam].subjects.$[subject].teacherId': new mongoose.Types.ObjectId(teacherId)
          }
        },
        {
          arrayFilters: [
            { 'exam.subjects.subjectId': subjectObjectId },
            { 'subject.subjectId': subjectObjectId }
          ]
        }
      );
      console.log(`Updated ${markUpdateResult.modifiedCount} mark records`);

      // Additional update to ensure all nested arrays are updated
      const bulkUpdateResult = await Mark.bulkWrite([
        {
          updateMany: {
            filter: { classId: new mongoose.Types.ObjectId(classId) },
            update: {
              $set: {
                'exams.$[].subjects.$[subject].teacherId': new mongoose.Types.ObjectId(teacherId)
              }
            },
            arrayFilters: [
              { 'subject.subjectId': subjectObjectId }
            ]
          }
        }
      ]);
      console.log(`Bulk update result: ${JSON.stringify(bulkUpdateResult)}`);
    } catch (markError) {
      console.error('Error updating mark records:', markError);
    }

    // Get updated document with populated data
    const updatedDoc = await Subject.findOne({ classId })
      .populate('subjects.teacherId', 'name email subject')
      .populate('classAdminId', 'name email');

    const updatedSubject = updatedDoc.subjects.id(subjectId);

    console.log('Teacher assigned to subject successfully and synced with exams/marks');

    res.json({
      msg: `Teacher assigned to subject "${subject.name}" successfully`,
      subject: updatedSubject,
      teacherInfo: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      }
    });

  } catch (err) {
    console.error('Error in assignTeacher:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};


// Remove teacher from subject (class admin only)
exports.removeTeacher = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;

    console.log('removeTeacher called:', { classId, subjectId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find subject document
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Find the specific subject
    const subject = subjectDoc.subjects.id(subjectId);
    if (!subject) {
      return res.status(404).json({ msg: 'Subject not found' });
    }

    if (!subject.teacherId) {
      return res.status(400).json({ msg: 'No teacher assigned to this subject' });
    }

    const previousTeacherId = subject.teacherId;
    const subjectObjectId = new mongoose.Types.ObjectId(subjectId);

    // Remove teacher from subject
    await subjectDoc.removeTeacher(subjectId);

    // SYNC WITH EXAM COLLECTION - Update all exams for this class
    try {
      const examUpdateResult = await Exam.updateMany(
        { 
          classId: classId,
          'subjects.subjectId': subjectObjectId
        },
        { 
          $unset: { 'subjects.$.teacherId': "" }
        }
      );
      console.log(`Updated ${examUpdateResult.modifiedCount} exam records`);
    } catch (examError) {
      console.error('Error updating exam records:', examError);
    }

    // SYNC WITH MARK COLLECTION - Update all mark records for this class
    try {
      const markUpdateResult = await Mark.updateMany(
        { 
          classId: new mongoose.Types.ObjectId(classId)
        },
        { 
          $unset: { 
            'exams.$[exam].subjects.$[subject].teacherId': "",
            'exams.$[exam].subjects.$[subject].scoredBy': ""
          }
        },
        {
          arrayFilters: [
            { 'exam.subjects.subjectId': subjectObjectId },
            { 'subject.subjectId': subjectObjectId }
          ]
        }
      );
      console.log(`Updated ${markUpdateResult.modifiedCount} mark records`);

      // Additional bulk update to ensure all nested arrays are updated
      const bulkUpdateResult = await Mark.bulkWrite([
        {
          updateMany: {
            filter: { classId: new mongoose.Types.ObjectId(classId) },
            update: {
              $unset: {
                'exams.$[].subjects.$[subject].teacherId': "",
                'exams.$[].subjects.$[subject].scoredBy': ""
              }
            },
            arrayFilters: [
              { 'subject.subjectId': subjectObjectId }
            ]
          }
        }
      ]);
      console.log(`Bulk update result: ${JSON.stringify(bulkUpdateResult)}`);
    } catch (markError) {
      console.error('Error updating mark records:', markError);
    }

    console.log('Teacher removed from subject successfully and synced with exams/marks');

    res.json({
      msg: `Teacher removed from subject "${subject.name}" successfully`,
      subjectId: subjectId,
      subjectName: subject.name,
      previousTeacherId: previousTeacherId
    });

  } catch (err) {
    console.error('Error in removeTeacher:', err);
    
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid subject ID format' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get subjects assigned to a teacher (for teachers to see their subjects)
exports.getSubjectsByTeacher = async (req, res) => {
  try {
    const teacherId = req.user.id;

    console.log('getSubjectsByTeacher called:', { teacherId });

    // Verify teacher exists
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Get all subject documents where this teacher is assigned
    const subjectDocs = await Subject.getByTeacher(teacherId);

    // Extract subjects assigned to this teacher
    const assignedSubjects = [];
    
    subjectDocs.forEach(doc => {
      doc.subjects.forEach(subject => {
        if (subject.teacherId && subject.teacherId.toString() === teacherId && subject.isActive) {
          assignedSubjects.push({
            _id: subject._id,
            name: subject.name,
            code: subject.code,
            description: subject.description,
            credits: subject.credits,
            classInfo: {
              id: doc.classId._id,
              name: doc.classId.name,
              section: doc.classId.section
            },
            classAdmin: {
              id: doc.classAdminId._id,
              name: doc.classAdminId.name,
              email: doc.classAdminId.email
            }
          });
        }
      });
    });

    console.log('Assigned subjects retrieved:', assignedSubjects.length);

    res.json({
      subjects: assignedSubjects,
      totalSubjects: assignedSubjects.length,
      teacherInfo: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email
      }
    });

  } catch (err) {
    console.error('Error in getSubjectsByTeacher:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get teachers assigned to a specific class (fixed version)
exports.getClassTeachers = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.user.id;

    console.log('getClassTeachers called:', { classId, userId });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Find teachers who have this classId in their classIds array
    // Remove any potential populate calls that might be causing issues
    const teachers = await Teacher.find({
      classIds: classId,
      schoolId: authCheck.teacher.schoolId
    })
    .select('name email subject')
    .lean(); // Use lean() for better performance and to avoid population issues

    console.log('Teachers retrieved:', teachers.length);

    res.json({
      success: true,
      teachers: teachers,
      classInfo: {
        id: authCheck.classObj._id,
        name: authCheck.classObj.name,
        section: authCheck.classObj.section
      }
    });

  } catch (error) {
    console.error('Error fetching class teachers:', error);
    res.status(500).json({ 
      success: false,
      msg: 'Server error while fetching teachers',
      error: error.message 
    });
  }
};

// Add these methods to your existing subjectController.js

// Check if subjects are already initialized for a class
exports.checkSubjectsStatus = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('checkSubjectsStatus called:', { classId, userId: req.user.id });

    // Verify teacher has access to this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { classObj } = authCheck;

    // Check if subjects document exists
    const subjectDoc = await Subject.findOne({ classId });
    
    res.status(200).json({
      initialized: !!subjectDoc,
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      },
      subjectCount: subjectDoc ? subjectDoc.subjects.length : 0,
      subjects: subjectDoc ? subjectDoc.subjects : []
    });

  } catch (err) {
    console.error('Error checking subjects status:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get subjects or initialize if not exists (alternative approach)
exports.getOrInitializeSubjects = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('getOrInitializeSubjects called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Find existing or create new
    let subjectDoc = await Subject.findOne({ classId });
    let isNewlyInitialized = false;
    
    if (!subjectDoc) {
      subjectDoc = new Subject({
        classId,
        schoolId: teacher.schoolId,
        classAdminId: teacher._id,
        subjects: []
      });
      await subjectDoc.save();
      isNewlyInitialized = true;
      console.log('Subjects initialized for class:', classId);
    }

    // Populate the document with teacher details
    const populatedDoc = await Subject.findOne({ classId })
      .populate('subjects.teacherId', 'name email subject')
      .populate('classAdminId', 'name email');

    res.status(200).json({
      msg: isNewlyInitialized ? 'Subjects initialized successfully' : 'Subjects retrieved successfully',
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      },
      subjects: populatedDoc.subjects,
      totalSubjects: populatedDoc.subjects.length,
      isNewlyInitialized,
      isInitialized: true
    });

  } catch (err) {
    console.error('Error in getOrInitializeSubjects:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

exports.syncMarksWithSubjects = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('syncMarksWithSubjects called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    // Get current subject assignments
    const subjectDoc = await Subject.findOne({ classId });
    if (!subjectDoc) {
      return res.status(404).json({ msg: 'No subjects found for this class' });
    }

    // Create a map of subjectId -> teacherId from current assignments
    const subjectTeacherMap = new Map();
    subjectDoc.subjects.forEach(subject => {
      if (subject.teacherId) {
        subjectTeacherMap.set(subject._id.toString(), subject.teacherId.toString());
      }
    });

    // Get all mark records for this class
    const markRecords = await Mark.find({ classId });

    let updatedRecords = 0;
    let updatedSubjects = 0;

    // Update each mark record
    for (const markRecord of markRecords) {
      let recordModified = false;

      markRecord.exams.forEach(exam => {
        exam.subjects.forEach(subject => {
          const currentTeacherId = subjectTeacherMap.get(subject.subjectId.toString());
          
          if (currentTeacherId) {
            // Assign current teacher
            if (!subject.teacherId || subject.teacherId.toString() !== currentTeacherId) {
              subject.teacherId = new mongoose.Types.ObjectId(currentTeacherId);
              recordModified = true;
              updatedSubjects++;
            }
          } else {
            // Remove teacher assignment if no longer assigned
            if (subject.teacherId) {
              subject.teacherId = null;
              subject.scoredBy = null;
              recordModified = true;
              updatedSubjects++;
            }
          }
        });
      });

      if (recordModified) {
        await markRecord.save();
        updatedRecords++;
      }
    }

    console.log(`Sync completed: ${updatedRecords} records updated, ${updatedSubjects} subject assignments synced`);

    res.json({
      msg: 'Marks synchronized with current subject assignments',
      updatedRecords,
      updatedSubjects,
      totalRecords: markRecords.length
    });

  } catch (err) {
    console.error('Error in syncMarksWithSubjects:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};