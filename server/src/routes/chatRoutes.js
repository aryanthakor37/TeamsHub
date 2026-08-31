const express = require('express');
const router = express.Router();
const {
  getChats,
  getChatById,
  getChatMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  setMessageReaction,
  unsetMessageReaction,
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
router.patch('/:id/messages/:msgId', protect, editMessage);
router.delete('/:id/messages/:msgId', protect, deleteMessage);
router.post('/:id/messages/:msgId/delete', protect, deleteMessage);
router.post('/:id/messages/:msgId/reactions', protect, setMessageReaction);
router.delete('/:id/messages/:msgId/reactions', protect, unsetMessageReaction);
router.post('/:id/messages/:msgId/unsetReaction', protect, unsetMessageReaction);
router.get('/:id/messages/:msgId/hostedContents/:contentId', protect, getMessageImage);
router.get('/:id/messages/:msgId/hostedContents/:contentId/\\$value', protect, getMessageImage);

module.exports = router;
