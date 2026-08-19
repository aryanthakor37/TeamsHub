const express = require('express');
const router = express.Router();
const {
  getChats,
  getChatById,
  getChatMessages,
  sendMessage,
  getMessageImage,
  refreshChats,
  markChatRead
} = require('../controllers/chatsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getChats);
router.post('/refresh', protect, refreshChats);
router.get('/:id', protect, getChatById);
router.post('/:id/read', protect, markChatRead);
router.get('/:id/messages', protect, getChatMessages);
router.post('/:id/messages', protect, sendMessage);
router.get('/:id/messages/:msgId/hostedContents/:contentId', protect, getMessageImage);

module.exports = router;
