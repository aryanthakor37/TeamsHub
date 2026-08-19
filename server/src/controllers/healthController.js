const { isConfigured } = require('../services/msalService');
const { isMockMode } = require('../services/graphService');

/**
 * @desc    Get API Health Status
 * @route   GET /api/health
 * @access  Public
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'TeamsHub API is running',
    version: '1.0.0',
    phase: 'phase-4',
    timestamp: new Date().toISOString()
  });
};

/**
 * @desc    Get Microsoft Graph Diagnostic Status
 * @route   GET /api/health/graph
 * @access  Public
 */
const getGraphHealth = (req, res) => {
  res.status(200).json({
    success: true,
    configured: isConfigured(),
    mockMode: isMockMode(),
    graphVersion: 'v1.0'
  });
};

module.exports = {
  getHealthStatus,
  getGraphHealth
};
