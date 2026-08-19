const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const accountRoutes = require('./accountRoutes');
const chatRoutes = require('./chatRoutes');
const fileRoutes = require('./fileRoutes');
const searchRoutes = require('./searchRoutes');

// Mounted API Routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/accounts', accountRoutes);
router.use('/chats', chatRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);

// Phase 5+ Documented Stubs
const futureStub = (featureName, phase) => (req, res) => {
  res.status(501).json({
    success: false,
    message: `${featureName} integration will be enabled in ${phase}`,
    phase: 'phase-4'
  });
};

router.all('/messages*', futureStub('Message Dispatcher & Sending', 'Phase 5'));
router.all('/ai*', futureStub('AI Copilot', 'Phase 8'));

module.exports = router;


