// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = function(req, res, next) {
  // First check x-auth-token header (used by mobile app)
  let token = req.header('x-auth-token');
  
  // If no token in x-auth-token, check Authorization header
  if (!token) {
    const authHeader = req.header('Authorization');
    
    if (authHeader) {
      // Format should be "Bearer [token]"
      const parts = authHeader.split(' ');
      
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }
  }
  
  // If still no token found, return 401
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user from payload to request
    req.user = decoded.user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};