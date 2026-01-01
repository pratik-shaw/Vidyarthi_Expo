// controllers/adminStudentController.js
const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
const Admin = require('../models/Admin');

// Helper function to find or create class with case-insensitive matching
const findOrCreateClass = async (className, section, schoolId) => {
  try {
    // Trim and normalize inputs
    const normalizedName = className.trim();
    const normalizedSection = section.trim();

    // Validate that name is not empty after trimming
    if (!normalizedName) {
      throw new Error('Class name cannot be empty');
    }

    // Try to find existing class using case-insensitive search
    let classObj = await Class.findOne({ 
      schoolId: schoolId,
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }, // Case-insensitive match
      section: { $regex: new RegExp(`^${normalizedSection}$`, 'i') }
    });

    // If class doesn't exist, create it with normalized values
    if (!classObj) {
      classObj = new Class({
        name: normalizedName,
        section: normalizedSection,
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

      console.log('Created new class:', { 
        className: normalizedName, 
        section: normalizedSection, 
        classId: classObj._id 
      });
    } else {
      console.log('Found existing class:', {
        className: classObj.name,
        section: classObj.section,
        classId: classObj._id
      });
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

    let { name, class: className, section, email, phoneNo, schoolCode, password } = req.body;

    // Trim and normalize all inputs
    name = name?.trim();
    className = className?.trim();
    section = section?.trim();
    email = email?.trim().toLowerCase(); // Email should also be lowercase
    phoneNo = phoneNo?.trim();
    schoolCode = schoolCode?.trim();
    password = password?.trim();

    // Validate required fields after trimming
    if (!name || !className || !section || !email || !phoneNo || !schoolCode || !password) {
      return res.status(400).json({ message: 'All fields are required and cannot be empty' });
    }

    // Validate class name is not empty after trimming
    if (!className) {
      return res.status(400).json({ message: 'Class name cannot be empty' });
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

    // Check if student email already exists (case-insensitive)
    const existingStudent = await Student.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    if (existingStudent) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Find or create class (this will handle case-insensitive matching)
    const classObj = await findOrCreateClass(className, section, school._id);

    // Generate unique student ID
    const studentId = generateStudentId(schoolCode);
    const uniqueId = studentId; // Using same as studentId for simplicity

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create student with normalized values
    const student = new Student({
      name,
      email: email.toLowerCase(), // Store email in lowercase
      phone: phoneNo,
      studentId,
      uniqueId,
      schoolId: school._id,
      classId: classObj._id,
      className: classObj.name, // Use the class name from the found/created class
      section: classObj.section, // Use the section from the found/created class
      password: hashedPassword,
      isActive: true
    });

    await student.save();

    // Add student to class if not already present
    if (!classObj.studentIds.some(id => id.toString() === student._id.toString())) {
      classObj.studentIds.push(student._id);
      await classObj.save();
    }

    console.log('Student created successfully:', { 
      studentId: student._id, 
      classId: classObj._id,
      className: classObj.name,
      section: classObj.section
    });

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
        // Extract and normalize data
        let { name, class: className, section, email, phoneNo, schoolCode, password } = studentData;

        // Trim and normalize all inputs
        name = name?.trim();
        className = className?.trim();
        section = section?.trim();
        email = email?.trim().toLowerCase();
        phoneNo = phoneNo?.trim();
        schoolCode = schoolCode?.trim();
        password = password?.trim();

        // Validate required fields after trimming
        if (!name || !className || !section || !email || !phoneNo || !schoolCode || !password) {
          results.failed.push({
            row: i + 2, // Excel rows start from 2 (1 is header)
            data: studentData,
            error: 'Missing required fields or empty values after trimming'
          });
          results.failCount++;
          continue;
        }

        // Validate class name is not empty
        if (!className) {
          results.failed.push({
            row: i + 2,
            data: studentData,
            error: 'Class name cannot be empty'
          });
          results.failCount++;
          continue;
        }

        // Verify school code
        if (schoolCode !== admin.schoolCode) {
          results.failed.push({
            row: i + 2,
            data: studentData,
            error: 'School code does not match'
          });
          results.failCount++;
          continue;
        }

        // Check if student email already exists (case-insensitive)
        const existingStudent = await Student.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') }
        });
        if (existingStudent) {
          results.failed.push({
            row: i + 2,
            data: studentData,
            error: 'Email already exists'
          });
          results.failCount++;
          continue;
        }

        // Find or create class (handles case-insensitive matching)
        const classObj = await findOrCreateClass(className, section, school._id);

        // Generate unique student ID
        const studentId = generateStudentId(schoolCode);
        const uniqueId = studentId;

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create student with normalized values
        const student = new Student({
          name,
          email: email.toLowerCase(),
          phone: phoneNo,
          studentId,
          uniqueId,
          schoolId: school._id,
          classId: classObj._id,
          className: classObj.name, // Use the class name from found/created class
          section: classObj.section, // Use the section from found/created class
          password: hashedPassword,
          isActive: true
        });

        await student.save();

        // Add student to class if not already present
        if (!classObj.studentIds.some(id => id.toString() === student._id.toString())) {
          classObj.studentIds.push(student._id);
          await classObj.save();
        }

        results.successful.push({
          row: i + 2,
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          className: student.className,
          section: student.section
        });
        results.successCount++;

        console.log(`Student ${i + 2} created:`, { 
          studentId: student._id, 
          name: student.name,
          className: student.className,
          section: student.section
        });

      } catch (studentError) {
        console.error(`Error processing student ${i + 2}:`, studentError);
        
        let errorMessage = 'Failed to create student';
        if (studentError.code === 11000) {
          const field = Object.keys(studentError.keyPattern)[0];
          errorMessage = `Duplicate ${field}`;
        } else if (studentError.message) {
          errorMessage = studentError.message;
        }

        results.failed.push({
          row: i + 2,
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

    let { name, email, schoolCode, uniqueCode, password, phoneNo } = req.body;

    // Trim and normalize inputs
    name = name?.trim();
    email = email?.trim().toLowerCase();
    schoolCode = schoolCode?.trim();
    uniqueCode = uniqueCode?.trim();
    password = password?.trim();
    phoneNo = phoneNo?.trim();

    // Validate required fields after trimming
    if (!name || !email || !schoolCode || !uniqueCode || !password || !phoneNo) {
      return res.status(400).json({ message: 'All fields are required and cannot be empty' });
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

    // Check if teacher email already exists (case-insensitive)
    const Teacher = require('../models/Teacher');
    const existingTeacher = await Teacher.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
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
      email: email.toLowerCase(),
      phone: phoneNo,
      uniqueCode,
      schoolCode,
      schoolId: school._id,
      password: hashedPassword,
      classIds: []
    });

    await teacher.save();

    // Add teacher to school
    if (!school.teacherIds.some(id => id.toString() === teacher._id.toString())) {
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
        // Extract and normalize data
        let { name, email, schoolCode, uniqueCode, password, phoneNo } = teacherData;

        // Trim and normalize inputs
        name = name?.trim();
        email = email?.trim().toLowerCase();
        schoolCode = schoolCode?.trim();
        uniqueCode = uniqueCode?.trim();
        password = password?.trim();
        phoneNo = phoneNo?.trim();

        // Validate required fields after trimming
        if (!name || !email || !schoolCode || !uniqueCode || !password || !phoneNo) {
          results.failed.push({
            row: i + 2,
            data: teacherData,
            error: 'Missing required fields or empty values after trimming'
          });
          results.failCount++;
          continue;
        }

        // Verify school code
        if (schoolCode !== admin.schoolCode) {
          results.failed.push({
            row: i + 2,
            data: teacherData,
            error: 'School code does not match'
          });
          results.failCount++;
          continue;
        }

        // Check if teacher email already exists (case-insensitive)
        const existingTeacher = await Teacher.findOne({ 
          email: { $regex: new RegExp(`^${email}$`, 'i') }
        });
        if (existingTeacher) {
          results.failed.push({
            row: i + 2,
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
            row: i + 2,
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
          email: email.toLowerCase(),
          phone: phoneNo,
          uniqueCode,
          schoolCode,
          schoolId: school._id,
          password: hashedPassword,
          classIds: []
        });

        await teacher.save();

        // Add teacher to school
        if (!school.teacherIds.some(id => id.toString() === teacher._id.toString())) {
          school.teacherIds.push(teacher._id);
          await school.save();
        }

        results.successful.push({
          row: i + 2,
          name: teacher.name,
          email: teacher.email,
          uniqueCode: teacher.uniqueCode
        });
        results.successCount++;

        console.log(`Teacher ${i + 2} created:`, { teacherId: teacher._id, name: teacher.name });

      } catch (teacherError) {
        console.error(`Error processing teacher ${i + 2}:`, teacherError);
        
        let errorMessage = 'Failed to create teacher';
        if (teacherError.code === 11000) {
          const field = Object.keys(teacherError.keyPattern)[0];
          errorMessage = `Duplicate ${field}`;
        } else if (teacherError.message) {
          errorMessage = teacherError.message;
        }

        results.failed.push({
          row: i + 2,
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