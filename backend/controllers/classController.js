// controllers/classController.js
const Class = require('../models/Class');
const School = require('../models/School');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Admin = require('../models/Admin');

// Create a new class (admin only)
exports.createClass = async (req, res) => {
  try {
    const { name, section } = req.body;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Create new class
    const newClass = new Class({
      name,
      section,
      schoolId: admin.schoolId
    });

    await newClass.save();

    // Update school with new class
    const school = await School.findById(admin.schoolId);
    school.classIds.push(newClass._id);
    await school.save();

    res.status(201).json(newClass);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Update a class (admin only)
exports.updateClass = async (req, res) => {
  try {
    const { name, section } = req.body;
    const { id } = req.params;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Find class and ensure it belongs to admin's school
    const classObj = await Class.findOne({ _id: id, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    // Update class fields
    if (name) classObj.name = name;
    if (section) classObj.section = section;

    await classObj.save();
    res.json(classObj);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Delete a class (admin only)
exports.deleteClass = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Find class and ensure it belongs to admin's school
    const classObj = await Class.findOne({ _id: id, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    // Remove class reference from school
    await School.findByIdAndUpdate(
      admin.schoolId,
      { $pull: { classIds: id } }
    );

    // Remove class reference from all associated teachers
    await Teacher.updateMany(
      { classIds: id },
      { $pull: { classIds: id } }
    );

    // Remove adminClassId reference from teachers who are admin of this class
    await Teacher.updateMany(
      { adminClassId: id },
      { $unset: { adminClassId: 1 } }
    );

    // Remove class reference from all associated students
    await Student.updateMany(
      { classIds: id },
      { $pull: { classIds: id } }
    );

    // Delete the class
    await Class.findByIdAndDelete(id);

    res.json({ msg: 'Class deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Assign single teacher to class (admin only) - Keep existing function
exports.assignTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);

    // Find class and teacher, ensure they belong to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    const teacher = await Teacher.findOne({ _id: teacherId, schoolId: admin.schoolId });
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Update class with teacher ID
    if (!classObj.teacherIds.includes(teacherId)) {
      classObj.teacherIds.push(teacherId);
      await classObj.save();
    }

    // Update teacher with class ID
    if (!teacher.classIds.includes(classId)) {
      teacher.classIds.push(classId);
      await teacher.save();
    }

    res.json({ msg: 'Teacher assigned to class successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Assign multiple teachers to class (admin only) - NEW FUNCTION
exports.assignTeachers = async (req, res) => {
  try {
    const { classId, teacherIds } = req.body;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate input
    if (!classId || !teacherIds || !Array.isArray(teacherIds) || teacherIds.length === 0) {
      return res.status(400).json({ msg: 'Class ID and teacher IDs array are required' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Find class and ensure it belongs to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    // Find all teachers and ensure they belong to admin's school
    const teachers = await Teacher.find({ 
      _id: { $in: teacherIds }, 
      schoolId: admin.schoolId 
    });

    if (teachers.length !== teacherIds.length) {
      return res.status(404).json({ msg: 'One or more teachers not found or not authorized' });
    }

    let assignedCount = 0;

    // Process each teacher
    for (const teacher of teachers) {
      let teacherUpdated = false;
      let classUpdated = false;

      // Update class with teacher ID if not already present
      if (!classObj.teacherIds.includes(teacher._id)) {
        classObj.teacherIds.push(teacher._id);
        classUpdated = true;
      }

      // Update teacher with class ID if not already present
      if (!teacher.classIds.includes(classId)) {
        teacher.classIds.push(classId);
        teacherUpdated = true;
      }

      // Save teacher if updated
      if (teacherUpdated) {
        await teacher.save();
        assignedCount++;
      }
    }

    // Save class if updated
    await classObj.save();

    const message = assignedCount === 1 
      ? `${assignedCount} teacher assigned to class successfully`
      : `${assignedCount} teachers assigned to class successfully`;

    res.json({ 
      msg: message,
      assignedCount,
      totalRequested: teacherIds.length
    });
  } catch (err) {
    console.error('Error in assignTeachers:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Assign class admin (admin only)
exports.assignClassAdmin = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Find class and teacher, ensure they belong to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    const teacher = await Teacher.findOne({ _id: teacherId, schoolId: admin.schoolId });
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Check if teacher is already assigned to this class
    if (!teacher.classIds.includes(classId)) {
      return res.status(400).json({ msg: 'Teacher must be assigned to the class first' });
    }

    // Remove admin role from current class admin (if any)
    await Teacher.updateOne(
      { adminClassId: classId },
      { $unset: { adminClassId: 1 } }
    );

    // Assign new class admin
    teacher.adminClassId = classId;
    await teacher.save();

    res.json({ msg: 'Class admin assigned successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Add this function to your existing classController.js file

// Remove class admin (admin only)
exports.removeClassAdmin = async (req, res) => {
  try {
    const { classId } = req.body;

    console.log('removeClassAdmin called with:', { classId, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      console.log('Authorization failed:', { user: req.user });
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate input
    if (!classId) {
      return res.status(400).json({ msg: 'Class ID is required' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      console.log('Admin not found:', req.user.id);
      return res.status(404).json({ msg: 'Admin not found' });
    }

    console.log('Admin found:', { adminId: admin._id, schoolId: admin.schoolId });

    // Find class and ensure it belongs to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      console.log('Class not found:', { classId, schoolId: admin.schoolId });
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    console.log('Class found:', { 
      classId: classObj._id, 
      className: classObj.name,
      section: classObj.section
    });

    // Find the current class admin
    const currentClassAdmin = await Teacher.findOne({ adminClassId: classId, schoolId: admin.schoolId });
    
    if (!currentClassAdmin) {
      console.log('No class admin found for this class');
      return res.status(404).json({ msg: 'No class admin assigned to this class' });
    }

    console.log('Current class admin found:', {
      teacherId: currentClassAdmin._id,
      teacherName: currentClassAdmin.name,
      teacherEmail: currentClassAdmin.email,
      adminClassId: currentClassAdmin.adminClassId
    });

    // Remove the adminClassId from the teacher
    const previousAdminInfo = {
      id: currentClassAdmin._id,
      name: currentClassAdmin.name,
      email: currentClassAdmin.email
    };

    currentClassAdmin.adminClassId = undefined;
    await currentClassAdmin.save();

    console.log('Class admin role removed successfully');

    res.json({ 
      msg: 'Class admin removed successfully',
      previousAdmin: previousAdminInfo,
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in removeClassAdmin:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Get class details
exports.getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Find class and populate related data
    const classDetails = await Class.findById(classId)
      .populate('teacherIds', 'name email -_id')
      .populate('studentIds', 'name email studentId _id');
    
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    // Find the class admin
    const classAdmin = await Teacher.findOne({ adminClassId: classId }).select('name email');
    
    const response = {
      ...classDetails.toObject(),
      classAdmin: classAdmin || null
    };
    
    res.json(response);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Add these methods to your existing classController.js file

// Remove teacher from class (admin only)
exports.removeTeacher = async (req, res) => {
  try {
    const { classId, teacherId } = req.body;

    // Verify user is an admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ msg: 'Admin not found' });
    }

    // Find class and teacher, ensure they belong to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    const teacher = await Teacher.findOne({ _id: teacherId, schoolId: admin.schoolId });
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found or not authorized' });
    }

    // Remove teacher from class
    classObj.teacherIds = classObj.teacherIds.filter(id => id.toString() !== teacherId);
    await classObj.save();

    // Remove class from teacher
    teacher.classIds = teacher.classIds.filter(id => id.toString() !== classId);
    
    // If this teacher was the class admin, remove that role
    if (teacher.adminClassId && teacher.adminClassId.toString() === classId) {
      teacher.adminClassId = undefined;
    }
    
    await teacher.save();

    res.json({ msg: 'Teacher removed from class successfully' });
  } catch (err) {
    console.error('Error in removeTeacher:', err.message);
    res.status(500).json({ msg: 'Server error', error: err.message });
  }
};

// Assign multiple students to class (admin only)
// Enhanced assignStudents function for classController.js

exports.assignStudents = async (req, res) => {
  try {
    const { classId, studentIds } = req.body;

    console.log('assignStudents called with:', { classId, studentIds, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      console.log('Authorization failed:', { user: req.user });
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate input
    if (!classId) {
      return res.status(400).json({ msg: 'Class ID is required' });
    }

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ msg: 'Student IDs array is required and cannot be empty' });
    }

    // Validate that all studentIds are valid ObjectIds
    const mongoose = require('mongoose');
    const validStudentIds = studentIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validStudentIds.length !== studentIds.length) {
      return res.status(400).json({ msg: 'One or more invalid student IDs provided' });
    }

    // Find admin
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      console.log('Admin not found:', req.user.id);
      return res.status(404).json({ msg: 'Admin not found' });
    }

    console.log('Admin found:', { adminId: admin._id, schoolId: admin.schoolId });

    // Find class and ensure it belongs to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      console.log('Class not found:', { classId, schoolId: admin.schoolId });
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    console.log('Class found:', { 
      classId: classObj._id, 
      className: classObj.name,
      section: classObj.section,
      currentStudentIds: classObj.studentIds 
    });

    // Find all students and ensure they belong to admin's school
    const students = await Student.find({ 
      _id: { $in: validStudentIds }, 
      schoolId: admin.schoolId 
    });

    console.log('Students found:', { 
      requestedCount: validStudentIds.length, 
      foundCount: students.length,
      foundStudents: students.map(s => ({ id: s._id, name: s.name, currentClassId: s.classId }))
    });

    if (students.length === 0) {
      return res.status(404).json({ msg: 'No valid students found for this school' });
    }

    if (students.length !== validStudentIds.length) {
      console.log('Some students not found or not authorized');
      // Continue with found students instead of failing completely
    }

    let assignedCount = 0;
    let alreadyAssignedCount = 0;
    let reassignedCount = 0;
    const assignmentResults = [];

    // Initialize studentIds array in class if it doesn't exist
    if (!classObj.studentIds) {
      classObj.studentIds = [];
    }

    // Process each student
    for (const student of students) {
      try {
        let studentUpdated = false;
        let classUpdated = false;

        // Check if student is already in this specific class
        const studentAlreadyInClass = classObj.studentIds.some(id => id.toString() === student._id.toString());
        const studentCurrentlyInThisClass = student.classId && student.classId.toString() === classId.toString();

        if (studentAlreadyInClass && studentCurrentlyInThisClass) {
          alreadyAssignedCount++;
          assignmentResults.push({
            studentId: student._id,
            studentName: student.name,
            status: 'already_assigned',
            currentClass: student.className
          });
          continue;
        }

        // If student has a different class, remove them from the old class first
        if (student.classId && student.classId.toString() !== classId.toString()) {
          try {
            const oldClass = await Class.findById(student.classId);
            if (oldClass && oldClass.studentIds) {
              oldClass.studentIds = oldClass.studentIds.filter(id => id.toString() !== student._id.toString());
              await oldClass.save();
              console.log('Removed student from old class:', { studentId: student._id, oldClassId: student.classId });
              reassignedCount++;
            }
          } catch (oldClassError) {
            console.error('Error removing student from old class:', oldClassError);
            // Continue with assignment to new class even if old class removal fails
          }
        }

        // Update class with student ID if not already present
        if (!studentAlreadyInClass) {
          classObj.studentIds.push(student._id);
          classUpdated = true;
        }

        // Update student with new class information
        student.classId = classId;
        student.className = classObj.name || '';
        student.section = classObj.section || '';
        studentUpdated = true;

        // Save student
        if (studentUpdated) {
          await student.save();
          console.log('Student updated:', { 
            studentId: student._id, 
            newClassId: student.classId,
            newClassName: student.className,
            newSection: student.section
          });
        }

        assignedCount++;
        assignmentResults.push({
          studentId: student._id,
          studentName: student.name,
          status: reassignedCount > 0 ? 'reassigned' : 'assigned',
          newClass: student.className,
          newSection: student.section
        });

      } catch (studentError) {
        console.error('Error processing student:', student._id, studentError);
        assignmentResults.push({
          studentId: student._id,
          studentName: student.name,
          status: 'error',
          error: studentError.message
        });
      }
    }

    // Save class if updated
    try {
      await classObj.save();
      console.log('Class updated with new students');
    } catch (classError) {
      console.error('Error saving class:', classError);
      return res.status(500).json({ 
        msg: 'Error updating class', 
        error: classError.message 
      });
    }

    // Prepare response message
    let message = '';
    if (assignedCount > 0 && alreadyAssignedCount > 0) {
      message = `${assignedCount} student(s) assigned (${reassignedCount} reassigned), ${alreadyAssignedCount} already assigned`;
    } else if (assignedCount > 0) {
      const reassignedText = reassignedCount > 0 ? ` (${reassignedCount} reassigned from other classes)` : '';
      message = assignedCount === 1 
        ? `${assignedCount} student assigned to class successfully${reassignedText}`
        : `${assignedCount} students assigned to class successfully${reassignedText}`;
    } else if (alreadyAssignedCount > 0) {
      message = `All ${alreadyAssignedCount} student(s) were already assigned to this class`;
    } else {
      message = 'No students were assigned';
    }

    console.log('Assignment completed:', {
      assignedCount,
      reassignedCount,
      alreadyAssignedCount,
      totalRequested: validStudentIds.length,
      totalFound: students.length
    });

    res.json({ 
      msg: message,
      assignedCount,
      reassignedCount,
      alreadyAssignedCount,
      totalRequested: validStudentIds.length,
      totalFound: students.length,
      results: assignmentResults
    });

  } catch (err) {
    console.error('Error in assignStudents:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// Remove student from class (admin only)
exports.removeStudent = async (req, res) => {
  try {
    const { classId, studentId } = req.body;

    console.log('removeStudent called with:', { classId, studentId, userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      console.log('Authorization failed:', { user: req.user });
      return res.status(403).json({ msg: 'Not authorized' });
    }

    // Validate input
    if (!classId || !studentId) {
      return res.status(400).json({ msg: 'Class ID and Student ID are required' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      console.log('Admin not found:', req.user.id);
      return res.status(404).json({ msg: 'Admin not found' });
    }

    console.log('Admin found:', { adminId: admin._id, schoolId: admin.schoolId });

    // Find class and student, ensure they belong to admin's school
    const classObj = await Class.findOne({ _id: classId, schoolId: admin.schoolId });
    if (!classObj) {
      console.log('Class not found:', { classId, schoolId: admin.schoolId });
      return res.status(404).json({ msg: 'Class not found or not authorized' });
    }

    const student = await Student.findOne({ _id: studentId, schoolId: admin.schoolId });
    if (!student) {
      console.log('Student not found:', { studentId, schoolId: admin.schoolId });
      return res.status(404).json({ msg: 'Student not found or not authorized' });
    }

    console.log('Class and student found:', { 
      classId: classObj._id, 
      studentId: student._id,
      currentClassStudents: classObj.studentIds?.length || 0,
      studentCurrentClass: student.classId,
      studentCurrentClassName: student.className
    });

    // Initialize arrays if they don't exist
    if (!classObj.studentIds) {
      classObj.studentIds = [];
    }

    // Check if student is actually in the class
    const studentInClass = classObj.studentIds.some(id => id.toString() === studentId);
    const studentAssignedToThisClass = student.classId && student.classId.toString() === classId;

    if (!studentInClass && !studentAssignedToThisClass) {
      console.log('Student not found in class');
      return res.status(400).json({ msg: 'Student is not assigned to this class' });
    }

    let classUpdated = false;
    let studentUpdated = false;

    // Remove student from class if present
    if (studentInClass) {
      const originalLength = classObj.studentIds.length;
      classObj.studentIds = classObj.studentIds.filter(id => id.toString() !== studentId);
      classUpdated = classObj.studentIds.length !== originalLength;
      console.log('Removed student from class:', { originalLength, newLength: classObj.studentIds.length });
    }

    // Clear student's class information if assigned to this class
    if (studentAssignedToThisClass) {
      student.classId = null;
      student.className = '';
      student.section = '';
      studentUpdated = true;
      console.log('Cleared student class information');
    }

    // Save changes
    if (classUpdated) {
      await classObj.save();
      console.log('Class saved successfully');
    }

    if (studentUpdated) {
      await student.save();
      console.log('Student saved successfully');
    }

    if (classUpdated || studentUpdated) {
      console.log('Student removal completed successfully');
      res.json({ 
        msg: 'Student removed from class successfully',
        removedFromClass: classUpdated,
        studentRecordUpdated: studentUpdated,
        studentInfo: {
          id: student._id,
          name: student.name,
          classId: student.classId,
          className: student.className,
          section: student.section
        }
      });
    } else {
      console.log('No changes made - student may not have been properly assigned');
      res.json({ msg: 'No changes made - student was not properly assigned to class' });
    }

  } catch (err) {
    console.error('Error in removeStudent:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};