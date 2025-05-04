// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');

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
  const { email, password } = req.body;

  try {
    // Check for admin
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Return token
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

// Student Registration
exports.registerStudent = async (req, res) => {
  const { name, email, password, studentId, uniqueId, phone, schoolCode, class: className, section } = req.body;

  try {
    // Check if student already exists
    let student = await Student.findOne({ email });
    if (student) {
      return res.status(400).json({ msg: 'Student already exists' });
    }

    // Check if school exists
    const school = await School.findOne({ code: schoolCode });
    if (!school) {
      return res.status(400).json({ msg: 'Invalid school code' });
    }

    // Check if requested class exists
    let classObj = await Class.findOne({ 
      name: className, 
      section: section,
      schoolId: school._id 
    });

    if (!classObj) {
      return res.status(400).json({ msg: 'Class not found in this school' });
    }

    // Create new student
    student = new Student({
      name,
      email,
      phone,
      password,
      studentId,
      uniqueId,
      schoolCode,
      class: className,
      section,
      classId: classObj._id,
      schoolId: school._id
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    student.password = await bcrypt.hash(password, salt);

    await student.save();

    // Update school with student ID
    school.studentIds.push(student._id);
    await school.save();

    // Update class with student ID
    classObj.studentIds.push(student._id);
    await classObj.save();

    // Create token
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
  const { email, password } = req.body;

  try {
    // Check for student
    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
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
        res.json({ token });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};