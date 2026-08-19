/**
 * TeamsHub Centralized Mock Data Layer (Phase 1)
 * Decoupled data provider for UI previews across Accounts, Chats, Messages, Files, and Search.
 */

export const mockAccounts = [
  {
    id: 'acc-1',
    company: 'Company A (Work)',
    email: 'rahul.patel@companya.com',
    type: 'Work Account',
    status: 'Connected',
    lastSync: '10 mins ago',
    unreadCount: 8,
    badgeClass: 'badge-company-a',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'acc-2',
    company: 'Company B (Client)',
    email: 'apoorva@clientcorp.io',
    type: 'Client Workspace',
    status: 'Connected',
    lastSync: '1 hour ago',
    unreadCount: 4,
    badgeClass: 'badge-company-b',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'acc-3',
    company: 'Company C (Freelance)',
    email: 'freelance@agencyx.com',
    type: 'Consultant Account',
    status: 'Connected',
    lastSync: '3 hours ago',
    unreadCount: 0,
    badgeClass: 'badge-company-c',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
  }
];

export const mockChats = [
  {
    id: 'chat-1',
    participant: 'Rahul Patel',
    role: 'Lead Architect',
    company: 'Company A',
    accountId: 'acc-1',
    lastMessage: 'Please check the API endpoints for the Phase 1 deployment.',
    timestamp: '2:35 PM',
    unreadCount: 2,
    onlineStatus: 'online',
    pinned: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'chat-2',
    participant: 'Apoorva Sharma',
    role: 'Product Manager',
    company: 'Company B',
    accountId: 'acc-2',
    lastMessage: 'Meeting moved to 4 PM today.',
    timestamp: '1:20 PM',
    unreadCount: 1,
    onlineStatus: 'away',
    pinned: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'chat-3',
    participant: 'Client Workspace Sync',
    role: 'Group Channel',
    company: 'Company B',
    accountId: 'acc-2',
    lastMessage: 'New sprint roadmap updated in OneDrive folder.',
    timestamp: '11:45 AM',
    unreadCount: 0,
    onlineStatus: 'offline',
    pinned: false,
    avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=120&q=80'
  },
  {
    id: 'chat-4',
    participant: 'Project Team Alpha',
    role: 'Engineering Channel',
    company: 'Company A',
    accountId: 'acc-1',
    lastMessage: 'All PR reviews completed for the authentication module.',
    timestamp: 'Yesterday',
    unreadCount: 0,
    onlineStatus: 'online',
    pinned: false,
    avatar: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=120&q=80'
  }
];

