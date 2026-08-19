const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamshub';

mongoose.connect(connUri).then(async () => {
  console.log('Connected to MongoDB Atlas...');
  
  // Wipe fake demo users
  const userRes = await mongoose.connection.collection('users').deleteMany({
    email: { $nin: ['aryankumar.kumrecha@estatic-infotech.com'] }
  });
  console.log('Wiped fake demo users count:', userRes.deletedCount);

  // Wipe fake demo connected accounts
  const accRes = await mongoose.connection.collection('connectedaccounts').deleteMany({
    email: { $nin: ['aryankumar.kumrecha@estatic-infotech.com'] }
  });
  console.log('Wiped fake demo accounts count:', accRes.deletedCount);

  // Wipe fake demo chats
  const chatRes = await mongoose.connection.collection('chats').deleteMany({
    $or: [
      { participant: { $in: ['Neha Sharma', 'Rahul Mehta', 'Priya Desai', 'Rahul Patel', 'Apoorva Sharma', 'Client Sync Channel'] } },
      { company: { $in: ['Company A', 'Company B', 'Company C', 'Client Corp', 'Agency X', 'Company A (Work)'] } },
      { microsoftChatId: { $in: ['chat-ms-1', 'chat-ms-2', 'chat-ms-3', 'chat-graph-101', 'chat-graph-102', 'chat-graph-103'] } }
    ]
  });
  console.log('Wiped fake demo chats count:', chatRes.deletedCount);

  // Wipe fake demo messages
  const msgRes = await mongoose.connection.collection('messages').deleteMany({
    $or: [
      { chatId: { $in: ['chat-ms-1', 'chat-ms-2', 'chat-ms-3', 'chat-graph-101', 'chat-graph-102'] } },
      { senderName: { $in: ['Neha Sharma', 'Rahul Mehta', 'Priya Desai', 'Rahul Patel', 'Apoorva Sharma'] } }
    ]
  });
  console.log('Wiped fake demo messages count:', msgRes.deletedCount);

  process.exit(0);
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});
