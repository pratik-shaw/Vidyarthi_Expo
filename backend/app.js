// app.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

// Import routes
const adminRoutes = require('./routes/adminRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const classRoutes = require('./routes/classRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const examRoutes = require('./routes/examRoutes');
const markRoutes = require('./routes/markRoutes');
const conductRoutes = require('./routes/conductRoutes');
const eventRoutes = require('./routes/eventRoutes');
const materialRoutes = require('./routes/materialRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const queryRoutes = require('./routes/queryRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const adminAccountRoutes = require('./routes/adminAccountRoutes');

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// IMPORTANT: More specific routes MUST come BEFORE general routes
app.use('/api/admin/accounts', adminAccountRoutes); // ✅ This first
app.use('/api/admin', adminRoutes);                 // ✅ This second
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/class', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/marks', markRoutes);
app.use('/api/conduct', conductRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/queries', queryRoutes);
app.use('/api/attendance', attendanceRoutes);

// Simple test route
app.get('/', (req, res) => {
  res.send('School Management API is running');
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Connection successful!' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Admin account routes: http://localhost:${PORT}/api/admin/accounts`);
});