export const mockMessages = {
  'Meet Thakor': [
    { id: 'm-mt-1', sender: 'Meet Thakor', text: 'Hi', timestamp: '12:10 PM', isOutgoing: false },
    { id: 'm-mt-2', sender: 'Meet Thakor', text: 'Office aavelo che k nai?', timestamp: '12:11 PM', isOutgoing: false },
    { id: 'm-mt-3', sender: 'Meet Thakor', text: 'ok', timestamp: '12:12 PM', isOutgoing: false },
    { id: 'm-mt-4', sender: 'Aryan Kumrecha', text: 'Niche javanu hoy pela aa side avvje ne', timestamp: '12:13 PM', isOutgoing: true },
    { id: 'm-mt-5', sender: 'Aryan Kumrecha', text: 'Free thay tyare', timestamp: '12:13 PM', isOutgoing: true },
    { id: 'm-mt-6', sender: 'Aryan Kumrecha', text: 'Mare teams pc ma open j nai thatu', timestamp: '12:13 PM', isOutgoing: true },
    { id: 'm-mt-7', sender: 'Aryan Kumrecha', text: 'Acma pan na thatu', timestamp: '12:14 PM', isOutgoing: true },
    { id: 'm-mt-8', sender: 'Meet Thakor', text: 'Chai', timestamp: '01:05 PM', isOutgoing: false },
    { id: 'm-mt-9', sender: 'Aryan Thakor', text: 'Javu che', timestamp: '12:40 PM', isOutgoing: false },
    { id: 'm-mt-10', sender: 'Aryan Thakor', text: 'Hu bar betho', timestamp: '12:41 PM', isOutgoing: false },
    { id: 'm-mt-11', sender: 'Aryan Thakor', text: 'Ha', timestamp: '12:44 PM', isOutgoing: false },
    { id: 'm-mt-12', sender: 'Aryan Thakor', text: 'Ave etle msg kar je hu ander avi gayo', timestamp: '12:58 PM', isOutgoing: false }
  ],
  'Hardik Thakor': [
    { id: 'm-ht-1', sender: 'Hardik Thakor', text: 'Okay', timestamp: '03:21 PM', isOutgoing: false },
    { id: 'm-ht-2', sender: 'Aryan Kumrecha', text: 'Chai peevani?', timestamp: '03:20 PM', isOutgoing: true },
    { id: 'm-ht-3', sender: 'Hardik Thakor', text: 'Ha bhai', timestamp: '03:21 PM', isOutgoing: false },
    { id: 'm-ht-4', sender: 'Hardik Thakor', text: 'Aa avyo', timestamp: '03:22 PM', isOutgoing: false }
  ],
  'Aditya Kumrecha': [
    { id: 'm-ak-1', sender: 'Aditya Kumrecha', text: 'hi', timestamp: '01:26 PM', isOutgoing: false },
    { id: 'm-ak-2', sender: 'Aditya Kumrecha', text: 'pan tifin nathi aayaa', timestamp: '12:40 PM', isOutgoing: false },
    { id: 'm-ak-3', sender: 'Aditya Kumrecha', text: 'Tifin save to keje', timestamp: '12:41 PM', isOutgoing: false },
    { id: 'm-ak-4', sender: 'Aditya Kumrecha', text: 'chai', timestamp: '01:05 PM', isOutgoing: false }
  ],
  'Kaushal Nimavat': [
    { id: 'm-kn-1', sender: 'Kaushal Nimavat', text: 'Hello Sir, Please find the attached Initial Project Plan PDF for TeamsHub. Kindly review it and let me know.', timestamp: '12:09 PM', isOutgoing: false }
  ],
  'Hem Shah': [
    { id: 'm-hs-1', sender: 'Hem Shah', text: 'hi', timestamp: '11:35 AM', isOutgoing: false },
    { id: 'm-hs-2', sender: 'Hem Shah', text: 'meeting kyar thi che', timestamp: '11:36 AM', isOutgoing: false }
  ],
  'chat-1': [
    {
      id: 'm1',
      sender: 'Rahul Patel',
      senderId: 'user-rahul',
      text: 'Hey! Have you updated the server route for the health check?',
      timestamp: '2:30 PM',
      isOutgoing: false
    },
    {
      id: 'm2',
      sender: 'You',
      senderId: 'user-me',
      text: 'Yes! GET /api/health is live and returning 200 OK.',
      timestamp: '2:32 PM',
      isOutgoing: true
    },
    {
      id: 'm3',
      sender: 'Rahul Patel',
      senderId: 'user-rahul',
      text: 'Please check the API endpoints for the Phase 1 deployment.',
      timestamp: '2:35 PM',
      isOutgoing: false,
      attachment: {
        name: 'API_Spec_Phase1.pdf',
        size: '1.2 MB',
        type: 'pdf'
      }
    }
  ],
  'chat-2': [
    {
      id: 'm4',
      sender: 'Apoorva Sharma',
      senderId: 'user-apoorva',
      text: 'Hi team, checking in on the client design review.',
      timestamp: '1:15 PM',
      isOutgoing: false
    },
    {
      id: 'm5',
      sender: 'Apoorva Sharma',
      senderId: 'user-apoorva',
      text: 'Meeting moved to 4 PM today.',
      timestamp: '1:20 PM',
      isOutgoing: false
    }
  ]
};

