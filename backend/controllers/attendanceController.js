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

exports.getAttendanceSummary = async (req, res) => {
  try {
    const { classId } = req.params;
    const { 
      startDate, 
      endDate, 
      sortBy = 'date', 
      sortOrder = 'desc',
      page = 1, 
      limit = 20 
    } = req.query;

    console.log('getAttendanceSummary called:', { 
      classId, 
      startDate, 
      endDate, 
      sortBy, 
      sortOrder,
      userId: req.user.id 
    });

    // Verify teacher is class admin for this class
    const authCheck = await verifyClassAdmin(req.user.id, classId);
    if (!authCheck.authorized) {
      return res.status(403).json({ msg: authCheck.error });
    }

    const { teacher, classObj } = authCheck;

    // Build date filter query
    const query = { 
      classId, 
      schoolId: teacher.schoolId 
    };

    // Apply date range filter if provided
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    // Build sort object
    const sortOptions = {};
    if (sortBy === 'date') {
      sortOptions.date = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'percentage') {
      // For percentage sorting, we'll sort after calculation
      sortOptions.date = -1; // Default to date desc for now
    } else if (sortBy === 'present') {
      sortOptions.date = -1; // Default to date desc
    } else {
      sortOptions.date = -1; // Default sort
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get attendance records with summary data
    const [attendanceRecords, totalCount, classStudents] = await Promise.all([
      Attendance.find(query)
        .select('date dateString totalStudents records createdAt updatedAt')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      Attendance.countDocuments(query),
      Student.countDocuments({ classId, schoolId: teacher.schoolId })
    ]);

    // Process records to create summary statistics
    const summaryData = attendanceRecords.map(record => {
      const presentCount = record.records.filter(r => r.status === 'present').length;
      const absentCount = record.records.filter(r => r.status === 'absent').length;
      const lateCount = record.records.filter(r => r.status === 'late').length;
      const excusedCount = record.records.filter(r => r.status === 'excused').length;
      
      const attendancePercentage = record.totalStudents > 0 
        ? Math.round((presentCount / record.totalStudents) * 100) 
        : 0;

      return {
        id: record._id,
        date: record.dateString,
        fullDate: record.date,
        summary: {
          totalStudents: record.totalStudents,
          totalEnrolled: classStudents, // Total students in class
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage,
          attendanceRate: `${presentCount}/${record.totalStudents}`
        },
        timestamps: {
          takenAt: record.createdAt,
          lastUpdated: record.updatedAt
        }
      };
    });

    // Apply custom sorting if needed
    if (sortBy === 'percentage') {
      summaryData.sort((a, b) => {
        return sortOrder === 'asc' 
          ? a.summary.attendancePercentage - b.summary.attendancePercentage
          : b.summary.attendancePercentage - a.summary.attendancePercentage;
      });
    } else if (sortBy === 'present') {
      summaryData.sort((a, b) => {
        return sortOrder === 'asc' 
          ? a.summary.present - b.summary.present
          : b.summary.present - a.summary.present;
      });
    }

    // Calculate overall statistics for the filtered period
    const overallStats = summaryData.reduce((acc, curr) => {
      acc.totalDays += 1;
      acc.totalPresent += curr.summary.present;
      acc.totalAbsent += curr.summary.absent;
      acc.totalLate += curr.summary.late;
      acc.totalExcused += curr.summary.excused;
      acc.totalPossibleAttendance += curr.summary.totalStudents;
      
      return acc;
    }, {
      totalDays: 0,
      totalPresent: 0,
      totalAbsent: 0,
      totalLate: 0,
      totalExcused: 0,
      totalPossibleAttendance: 0
    });

    // Calculate overall attendance percentage
    const overallPercentage = overallStats.totalPossibleAttendance > 0 
      ? Math.round((overallStats.totalPresent / overallStats.totalPossibleAttendance) * 100)
      : 0;

    // Get date range info
    const dateRange = summaryData.length > 0 ? {
      earliest: summaryData[summaryData.length - 1]?.date,
      latest: summaryData[0]?.date,
      totalDays: overallStats.totalDays
    } : null;

    res.json({
      success: true,
      summary: summaryData,
      overallStats: {
        ...overallStats,
        overallPercentage,
        averagePercentage: summaryData.length > 0 
          ? Math.round(summaryData.reduce((sum, item) => sum + item.summary.attendancePercentage, 0) / summaryData.length)
          : 0
      },
      dateRange,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalRecords: totalCount,
        hasMore: skip + summaryData.length < totalCount,
        limit: parseInt(limit)
      },
      classInfo: {
        id: classObj._id,
        name: classObj.name,
        section: classObj.section,
        totalEnrolledStudents: classStudents
      },
      filters: {
        startDate,
        endDate,
        sortBy,
        sortOrder
      }
    });

  } catch (err) {
    console.error('Error in getAttendanceSummary:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error while fetching attendance summary', 
      error: err.message 
    });
  }
};

