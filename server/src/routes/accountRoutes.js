const express = require('express');
const router = express.Router();
const {
  getAccounts,
  connectMicrosoftAccount,
  setActiveAccount,
  setDefaultAccount,
  reconnectAccount,
  disconnectAccount
} = require('../controllers/accountsController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getAccounts);
router.post('/microsoft', protect, connectMicrosoftAccount);
router.put('/active', protect, setActiveAccount);
router.put('/default', protect, setDefaultAccount);
router.post('/:id/reconnect', protect, reconnectAccount);
router.delete('/:id', protect, disconnectAccount);

module.exports = router;