export const mockFiles = [
  {
    id: 'file-photo-aryan-1',
    name: 'Photo from Aryan Kumrecha',
    category: 'Images',
    size: '1.2 MB',
    account: 'Teams Chat',
    sender: 'Aryan Kumrecha',
    date: 'Today',
    iconType: 'image'
  },
  {
    id: 'file-photo-pratham-1',
    name: 'Photo from Pratham Rao',
    category: 'Images',
    size: '2.8 MB',
    account: 'Teams Chat',
    sender: 'Pratham Rao',
    date: 'Yesterday',
    iconType: 'image'
  },
  {
    id: 'file-image-jpg-1',
    name: 'Image.jpg',
    category: 'Images',
    size: '122.8 KB',
    account: 'OneDrive / Teams',
    sender: 'Meet Soneji',
    date: '12 Aug',
    iconType: 'image'
  },
  {
    id: 'file-project-plan',
    name: 'TeamsHub_Project_Plan.pdf',
    category: 'PDF',
    size: '81.9 KB',
    account: 'OneDrive / Teams',
    sender: 'Aryan Kumrecha',
    date: 'Today',
    iconType: 'pdf'
  },
  {
    id: 'file-telegram-overview',
    name: 'Telegram-Drive-Project-Overview.docx',
    category: 'Documents',
    size: '13.0 KB',
    account: 'OneDrive / Teams',
    sender: 'Aryan Kumrecha',
    date: 'Yesterday',
    iconType: 'doc'
  },
  {
    id: 'file-project-presentation',
    name: 'Project Presentation',
    category: 'Documents',
    size: '4.5 MB',
    account: 'Teams Chat',
    sender: 'Aryan Kumrecha',
    date: '10 Aug',
    iconType: 'doc'
  },
  {
    id: 'file-ai-agent',
    name: 'AI Mobile Control Agent.pdf',
    category: 'PDF',
    size: '1.3 MB',
    account: 'OneDrive / Teams',
    sender: 'Aryan Kumrecha',
    date: '11 Aug',
    iconType: 'pdf'
  },
  {
    id: 'file-1',
    name: 'Project_Report.pdf',
    category: 'PDF',
    size: '2.4 MB',
    account: 'Company A',
    sender: 'Rahul Patel',
    date: '12 Aug',
    iconType: 'pdf'
  },
  {
    id: 'file-2',
    name: 'UI_Design_System.png',
    category: 'Images',
    size: '4.8 MB',
    account: 'Company B',
    sender: 'Apoorva Sharma',
    date: '12 Aug',
    iconType: 'image'
  },
  {
    id: 'file-3',
    name: 'SourceCode_Phase1.zip',
    category: 'ZIP',
    size: '48.0 MB',
    account: 'Company B',
    sender: 'Engineering Lead',
    date: '11 Aug',
    iconType: 'zip'
  },
  {
    id: 'file-4',
    name: 'Meeting_Notes_Aug.docx',
    category: 'Documents',
    size: '850 KB',
    account: 'Company A',
    sender: 'Project Manager',
    date: '10 Aug',
    iconType: 'doc'
  },
  {
    id: 'file-5',
    name: 'Q3_Financial_Forecast.xlsx',
    category: 'Excel',
    size: '3.1 MB',
    account: 'Company C',
    sender: 'Finance Team',
    date: '09 Aug',
    iconType: 'excel'
  },
  {
    id: 'file-6',
    name: 'Architecture_Overview.mp4',
    category: 'Videos',
    size: '124.5 MB',
    account: 'Company A',
    sender: 'DevOps Lead',
    date: '08 Aug',
    iconType: 'video'
  }
];

export const mockDashboardStats = {
  unreadMessages: 12,
  filesCount: 24,
  connectedAccounts: 3,
  followUpsCount: 4
};
