// controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

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

// Take attendance for a specific date
exports.takeAttendance = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date, records } = req.body;

    console.log('takeAttendance called:', { classId, date, recordsCount: records?.length, userId: req.user.id });

    // Validate input
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ msg: 'Date and attendance records are required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Parse and validate date
    const attendanceDate = new Date(date);
    const dateString = attendanceDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    // Check if attendance already exists for this date
    const existingAttendance = await Attendance.findOne({ 
      classId, 
      dateString 
    });

    if (existingAttendance) {
      return res.status(400).json({ 
        msg: 'Attendance already taken for this date',
        existingDate: dateString
      });
    }

    // Validate all student IDs belong to this class
    const classStudents = await Student.find({ 
      classId: classId,
      schoolId: teacher.schoolId 
    });

    const validStudentIds = classStudents.map(s => s._id.toString());
    const recordStudentIds = records.map(r => r.studentId);

    // Check if all records are for valid students
    const invalidStudents = recordStudentIds.filter(id => !validStudentIds.includes(id));
    if (invalidStudents.length > 0) {
      return res.status(400).json({ 
        msg: 'Some students do not belong to this class',
        invalidStudents
      });
    }

    // Process attendance records
    const processedRecords = records.map(record => ({
      studentId: record.studentId,
      studentName: record.studentName || classStudents.find(s => s._id.toString() === record.studentId)?.name || 'Unknown',
      status: record.status,
      remarks: record.remarks || ''
    }));

    // Create attendance document
    const attendance = new Attendance({
      classId,
      schoolId: teacher.schoolId,
      classAdminId: teacher._id,
      date: attendanceDate,
      dateString,
      records: processedRecords,
      totalStudents: processedRecords.length
    });

    await attendance.save();

    console.log('Attendance taken successfully:', attendance._id);

    res.status(201).json({
      msg: 'Attendance taken successfully',
      attendance: {
        id: attendance._id,
        date: dateString,
        totalStudents: attendance.totalStudents,
        presentCount: attendance.presentCount,
        absentCount: attendance.absentCount,
        lateCount: attendance.lateCount,
        attendancePercentage: attendance.getAttendancePercentage()
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in takeAttendance:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Attendance already exists for this date' });
    }

    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Update attendance for a specific date
exports.updateAttendance = async (req, res) => {
  try {
    const { classId, attendanceId } = req.params;
    const { records } = req.body;

    console.log('updateAttendance called:', { classId, attendanceId, userId: req.user.id });

    // Validate input
    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ msg: 'Attendance records are required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher } = authCheck;

    // Find existing attendance
    const attendance = await Attendance.findOne({ 
      _id: attendanceId, 
      classId, 
      schoolId: teacher.schoolId 
    });

    if (!attendance) {
      return res.status(404).json({ msg: 'Attendance record not found' });
    }

    // Update records
    const processedRecords = records.map(record => ({
      studentId: record.studentId,
      studentName: record.studentName,
      status: record.status,
      remarks: record.remarks || ''
    }));

    attendance.records = processedRecords;
    await attendance.save();

    console.log('Attendance updated successfully:', attendanceId);

    res.json({
      msg: 'Attendance updated successfully',
      attendance: {
        id: attendance._id,
        date: attendance.dateString,
        totalStudents: attendance.totalStudents,
        presentCount: attendance.presentCount,
        absentCount: attendance.absentCount,
        lateCount: attendance.lateCount,
        attendancePercentage: attendance.getAttendancePercentage()
      }
    });

  } catch (err) {
    console.error('Error in updateAttendance:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get attendance for a specific date
exports.getAttendanceByDate = async (req, res) => {
  try {
    const { classId } = req.params;
    const { date } = req.query;

    console.log('getAttendanceByDate called:', { classId, date, userId: req.user.id });

    if (!date) {
      return res.status(400).json({ msg: 'Date is required' });
    }

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;
    const dateString = new Date(date).toISOString().split('T')[0];

    // Find attendance for the date
    const attendance = await Attendance.findOne({ 
      classId, 
      dateString,
      schoolId: teacher.schoolId 
    });

    if (!attendance) {
      return res.status(404).json({ 
        msg: 'No attendance found for this date',
        date: dateString
      });
    }

    res.json({
      attendance: {
        id: attendance._id,
        date: attendance.dateString,
        records: attendance.records,
        totalStudents: attendance.totalStudents,
        presentCount: attendance.presentCount,
        absentCount: attendance.absentCount,
        lateCount: attendance.lateCount,
        attendancePercentage: attendance.getAttendancePercentage(),
        takenAt: attendance.createdAt
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in getAttendanceByDate:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get attendance history for a class
exports.getAttendanceHistory = async (req, res) => {
  try {
    const { classId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    console.log('getAttendanceHistory called:', { classId, startDate, endDate, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Build query
    const query = { 
      classId, 
      schoolId: teacher.schoolId 
    };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get paginated results
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [attendanceRecords, totalCount] = await Promise.all([
      Attendance.find(query)
        .select('-records') // Exclude individual records for performance
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query)
    ]);

    const attendanceData = attendanceRecords.map(record => ({
      id: record._id,
      date: record.dateString,
      totalStudents: record.totalStudents,
      presentCount: record.presentCount,
      absentCount: record.absentCount,
      lateCount: record.lateCount,
      attendancePercentage: record.getAttendancePercentage(),
      takenAt: record.createdAt
    }));

    res.json({
      attendance: attendanceData,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        hasMore: skip + attendanceRecords.length < totalCount
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in getAttendanceHistory:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Get students list for attendance (to help with taking attendance)
exports.getStudentsForAttendance = async (req, res) => {
  try {
    const { classId } = req.params;

    console.log('getStudentsForAttendance called:', { classId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Get all students in this class
    const students = await Student.find({ 
      classId, 
      schoolId: teacher.schoolId 
    })
    .select('name email studentId')
    .sort({ name: 1 });

    res.json({
      students: students.map(student => ({
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId
      })),
      totalStudents: students.length,
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section
      }
    });

  } catch (err) {
    console.error('Error in getStudentsForAttendance:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};

// Delete attendance record
exports.deleteAttendance = async (req, res) => {
  try {
    const { classId, attendanceId } = req.params;

    console.log('deleteAttendance called:', { classId, attendanceId, userId: req.user.id });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher } = authCheck;

    // Find and delete attendance
    const attendance = await Attendance.findOneAndDelete({ 
      _id: attendanceId, 
      classId, 
      schoolId: teacher.schoolId 
    });

    if (!attendance) {
      return res.status(404).json({ msg: 'Attendance record not found' });
    }

    console.log('Attendance deleted successfully:', attendanceId);

    res.json({
      msg: 'Attendance record deleted successfully',
      deletedDate: attendance.dateString
    });

  } catch (err) {
    console.error('Error in deleteAttendance:', err);
    res.status(500).json({ 
      msg: 'Server error', 
      error: err.message 
    });
  }
};