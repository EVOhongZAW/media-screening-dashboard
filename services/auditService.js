const { readData, writeData } = require('./dataService');
const { v4: uuidv4 } = require('uuid');

const LOGS_FILE = 'activity_logs.json';

/**
 * Record an activity event in activity_logs.json
 */
async function logActivity({ action, screeningId, guestId = null, guestName = null, details = {} }) {
  try {
    const logs = await readData(LOGS_FILE);
    const entry = {
      id: 'log-' + uuidv4().substring(0, 8),
      timestamp: new Date().toISOString(),
      action,
      screeningId,
      guestId,
      guestName,
      details
    };
    // Prepend latest entry and cap at 1,000 entries
    logs.unshift(entry);
    if (logs.length > 1000) {
      logs.length = 1000;
    }
    await writeData(LOGS_FILE, logs);
    return entry;
  } catch (err) {
    console.error('Failed to write activity log:', err);
    return null;
  }
}

/**
 * Get recent activity logs for a screening or all
 */
async function getLogs(screeningId = null, limit = 50) {
  const logs = await readData(LOGS_FILE);
  let filtered = logs;
  if (screeningId) {
    filtered = logs.filter(l => l.screeningId === screeningId);
  }
  return filtered.slice(0, limit);
}

module.exports = {
  logActivity,
  getLogs
};
