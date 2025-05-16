// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
require('dotenv').config();

// Admin Registration
exports.registerAdmin = async (req, res) => {
  const { name, email, password, schoolName, schoolCode } = req.body;

  try {
    // Check if admin already exists
    let admin = await Admin.findOne({ email });
    if (admin) {
      return res.status(400).json({ msg: 'Admin already exists' });
    }

    // Check if school code already exists
    let existingSchool = await School.findOne({ code: schoolCode });
    if (existingSchool) {
      return res.status(400).json({ msg: 'School code already in use' });
    }

    // Create new school
    const school = new School({
      name: schoolName,
      code: schoolCode
    });

    await school.save();

    // Create new admin
    admin = new Admin({
      name,
      email,
      password,
      schoolCode,
      schoolId: school._id
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(password, salt);

    await admin.save();

    // Update school with admin ID
    school.adminId = admin._id;
    await school.save();

    // Create token
    const payload = {
      user: {
        id: admin._id,
        role: 'admin'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Admin Login
exports.loginAdmin = async (req, res) => {
  const { email, password, schoolCode } = req.body;

  try {
    // Validate input
    if (!email || !password || !schoolCode) {
      return res.status(400).json({ message: 'Please provide email, password and school code' });
    }

    // Find admin by email and school code
    const admin = await Admin.findOne({ email, schoolCode });
    
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create payload for JWT
    const payload = {
      user: {
        id: admin._id,
        role: 'admin'
      }
    };

    // Sign token
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        
        // Return token and admin data (excluding password)
        const adminData = {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          schoolCode: admin.schoolCode,
          schoolId: admin.schoolId
        };
        
        res.json({
          token,
          admin: adminData
        });
      }
    );
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// Validate admin token endpoint
exports.validateToken = async (req, res) => {
  try {
    // req.user is set by the auth middleware
    const admin = await Admin.findById(req.user.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    res.json({ valid: true, admin });
  } catch (err) {
    console.error('Token validation error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};


// Teacher Registration
exports.registerTeacher = async (req, res) => {
  const { name, email, password, uniqueCode, schoolCode } = req.body;

  try {
    // Check if teacher already exists
    let teacher = await Teacher.findOne({ email });
    if (teacher) {
      return res.status(400).json({ msg: 'Teacher already exists' });
    }

    // Check if school exists
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      return res.status(400).json({ msg: 'Invalid school code' });
    }

    // Create new teacher
    teacher = new Teacher({
      name,
      email,
      uniqueCode,
      password,
      schoolCode,
      schoolId: school._id
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    teacher.password = await bcrypt.hash(password, salt);

    await teacher.save();

    // Update school with teacher ID
    school.teacherIds.push(teacher._id);
    await school.save();

    // Create token
    const payload = {
      user: {
        id: teacher._id,
        role: 'teacher'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

// Teacher Login
exports.loginTeacher = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check for teacher
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Return token
    const payload = {
      user: {
        id: teacher._id,
        role: 'teacher'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};


// Student Login
exports.loginStudent = async (req, res) => {
  const { email, password, schoolCode } = req.body;

  try {
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Check for student
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check school code
    if (schoolCode && student.schoolCode && student.schoolCode !== schoolCode) {
  return res.status(401).json({ message: 'Invalid school code' });
}

    // Return token
    const payload = {
      user: {
        id: student._id,
        role: 'student'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        
        // Return basic student info with token
        const studentData = {
          id: student._id,
          name: student.name,
          email: student.email,
          schoolCode: student.schoolCode,
          schoolId: student.schoolId,
          hasClass: Boolean(student.classId)  // Indicates if student already has a class
        };
        
        res.json({ 
          token,
          student: studentData
        });
      }
    );
  } catch (err) {
    console.error('Student login error:', err.message);
    res.status(500).send('Server error');
  }
};

// Register student
exports.registerStudent = async (req, res) => {
  console.log('Register student request body:', req.body);
  
  try {
    const { 
      name, 
      email, 
      phone, 
      studentId, 
      uniqueId, 
      schoolCode, 
      password,
      className,
      section 
    } = req.body;

    // Validate required fields
    if (!name || !email || !password || !schoolCode) {
      return res.status(400).json({ 
        message: 'Please provide all required fields: name, email, password, and schoolCode' 
      });
    }

    // Check if school exists
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      return res.status(400).json({ message: 'Invalid school code' });
    }

    // Check if student with email already exists
    let student = await Student.findOne({ email });
    if (student) {
      return res.status(400).json({ message: 'Student with this email already exists' });
    }

    // Create new student without requiring classId
    student = new Student({
      name,
      email,
      phone: phone || '',
      studentId: studentId || `STD${Date.now()}`,
      uniqueId: uniqueId || `STD${Date.now()}`,
      schoolId: school._id,
      password,
      // Store className and section if provided, but classId will be assigned later
      className: className || '',
      section: section || ''
      // classId is not required during registration

      // change the uniqueId generation logic as per your requirement with using the schoolCode+idno of student school
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    student.password = await bcrypt.hash(password, salt);

    await student.save();

    // Create JWT token
    const payload = {
      user: {
        id: student.id,
        type: 'student'
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          token,
          student: {
            id: student.id,
            name: student.name,
            email: student.email,
            studentId: student.studentId
          }
        });
      }
    );
  } catch (err) {
    console.error('Register student error:', err.message);
    
    // Check for MongoDB duplicate key error
    if (err.code === 11000) {
      let fieldName = Object.keys(err.keyPattern)[0];
      return res.status(400).json({ 
        message: `A student with this ${fieldName} already exists.` 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
};