// Updated getStudentAttendanceStats function in attendanceController.js
exports.getStudentAttendanceStats = async (req, res) => {
  try {
    // FIXED: Get studentId from params OR from authenticated user
    let { studentId } = req.params;
    
    // If no studentId in params, use the authenticated user's ID (for student's own stats)
    if (!studentId) {
      studentId = req.user.id;
    }
    
    const { 
      startDate, 
      endDate, 
      timeframe = 'all' // 'week', 'month', 'semester', 'year', 'all'
    } = req.query;

    console.log('getStudentAttendanceStats called:', { 
      studentId, 
      startDate, 
      endDate, 
      timeframe,
      requesterId: req.user.id,
      requesterRole: req.user.role 
    });

    // Authorization check - students can only view their own stats, teachers can view any student's stats
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ msg: 'Not authorized to view this student\'s attendance' });
    }

    // Find the student
    const student = await Student.findById(studentId)
      .populate('classId', 'name section')
      .populate('schoolId', 'name code');

    if (!student) {
      return res.status(404).json({ msg: 'Student not found' });
    }

    // If teacher is requesting, verify they have access to this student's class
    if (req.user.role === 'teacher') {
      const teacher = await Teacher.findById(req.user.id);
      if (!teacher) {
        return res.status(404).json({ msg: 'Teacher not found' });
      }

      // Check if teacher is admin of the student's class or teaches the student
      const hasAccess = student.classId && (
        (teacher.adminClassId && teacher.adminClassId.toString() === student.classId._id.toString()) ||
        (teacher.classIds && teacher.classIds.some(classId => classId.toString() === student.classId._id.toString()))
      );

      if (!hasAccess) {
        return res.status(403).json({ msg: 'Not authorized to view this student\'s attendance' });
      }
    }

    // Check if student has a class assigned
    if (!student.classId) {
      return res.status(404).json({ 
        msg: 'Student is not assigned to any class',
        studentInfo: {
          id: student._id,
          name: student.name,
          email: student.email
        }
      });
    }

    // Build date range query based on timeframe or custom dates
    let dateQuery = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateQuery = {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else {
      switch (timeframe) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateQuery = { date: { $gte: weekAgo, $lte: now } };
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          dateQuery = { date: { $gte: monthAgo, $lte: now } };
          break;
        case 'semester':
          const semesterAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          dateQuery = { date: { $gte: semesterAgo, $lte: now } };
          break;
        case 'year':
          const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          dateQuery = { date: { $gte: yearAgo, $lte: now } };
          break;
        case 'all':
        default:
          // No date filter - get all records
          break;
      }
    }

    // Find all attendance records for the student's class within the date range
    const query = {
      classId: student.classId._id,
      schoolId: student.schoolId._id,
      ...dateQuery
    };

    const attendanceRecords = await Attendance.find(query)
      .select('date dateString records totalStudents')
      .sort({ date: 1 }); // Sort by date ascending for trend analysis

    // Filter records to get only this student's attendance
    const studentAttendanceData = [];
    const monthlyStats = {};
    const weeklyStats = {};
    
    let totalDays = 0;
    let presentDays = 0;
    let absentDays = 0;
    let lateDays = 0;
    let excusedDays = 0;

    attendanceRecords.forEach(record => {
      const studentRecord = record.records.find(r => r.studentId.toString() === studentId);
      
      if (studentRecord) {
        totalDays++;
        const recordDate = new Date(record.date);
        const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;
        const weekKey = getWeekKey(recordDate);

        // Initialize monthly stats if needed
        if (!monthlyStats[monthKey]) {
          monthlyStats[monthKey] = {
            month: recordDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0
          };
        }

        // Initialize weekly stats if needed
        if (!weeklyStats[weekKey]) {
          weeklyStats[weekKey] = {
            week: `Week of ${recordDate.toDateString()}`,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0
          };
        }

        // Count attendance by status
        switch (studentRecord.status) {
          case 'present':
            presentDays++;
            monthlyStats[monthKey].present++;
            weeklyStats[weekKey].present++;
            break;
          case 'absent':
            absentDays++;
            monthlyStats[monthKey].absent++;
            weeklyStats[weekKey].absent++;
            break;
          case 'late':
            lateDays++;
            monthlyStats[monthKey].late++;
            weeklyStats[weekKey].late++;
            break;
          case 'excused':
            excusedDays++;
            monthlyStats[monthKey].excused++;
            weeklyStats[weekKey].excused++;
            break;
        }

        monthlyStats[monthKey].total++;
        weeklyStats[weekKey].total++;

        // Store individual record for detailed view
        studentAttendanceData.push({
          date: record.dateString,
          fullDate: record.date,
          status: studentRecord.status,
          remarks: studentRecord.remarks || '',
          classSize: record.totalStudents
        });
      }
    });

    // Calculate percentages and statistics
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
    const latePercentage = totalDays > 0 ? Math.round((lateDays / totalDays) * 100) : 0;
    const absentPercentage = totalDays > 0 ? Math.round((absentDays / totalDays) * 100) : 0;
    
    // Calculate monthly percentages
    Object.keys(monthlyStats).forEach(month => {
      const stats = monthlyStats[month];
      stats.attendancePercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      stats.absentPercentage = stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0;
      stats.latePercentage = stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0;
    });

    // Calculate weekly percentages
    Object.keys(weeklyStats).forEach(week => {
      const stats = weeklyStats[week];
      stats.attendancePercentage = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      stats.absentPercentage = stats.total > 0 ? Math.round((stats.absent / stats.total) * 100) : 0;
      stats.latePercentage = stats.total > 0 ? Math.round((stats.late / stats.total) * 100) : 0;
    });

    // Calculate streaks
    const { currentStreak, longestPresentStreak, longestAbsentStreak } = calculateStreaks(studentAttendanceData);

    // Get recent attendance pattern (last 10 days)
    const recentAttendance = studentAttendanceData.slice(-10);

    // Calculate trends
    const trends = calculateTrends(monthlyStats);

    // Get date range info
    const dateRangeInfo = studentAttendanceData.length > 0 ? {
      startDate: studentAttendanceData[0].date,
      endDate: studentAttendanceData[studentAttendanceData.length - 1].date,
      totalDaysRecorded: totalDays
    } : null;

    // Performance insights
    const insights = generateInsights({
      attendancePercentage,
      absentPercentage,
      latePercentage,
      currentStreak,
      longestPresentStreak,
      trends,
      totalDays
    });

    res.json({
      success: true,
      studentInfo: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
        className: student.classId.name,
        section: student.classId.section,
        schoolName: student.schoolId.name
      },
      overallStats: {
        totalDaysRecorded: totalDays,
        presentDays,
        absentDays,
        lateDays,
        excusedDays,
        attendancePercentage,
        absentPercentage,
        latePercentage,
        punctualityScore: totalDays > 0 ? Math.round(((presentDays + excusedDays) / totalDays) * 100) : 0
      },
      streaks: {
        currentStreak,
        longestPresentStreak,
        longestAbsentStreak
      },
      monthlyBreakdown: Object.values(monthlyStats).sort((a, b) => new Date(a.month) - new Date(b.month)),
      weeklyBreakdown: Object.values(weeklyStats).slice(-8), // Last 8 weeks
      recentAttendance,
      trends,
      insights,
      dateRange: dateRangeInfo,
      filters: {
        timeframe,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });

  } catch (err) {
    console.error('Error in getStudentAttendanceStats:', err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error while fetching student attendance statistics', 
      error: err.message 
    });
  }
};

