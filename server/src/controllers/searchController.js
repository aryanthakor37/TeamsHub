const Chat = require('../models/Chat');
const Message = require('../models/Message');
const ConnectedAccount = require('../models/ConnectedAccount');
const { isMockMode, getDemoMultiAccountChats } = require('../services/graphService');

/**
 * GET /api/search?q=query&filter=All
 * Perform cross-tenant global search across connected accounts, chats, messages, and files.
 */
const globalSearch = async (req, res) => {
  try {
    const query = req.query.q || '';
    const filter = req.query.filter || 'All';
    const userId = req.user?._id;

    if (!query || !query.trim()) {
      return res.status(200).json({
        success: true,
        data: {
          messages: [],
          files: [],
          people: [],
          accounts: []
        }
      });
    }

    const regex = new RegExp(query.trim(), 'i');

    // ── Mock Mode fallback ──
    const allDemoFiles = [
      { id: 'file-photo-aryan-1', name: 'Photo from Aryan Kumrecha', category: 'Images', size: '1.2 MB', account: 'Teams Chat', sender: 'Aryan Kumrecha', date: 'Today' },
      { id: 'file-photo-pratham-1', name: 'Photo from Pratham Rao', category: 'Images', size: '2.8 MB', account: 'Teams Chat', sender: 'Pratham Rao', date: 'Yesterday' },
      { id: 'file-image-jpg-1', name: 'Image.jpg', category: 'Images', size: '122.8 KB', account: 'OneDrive / Teams', sender: 'Meet Soneji', date: '12 Aug' },
      { id: 'file-project-plan', name: 'TeamsHub_Project_Plan.pdf', category: 'PDF', size: '81.9 KB', account: 'OneDrive / Teams', sender: 'Aryan Kumrecha', date: 'Today' },
      { id: 'file-telegram-overview', name: 'Telegram-Drive-Project-Overview.docx', category: 'Documents', size: '13.0 KB', account: 'OneDrive / Teams', sender: 'Aryan Kumrecha', date: 'Yesterday' },
      { id: 'file-project-presentation', name: 'Project Presentation', category: 'Documents', size: '4.5 MB', account: 'Teams Chat', sender: 'Aryan Kumrecha', date: '10 Aug' },
      { id: 'file-ai-agent', name: 'AI Mobile Control Agent.pdf', category: 'PDF', size: '1.3 MB', account: 'OneDrive / Teams', sender: 'Aryan Kumrecha', date: '11 Aug' },
      { id: 'file-1', name: 'Project_Report.pdf', category: 'PDF', size: '2.4 MB', account: 'Company A', sender: 'Rahul Patel', date: '12 Aug' },
      { id: 'file-2', name: 'UI_Design_System.png', category: 'Images', size: '4.8 MB', account: 'Company B', sender: 'Apoorva Sharma', date: '12 Aug' },
      { id: 'file-3', name: 'SourceCode_Phase1.zip', category: 'ZIP', size: '48.0 MB', account: 'Company B', sender: 'Engineering Lead', date: '11 Aug' }
    ];

    if (isMockMode()) {
      const mockChatsList = getDemoMultiAccountChats('all');
      const matchedChats = mockChatsList.filter(c => regex.test(c.participant) || regex.test(c.lastMessagePreview || '') || regex.test(c.company || ''));
      const matchedFiles = allDemoFiles.filter(f => regex.test(f.name) || regex.test(f.category) || regex.test(f.sender));
      return res.status(200).json({
        success: true,
        source: 'mock',
        data: {
          chats: matchedChats,
          files: matchedFiles,
          accounts: []
        }
      });
    }

    const dbAvailable = Chat.db && Chat.db.readyState === 1;
    if (!dbAvailable) {
      return res.status(200).json({
        success: true,
        data: { chats: [], files: [], accounts: [] }
      });
    }

    // 1. Search Connected Accounts
    const accounts = await ConnectedAccount.find({
      userId,
      $or: [{ displayName: regex }, { email: regex }, { tenantId: regex }]
    });

    // 2. Search Chats (People & Conversations)
    const chats = await Chat.find({
      userId,
      $or: [{ participant: regex }, { lastMessagePreview: regex }, { company: regex }]
    }).sort({ lastMessageTimestamp: -1 }).limit(20);

    // 3. Search Messages & Document Attachments
    const messages = await Message.find({
      userId,
      $or: [{ content: regex }, { senderName: regex }, { senderEmail: regex }]
    }).sort({ createdDateTime: -1 }).limit(30);

    // Filter file attachments from messages
    const files = [];
    messages.forEach((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att) => {
          if (regex.test(att.name) || regex.test(att.contentType)) {
            files.push({
              id: att.id,
              name: att.name,
              contentType: att.contentType,
              sender: msg.senderName,
              date: msg.createdDateTime,
              contentUrl: att.contentUrl
            });
          }
        });
      }
    });

    return res.status(200).json({
      success: true,
      source: 'database',
      data: {
        accounts,
        chats,
        messages,
        files
      }
    });
  } catch (error) {
    console.error('[TeamsHub Search Error]:', error.message);
    return res.status(500).json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: error.message }
    });
  }
};

module.exports = {
  globalSearch
};
