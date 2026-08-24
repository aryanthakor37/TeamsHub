const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamshub';

mongoose.connect(connUri).then(async () => {
  console.log('Connected to MongoDB Atlas...');
  
  try {
    const chatDrop = await mongoose.connection.collection('chats').drop().catch(() => 'Already empty/dropped');
    console.log('Chats collection dropped:', chatDrop);
  } catch (e) {
    console.log('Chats drop notice:', e.message);
  }

  try {
    const msgDrop = await mongoose.connection.collection('messages').drop().catch(() => 'Already empty/dropped');
    console.log('Messages collection dropped:', msgDrop);
  } catch (e) {
    console.log('Messages drop notice:', e.message);
  }

  console.log('MongoDB chats & messages collections successfully wiped! Zero-storage mode enforced.');
  process.exit(0);
}).catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});