// Helper functions remain the same
function getWeekKey(date) {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return `${startOfWeek.getFullYear()}-W${Math.ceil((startOfWeek.getDate()) / 7)}`;
}

function calculateStreaks(attendanceData) {
  if (attendanceData.length === 0) {
    return { currentStreak: { type: 'none', count: 0 }, longestPresentStreak: 0, longestAbsentStreak: 0 };
  }

  let currentStreak = { type: 'none', count: 0 };
  let longestPresentStreak = 0;
  let longestAbsentStreak = 0;
  
  let currentPresentStreak = 0;
  let currentAbsentStreak = 0;

  // Calculate from most recent backwards for current streak
  for (let i = attendanceData.length - 1; i >= 0; i--) {
    const status = attendanceData[i].status;
    
    if (i === attendanceData.length - 1) {
      // Set initial current streak
      if (status === 'present') {
        currentStreak = { type: 'present', count: 1 };
      } else if (status === 'absent') {
        currentStreak = { type: 'absent', count: 1 };
      } else if (status === 'late') {
        currentStreak = { type: 'late', count: 1 };
      }
    } else {
      // Continue or break streak
      if (status === currentStreak.type) {
        currentStreak.count++;
      } else {
        break;
      }
    }
  }

  // Calculate longest streaks
  for (let i = 0; i < attendanceData.length; i++) {
    const status = attendanceData[i].status;
    
    if (status === 'present') {
      currentPresentStreak++;
      currentAbsentStreak = 0;
    } else if (status === 'absent') {
      currentAbsentStreak++;
      currentPresentStreak = 0;
    } else {
      // Late or excused breaks both streaks
      if (currentPresentStreak > longestPresentStreak) {
        longestPresentStreak = currentPresentStreak;
      }
      if (currentAbsentStreak > longestAbsentStreak) {
        longestAbsentStreak = currentAbsentStreak;
      }
      currentPresentStreak = 0;
      currentAbsentStreak = 0;
    }
  }

  // Check final streaks
  if (currentPresentStreak > longestPresentStreak) {
    longestPresentStreak = currentPresentStreak;
  }
  if (currentAbsentStreak > longestAbsentStreak) {
    longestAbsentStreak = currentAbsentStreak;
  }

  return { currentStreak, longestPresentStreak, longestAbsentStreak };
}

