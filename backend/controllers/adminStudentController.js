// controllers/adminStudentController.js
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
const Admin = require('../models/Admin');

// Helper function to find or create class
const findOrCreateClass = async (className, section, schoolId) => {
  try {
    // Try to find existing class
    let classObj = await Class.findOne({ 
      name: className, 
      section: section, 
      schoolId: schoolId 
    });

    // If class doesn't exist, create it
    if (!classObj) {
      classObj = new Class({
        name: className,
        section: section,
        schoolId: schoolId,
        teacherIds: [],
        studentIds: []
      });
      await classObj.save();

      // Update school with new class
      await School.findByIdAndUpdate(
        schoolId,
        { $push: { classIds: classObj._id } }
      );

      console.log('Created new class:', { className, section, classId: classObj._id });
    }

    return classObj;
  } catch (error) {
    console.error('Error in findOrCreateClass:', error);
    throw error;
  }
};

// Helper function to generate unique student ID
const generateStudentId = (schoolCode) => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${schoolCode}-STD-${timestamp}${random}`;
};

// Create single student manually
exports.createStudentManual = async (req, res) => {
  try {
    console.log('createStudentManual called:', { userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { name, class: className, section, email, phoneNo, schoolCode, password } = req.body;

    // Validate required fields
    if (!name || !className || !section || !email || !phoneNo || !schoolCode || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Verify school code matches admin's school
    if (admin.schoolCode !== schoolCode) {
      return res.status(403).json({ message: 'School code does not match your school' });
    }

    // Find school
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Check if student email already exists
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Find or create class
    const classObj = await findOrCreateClass(className, section, school._id);

    // Generate unique student ID
    const studentId = generateStudentId(schoolCode);
    const uniqueId = studentId; // Using same as studentId for simplicity

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create student
    const student = new Student({
      name,
      email,
      phone: phoneNo,
      studentId,
      uniqueId,
      schoolId: school._id,
      classId: classObj._id,
      className: className,
      section: section,
      password: hashedPassword,
      isActive: true
    });

    await student.save();

    // Add student to class
    if (!classObj.studentIds.includes(student._id)) {
      classObj.studentIds.push(student._id);
      await classObj.save();
    }

    console.log('Student created successfully:', { studentId: student._id, classId: classObj._id });

    res.status(201).json({
      message: 'Student account created successfully',
      student: {
        _id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
        className: student.className,
        section: student.section,
        schoolCode: schoolCode
      }
    });

  } catch (error) {
    console.error('Error in createStudentManual:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `A student with this ${field} already exists` 
      });
    }

    res.status(500).json({ 
      message: 'Server error while creating student',
      error: error.message 
    });
  }
};

// Create multiple students via bulk upload
exports.createStudentsBulk = async (req, res) => {
  try {
    console.log('createStudentsBulk called:', { userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { students } = req.body;

    // Validate input
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ message: 'Students array is required and cannot be empty' });
    }

    // Find school
    const school = await School.findOne({ code: admin.schoolCode });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failCount: 0
    };

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const studentData = students[i];
      results.totalProcessed++;

      try {
        // Validate required fields for this student
        const { name, class: className, section, email, phoneNo, schoolCode, password } = studentData;

        if (!name || !className || !section || !email || !phoneNo || !schoolCode || !password) {
          results.failed.push({
            row: i + 1,
            data: studentData,
            error: 'Missing required fields'
          });
          results.failCount++;
          continue;
        }

        // Verify school code
        if (schoolCode !== admin.schoolCode) {
          results.failed.push({
            row: i + 1,
            data: studentData,
            error: 'School code does not match'
          });
          results.failCount++;
          continue;
        }

        // Check if student email already exists
        const existingStudent = await Student.findOne({ email });
        if (existingStudent) {
          results.failed.push({
            row: i + 1,
            data: studentData,
            error: 'Email already exists'
          });
          results.failCount++;
          continue;
        }

        // Find or create class
        const classObj = await findOrCreateClass(className, section, school._id);

        // Generate unique student ID
        const studentId = generateStudentId(schoolCode);
        const uniqueId = studentId;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create student
        const student = new Student({
          name,
          email,
          phone: phoneNo,
          studentId,
          uniqueId,
          schoolId: school._id,
          classId: classObj._id,
          className: className,
          section: section,
          password: hashedPassword,
          isActive: true
        });

        await student.save();

        // Add student to class
        if (!classObj.studentIds.includes(student._id)) {
          classObj.studentIds.push(student._id);
          await classObj.save();
        }

        results.successful.push({
          row: i + 1,
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          className: student.className,
          section: student.section
        });
        results.successCount++;

        console.log(`Student ${i + 1} created:`, { studentId: student._id, name: student.name });

      } catch (studentError) {
        console.error(`Error processing student ${i + 1}:`, studentError);
        
        let errorMessage = 'Failed to create student';
        if (studentError.code === 11000) {
          const field = Object.keys(studentError.keyPattern)[0];
          errorMessage = `Duplicate ${field}`;
        }

        results.failed.push({
          row: i + 1,
          data: studentData,
          error: errorMessage
        });
        results.failCount++;
      }
    }

    console.log('Bulk creation completed:', {
      total: results.totalProcessed,
      successful: results.successCount,
      failed: results.failCount
    });

    res.status(200).json({
      message: `Bulk upload completed: ${results.successCount} successful, ${results.failCount} failed`,
      results: results
    });

  } catch (error) {
    console.error('Error in createStudentsBulk:', error);
    res.status(500).json({ 
      message: 'Server error during bulk upload',
      error: error.message 
    });
  }
};

// Create single teacher manually
exports.createTeacherManual = async (req, res) => {
  try {
    console.log('createTeacherManual called:', { userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { name, email, schoolCode, uniqueCode, password, phoneNo } = req.body;

    // Validate required fields
    if (!name || !email || !schoolCode || !uniqueCode || !password || !phoneNo) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Verify school code matches admin's school
    if (admin.schoolCode !== schoolCode) {
      return res.status(403).json({ message: 'School code does not match your school' });
    }

    // Find school
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    // Check if teacher email already exists
    const Teacher = require('../models/Teacher');
    const existingTeacher = await Teacher.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({ message: 'Teacher with this email already exists' });
    }

    // Check if unique code already exists
    const existingUniqueCode = await Teacher.findOne({ uniqueCode });
    if (existingUniqueCode) {
      return res.status(400).json({ message: 'Unique code already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create teacher
    const teacher = new Teacher({
      name,
      email,
      phone: phoneNo,
      uniqueCode,
      schoolCode,
      schoolId: school._id,
      password: hashedPassword,
      classIds: []
    });

    await teacher.save();

    // Add teacher to school
    if (!school.teacherIds.includes(teacher._id)) {
      school.teacherIds.push(teacher._id);
      await school.save();
    }

    console.log('Teacher created successfully:', { teacherId: teacher._id });

    res.status(201).json({
      message: 'Teacher account created successfully',
      teacher: {
        _id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        uniqueCode: teacher.uniqueCode,
        schoolCode: schoolCode
      }
    });

  } catch (error) {
    console.error('Error in createTeacherManual:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `A teacher with this ${field} already exists` 
      });
    }

    res.status(500).json({ 
      message: 'Server error while creating teacher',
      error: error.message 
    });
  }
};

// Create multiple teachers via bulk upload
exports.createTeachersBulk = async (req, res) => {
  try {
    console.log('createTeachersBulk called:', { userId: req.user?.id, userRole: req.user?.role });

    // Verify user is an admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized as admin' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    const { teachers } = req.body;

    // Validate input
    if (!teachers || !Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({ message: 'Teachers array is required and cannot be empty' });
    }

    // Find school
    const school = await School.findOne({ code: admin.schoolCode });
    if (!school) {
      return res.status(404).json({ message: 'School not found' });
    }

    const Teacher = require('../models/Teacher');
    const results = {
      successful: [],
      failed: [],
      totalProcessed: 0,
      successCount: 0,
      failCount: 0
    };

    // Process each teacher
    for (let i = 0; i < teachers.length; i++) {
      const teacherData = teachers[i];
      results.totalProcessed++;

      try {
        // Validate required fields
        const { name, email, schoolCode, uniqueCode, password, phoneNo } = teacherData;

        if (!name || !email || !schoolCode || !uniqueCode || !password || !phoneNo) {
          results.failed.push({
            row: i + 1,
            data: teacherData,
            error: 'Missing required fields'
          });
          results.failCount++;
          continue;
        }

        // Verify school code
        if (schoolCode !== admin.schoolCode) {
          results.failed.push({
            row: i + 1,
            data: teacherData,
            error: 'School code does not match'
          });
          results.failCount++;
          continue;
        }

        // Check if teacher email already exists
        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
          results.failed.push({
            row: i + 1,
            data: teacherData,
            error: 'Email already exists'
          });
          results.failCount++;
          continue;
        }

        // Check if unique code already exists
        const existingUniqueCode = await Teacher.findOne({ uniqueCode });
        if (existingUniqueCode) {
          results.failed.push({
            row: i + 1,
            data: teacherData,
            error: 'Unique code already in use'
          });
          results.failCount++;
          continue;
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create teacher
        const teacher = new Teacher({
          name,
          email,
          phone: phoneNo,
          uniqueCode,
          schoolCode,
          schoolId: school._id,
          password: hashedPassword,
          classIds: []
        });

        await teacher.save();

        // Add teacher to school
        if (!school.teacherIds.includes(teacher._id)) {
          school.teacherIds.push(teacher._id);
          await school.save();
        }

        results.successful.push({
          row: i + 1,
          name: teacher.name,
          email: teacher.email,
          uniqueCode: teacher.uniqueCode
        });
        results.successCount++;

        console.log(`Teacher ${i + 1} created:`, { teacherId: teacher._id, name: teacher.name });

      } catch (teacherError) {
        console.error(`Error processing teacher ${i + 1}:`, teacherError);
        
        let errorMessage = 'Failed to create teacher';
        if (teacherError.code === 11000) {
          const field = Object.keys(teacherError.keyPattern)[0];
          errorMessage = `Duplicate ${field}`;
        }

        results.failed.push({
          row: i + 1,
          data: teacherData,
          error: errorMessage
        });
        results.failCount++;
      }
    }

    console.log('Bulk teacher creation completed:', {
      total: results.totalProcessed,
      successful: results.successCount,
      failed: results.failCount
    });

    res.status(200).json({
      message: `Bulk upload completed: ${results.successCount} successful, ${results.failCount} failed`,
      results: results
    });

  } catch (error) {
    console.error('Error in createTeachersBulk:', error);
    res.status(500).json({ 
      message: 'Server error during bulk upload',
      error: error.message 
    });
  }
};

module.exports = exports;