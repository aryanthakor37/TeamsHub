const express = require('express');
const router = express.Router();
const { getHealthStatus, getGraphHealth } = require('../controllers/healthController');

router.get('/', getHealthStatus);
router.get('/graph', getGraphHealth);

module.exports = router;
