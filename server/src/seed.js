const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const ConnectedAccount = require('./models/ConnectedAccount');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

dotenv.config();

const connUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/teamshub';

const seedDatabase = async () => {
  try {
    console.log(`[Seed Script] Connecting to MongoDB at ${connUri}...`);
    await mongoose.connect(connUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[Seed Script] Connected successfully!');

    // Clear existing data
    await User.deleteMany({});
    await ConnectedAccount.deleteMany({});
    await Chat.deleteMany({});
    await Message.deleteMany({});

    // Create Primary User
    const primaryUser = await User.create({
      _id: new mongoose.Types.ObjectId('65c1f0000000000000000001'),
      name: 'Aryan Thakor',
      email: 'aryan.thakor@teamshub.app',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
    });
    console.log('[Seed Script] Primary User created:', primaryUser.name);

    // Create Connected Accounts
    const acc1 = await ConnectedAccount.create({
      userId: primaryUser._id,
      accountId: 'acc-ms-1',
      microsoftUserId: 'ms-user-1',
      displayName: 'Company A (Work)',
      email: 'aryan.thakor@companya.com',
      tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
      accountType: 'Microsoft Work Account',
      status: 'connected',
      isDefault: true,
      badgeClass: 'badge-company-a',
      lastAuthenticatedAt: new Date()
    });

    const acc2 = await ConnectedAccount.create({
      userId: primaryUser._id,
      accountId: 'acc-ms-2',
      microsoftUserId: 'ms-user-2',
      displayName: 'Company B (Client)',
      email: 'apoorva@clientcorp.io',
      tenantId: '44a889cc-12e3-41ab-88bc-99ee0011aa22',
      accountType: 'Client Workspace Account',
      status: 'connected',
      isDefault: false,
      badgeClass: 'badge-company-b',
      lastAuthenticatedAt: new Date(Date.now() - 3600000)
    });

    const acc3 = await ConnectedAccount.create({
      userId: primaryUser._id,
      accountId: 'acc-ms-3',
      microsoftUserId: 'ms-user-3',
      displayName: 'Company C (Freelance)',
      email: 'freelance@agencyx.com',
      tenantId: '11bb22cc-33dd-44ee-55ff-66aa77bb88cc',
      accountType: 'Consultant Account',
      status: 'connected',
      isDefault: false,
      badgeClass: 'badge-company-c',
      lastAuthenticatedAt: new Date(Date.now() - 7200000)
    });
    console.log('[Seed Script] Connected Accounts created (Company A, B, C)');

    // Create Demo Chats
    const chat1 = await Chat.create({
      userId: primaryUser._id,
      connectedAccountId: acc1.accountId,
      microsoftChatId: 'chat-ms-1',
      participant: 'Neha Sharma',
      role: 'Product Manager',
      company: 'Company A',
      accountBadge: 'Work Account',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80',
      lastMessagePreview: 'Please review the updated Q3 roadmap document before our 3 PM sync.',
      lastMessageTimestamp: new Date(),
      unreadCount: 2,
      chatType: 'oneOnOne',
      onlineStatus: 'online'
    });

    const chat2 = await Chat.create({
      userId: primaryUser._id,
      connectedAccountId: acc2.accountId,
      microsoftChatId: 'chat-ms-2',
      participant: 'Rahul Mehta',
      role: 'Technical Lead',
      company: 'Client Corp',
      accountBadge: 'Client Workspace',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80',
      lastMessagePreview: 'The OAuth PKCE integration specs are ready for testing on staging.',
      lastMessageTimestamp: new Date(Date.now() - 1800000),
      unreadCount: 1,
      chatType: 'oneOnOne',
      onlineStatus: 'busy'
    });

    const chat3 = await Chat.create({
      userId: primaryUser._id,
      connectedAccountId: acc3.accountId,
      microsoftChatId: 'chat-ms-3',
      participant: 'Priya Desai',
      role: 'UI/UX Designer',
      company: 'Agency X',
      accountBadge: 'Freelance Workspace',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80',
      lastMessagePreview: 'I uploaded the Figma design tokens file for glassmorphic theme.',
      lastMessageTimestamp: new Date(Date.now() - 3600000),
      unreadCount: 0,
      chatType: 'oneOnOne',
      onlineStatus: 'away'
    });
    console.log('[Seed Script] Chats created successfully');

    // Create Initial Messages for Chat 1
    await Message.create([
      {
        userId: primaryUser._id,
        connectedAccountId: acc1.accountId,
        chatId: chat1.microsoftChatId,
        microsoftMessageId: 'msg-1',
        senderName: 'Neha Sharma',
        senderEmail: 'neha.sharma@companya.com',
        content: 'Hi Aryan! Have you checked the latest TeamsHub design update?',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date(Date.now() - 600000)
      },
      {
        userId: primaryUser._id,
        connectedAccountId: acc1.accountId,
        chatId: chat1.microsoftChatId,
        microsoftMessageId: 'msg-2',
        senderName: 'Aryan Thakor',
        senderEmail: 'aryan.thakor@companya.com',
        content: 'Yes Neha! The multi-account workspace switcher looks fantastic.',
        contentType: 'text',
        isOutgoing: true,
        createdDateTime: new Date(Date.now() - 300000)
      },
      {
        userId: primaryUser._id,
        connectedAccountId: acc1.accountId,
        chatId: chat1.microsoftChatId,
        microsoftMessageId: 'msg-3',
        senderName: 'Neha Sharma',
        senderEmail: 'neha.sharma@companya.com',
        content: 'Great! Please review the updated Q3 roadmap document before our 3 PM sync.',
        contentType: 'text',
        isOutgoing: false,
        createdDateTime: new Date()
      }
    ]);

    console.log('[Seed Script] Sample messages seeded!');
    console.log('==================================================');
    console.log('✅ Database Seeding Completed Successfully!');
    console.log('==================================================');
    process.exit(0);
  } catch (err) {
    console.error('[Seed Script Error]', err.message);
    process.exit(1);
  }
};

seedDatabase();
