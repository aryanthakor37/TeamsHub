const mongoose = require('mongoose');

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamshub';
  try {
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 3000
    });
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`[MongoDB Warning] Could not connect to database at ${connUri}: ${error.message}`);
    console.warn('[MongoDB Warning] API Server will continue running for Phase 1 endpoints.');
  }
};

module.exports = connectDB;
