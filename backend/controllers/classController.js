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

// Get class details
exports.getClassDetails = async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Find class and populate related data
    const classDetails = await Class.findById(classId)
      .populate('teacherIds', 'name email -_id')
      .populate('studentIds', 'name studentId -_id');
    
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