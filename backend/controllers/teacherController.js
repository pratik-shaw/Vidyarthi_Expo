// controllers/teacherController.js
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Student = require('../models/Student');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Get teacher profile
exports.getProfile = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('-password')
      .populate('adminClassId', 'name section')
      .populate('classIds', 'name section grade')
      .populate('schoolId', 'name address city state');
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    res.json({ teacher });
  } catch (err) {
    console.error('Error fetching teacher profile:', err.message);
    res.status(500).send('Server error');
  }
};

// Update teacher profile
exports.updateProfile = async (req, res) => {
  try {
    const {
      phone,
      address,
      city,
      state,
      zip,
      subjects,
      qualification,
      experience,
      profileImage,
      dateOfBirth,
      gender,
      emergencyContact,
      socialMedia,
      bio
    } = req.body;

    // Find teacher
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Validate experience if provided
    if (experience !== undefined && (experience < 0 || experience > 50)) {
      return res.status(400).json({ msg: 'Experience should be between 0 and 50 years' });
    }

    // Validate phone number format if provided
    if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ msg: 'Invalid phone number format' });
    }

    // Validate date of birth if provided
    if (dateOfBirth) {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 18 || age > 80) {
        return res.status(400).json({ msg: 'Age should be between 18 and 80 years' });
      }
    }

    // Update fields
    const updateFields = {};
    
    if (phone !== undefined) updateFields.phone = phone;
    if (address !== undefined) updateFields.address = address;
    if (city !== undefined) updateFields.city = city;
    if (state !== undefined) updateFields.state = state;
    if (zip !== undefined) updateFields.zip = zip;
    if (subjects !== undefined) updateFields.subjects = subjects;
    if (qualification !== undefined) updateFields.qualification = qualification;
    if (experience !== undefined) updateFields.experience = experience;
    if (profileImage !== undefined) updateFields.profileImage = profileImage;
    if (dateOfBirth !== undefined) updateFields.dateOfBirth = dateOfBirth;
    if (gender !== undefined) updateFields.gender = gender;
    if (emergencyContact !== undefined) updateFields.emergencyContact = emergencyContact;
    if (socialMedia !== undefined) updateFields.socialMedia = socialMedia;
    if (bio !== undefined) updateFields.bio = bio;

    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password').populate('adminClassId', 'name section').populate('classIds', 'name section grade');

    res.json({ 
      msg: 'Profile updated successfully',
      teacher: updatedTeacher 
    });
  } catch (err) {
    console.error('Error updating teacher profile:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: 'Validation error', errors: err.errors });
    }
    res.status(500).send('Server error');
  }
};

// Change password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ msg: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ msg: 'New password must be at least 6 characters long' });
    }

    // Find teacher
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await Teacher.findByIdAndUpdate(req.user.id, { password: hashedPassword });

    res.json({ msg: 'Password updated successfully' });
  } catch (err) {
    console.error('Error changing password:', err.message);
    res.status(500).send('Server error');
  }
};

// Get classes for a teacher
exports.getClasses = async (req, res) => {
  try {
    // Get teacher data
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    // If teacher has no classes
    if (!teacher.classIds || teacher.classIds.length === 0) {
      return res.json({ classes: [] });
    }
    
    // Get all classes assigned to this teacher
    const classes = await Class.find({
      _id: { $in: teacher.classIds }
    });
    
    // For each class, count the number of students and check if teacher is admin
    const classesWithDetails = await Promise.all(classes.map(async (classItem) => {
      const studentsCount = await Student.countDocuments({ classId: classItem._id });
      const isAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classItem._id.toString();
      
      return {
        _id: classItem._id,
        name: classItem.name,
        grade: classItem.grade,
        section: classItem.section,
        studentsCount,
        schedule: classItem.schedule || '',
        room: classItem.room || '',
        isAdmin
      };
    }));
    
    // Return with the classes array in a nested object to match the client expectation
    res.json({ classes: classesWithDetails });
  } catch (err) {
    console.error('Error fetching teacher classes:', err.message);
    res.status(500).send('Server error');
  }
};

// Get students by class ID
exports.getStudentsByClass = async (req, res) => {
  try {
    const { classId } = req.params;
    
    // Check if teacher is assigned to this class
    const teacher = await Teacher.findById(req.user.id);
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    if (!teacher.classIds.includes(classId)) {
      return res.status(403).json({ msg: 'Not authorized to access this class' });
    }
    
    // Get class details
    const classDetails = await Class.findById(classId);
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }

    const students = await Student.find({ classId }).select('-password');
    
    // Check if teacher is admin of this class
    const isAdmin = teacher.adminClassId && teacher.adminClassId.toString() === classId;
    
    // Format the response to include both class details and students
    res.json({
      class: {
        _id: classDetails._id,
        name: classDetails.name,
        grade: classDetails.grade,
        section: classDetails.section,
        isAdmin
      },
      students
    });
  } catch (err) {
    console.error('Error fetching students by class:', err.message);
    
    // Check if the classId is not a valid ObjectId
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid class ID format' });
    }
    
    res.status(500).send('Server error');
  }
};

// Get admin class details and students (for class admin)
exports.getAdminClass = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).populate('adminClassId');
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    if (!teacher.adminClassId) {
      return res.status(404).json({ msg: 'No admin class assigned' });
    }
    
    // Get students in the admin class
    const students = await Student.find({ classId: teacher.adminClassId._id }).select('-password');
    
    // Get all teachers assigned to this class
    const teachers = await Teacher.find({ 
      classIds: teacher.adminClassId._id 
    }).select('name email');
    
    res.json({
      adminClass: {
        _id: teacher.adminClassId._id,
        name: teacher.adminClassId.name,
        section: teacher.adminClassId.section,
        grade: teacher.adminClassId.grade || '',
        studentsCount: students.length,
        teachersCount: teachers.length
      },
      students,
      teachers
    });
  } catch (err) {
    console.error('Error fetching admin class:', err.message);
    res.status(500).send('Server error');
  }
};

// Get specific admin class details by classId (for class admin)
exports.getAdminClassById = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ msg: 'Teacher not found' });
    }
    
    // Check if the teacher is admin of the requested class
    if (!teacher.adminClassId || teacher.adminClassId.toString() !== classId) {
      return res.status(403).json({ msg: 'Not authorized as admin for this class' });
    }
    
    // Get the class details
    const classDetails = await Class.findById(classId);
    if (!classDetails) {
      return res.status(404).json({ msg: 'Class not found' });
    }
    
    // Get students in the class
    const students = await Student.find({ classId }).select('-password');
    
    // Get all teachers assigned to this class
    const teachers = await Teacher.find({ 
      classIds: classId 
    }).select('name email subject');
    
    // Return in the format expected by frontend
    res.json({
      _id: classDetails._id,
      name: classDetails.name,
      section: classDetails.section,
      grade: classDetails.grade || '',
      teacherIds: teachers,
      studentIds: students,
      schoolId: classDetails.schoolId,
      schedule: classDetails.schedule || '',
      room: classDetails.room || '',
      description: classDetails.description || ''
    });
  } catch (err) {
    console.error('Error fetching admin class by ID:', err.message);
    
    // Check if the classId is not a valid ObjectId
    if (err instanceof mongoose.Error.CastError) {
      return res.status(400).json({ msg: 'Invalid class ID format' });
    }
    
    res.status(500).send('Server error');
  }
};