function calculateTrends(monthlyStats) {
  const months = Object.values(monthlyStats).sort((a, b) => new Date(a.month) - new Date(b.month));
  
  if (months.length < 2) {
    return { trend: 'insufficient_data', change: 0 };
  }

  const recentMonth = months[months.length - 1];
  const previousMonth = months[months.length - 2];

  const change = recentMonth.attendancePercentage - previousMonth.attendancePercentage;
  
  let trend = 'stable';
  if (change > 5) trend = 'improving';
  else if (change < -5) trend = 'declining';

  return { trend, change: Math.round(change) };
}

function generateInsights({ attendancePercentage, absentPercentage, latePercentage, currentStreak, longestPresentStreak, trends, totalDays }) {
  const insights = [];

  // Overall performance insights
  if (attendancePercentage >= 90) {
    insights.push({
      type: 'positive',
      title: 'Excellent Attendance',
      message: `You have maintained ${attendancePercentage}% attendance - keep up the great work!`
    });
  } else if (attendancePercentage >= 75) {
    insights.push({
      type: 'neutral',
      title: 'Good Attendance',
      message: `Your ${attendancePercentage}% attendance is good, but there's room for improvement.`
    });
  } else {
    insights.push({
      type: 'warning',
      title: 'Attendance Needs Attention',
      message: `Your ${attendancePercentage}% attendance is below the recommended level. Consider improving your attendance.`
    });
  }

  // Streak insights
  if (currentStreak.type === 'present' && currentStreak.count >= 5) {
    insights.push({
      type: 'positive',
      title: 'Great Streak!',
      message: `You're on a ${currentStreak.count}-day present streak. Keep it going!`
    });
  } else if (currentStreak.type === 'absent' && currentStreak.count >= 3) {
    insights.push({
      type: 'warning',
      title: 'Absence Pattern',
      message: `You've been absent for ${currentStreak.count} consecutive days. Please ensure regular attendance.`
    });
  }

  // Punctuality insights
  if (latePercentage > 10) {
    insights.push({
      type: 'suggestion',
      title: 'Punctuality Reminder',
      message: `You've been late ${latePercentage}% of the time. Try to arrive on time for better academic performance.`
    });
  }

  // Trend insights
  if (trends.trend === 'improving') {
    insights.push({
      type: 'positive',
      title: 'Improving Trend',
      message: `Your attendance has improved by ${trends.change}% compared to last month. Great progress!`
    });
  } else if (trends.trend === 'declining') {
    insights.push({
      type: 'warning',
      title: 'Declining Trend',
      message: `Your attendance has decreased by ${Math.abs(trends.change)}% compared to last month. Focus on being more regular.`
    });
  }

  // Long-term insights
  if (longestPresentStreak >= 20) {
    insights.push({
      type: 'achievement',
      title: 'Consistency Champion',
      message: `Your longest present streak is ${longestPresentStreak} days. Excellent consistency!`
    });
  }

  return insights;
}