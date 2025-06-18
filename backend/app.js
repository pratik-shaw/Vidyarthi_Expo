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
const subjectRoutes = require('./routes/subjectRoutes'); // NEW ROUTE
const examRoutes = require('./routes/examRoutes'); // NEW ROUTE
const markRoutes = require('./routes/markRoutes'); // NEW ROUTE
const conductRoutes = require('./routes/conductRoutes'); // NEW ROUTE
const eventRoutes = require('./routes/eventRoutes'); // Uncomment if using events
const materialRoutes = require('./routes/materialRoutes'); // Uncomment if using materials
// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/class', classRoutes);
app.use('/api/subjects', subjectRoutes); // NEW ROUTE USAGE
app.use('/api/exams', examRoutes); // NEW ROUTE USAGE
app.use('/api/marks', markRoutes); // NEW ROUTE USAGE
app.use('/api/conduct', conductRoutes); // NEW ROUTE USAGE
app.use('/api/events', eventRoutes); // Uncomment if using events
app.use('/api/materials', materialRoutes); // Uncomment if using materials

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
  console.log(`Server running on port ${PORT}`);
});
