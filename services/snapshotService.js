const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { readData, writeData } = require('./dataService');

const SNAPSHOTS_DIR = path.join(__dirname, '../data/snapshots');

/**
 * Ensure snapshots directory exists
 */
async function ensureSnapshotsDir(screeningId) {
  const dir = path.join(SNAPSHOTS_DIR, screeningId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Create a snapshot of all guests in a screening
 */
async function createSnapshot(screeningId, reason = 'bulk_delete') {
  const allGuests = await readData('guests.json');
  const targetGuests = allGuests.filter(g => g.screeningId === screeningId);

  const snapshotId = `snp-${Date.now()}-${uuidv4().substring(0, 6)}`;
  const snapshotData = {
    id: snapshotId,
    screeningId,
    timestamp: new Date().toISOString(),
    reason,
    guestCount: targetGuests.length,
    bookedSeats: targetGuests.reduce((acc, g) => {
      if (!g.seat) return acc;
      return acc + g.seat.split(',').map(s => s.trim()).filter(Boolean).length;
    }, 0),
    checkedInCount: targetGuests.filter(g => g.attended).length,
    guests: targetGuests
  };

  const dir = await ensureSnapshotsDir(screeningId);
  const filePath = path.join(dir, `${snapshotId}.json`);
  await fs.writeFile(filePath, JSON.stringify(snapshotData, null, 2), 'utf8');

  return snapshotData;
}

/**
 * Restore guests from a snapshot
 */
async function restoreSnapshot(screeningId, snapshotId) {
  const dir = await ensureSnapshotsDir(screeningId);
  const filePath = path.join(dir, `${snapshotId}.json`);
  
  let raw;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`ไม่พบ Snapshot ID: ${snapshotId}`);
  }

  const snapshot = JSON.parse(raw);
  if (snapshot.screeningId !== screeningId) {
    throw new Error('รอบฉายของ Snapshot ไม่ตรงกับรอบฉายปัจจุบัน');
  }

  let allGuests = await readData('guests.json');
  // Remove current guests for this screening
  allGuests = allGuests.filter(g => g.screeningId !== screeningId);
  // Restore guests from snapshot
  allGuests.push(...snapshot.guests);
  await writeData('guests.json', allGuests);

  return {
    restoredCount: snapshot.guests.length,
    snapshot
  };
}

/**
 * Get latest snapshot for a screening (for Undo button)
 */
async function getLatestSnapshot(screeningId) {
  const dir = await ensureSnapshotsDir(screeningId);
  try {
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    if (jsonFiles.length === 0) return null;

    const latestFile = path.join(dir, jsonFiles[0]);
    const raw = await fs.readFile(latestFile, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

/**
 * List all snapshots for a screening
 */
async function listSnapshots(screeningId) {
  const dir = await ensureSnapshotsDir(screeningId);
  try {
    const files = await fs.readdir(dir);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    const snapshots = [];
    for (const f of jsonFiles.slice(0, 10)) {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const data = JSON.parse(raw);
      snapshots.push({
        id: data.id,
        timestamp: data.timestamp,
        reason: data.reason,
        guestCount: data.guestCount,
        bookedSeats: data.bookedSeats,
        checkedInCount: data.checkedInCount
      });
    }
    return snapshots;
  } catch (err) {
    return [];
  }
}

module.exports = {
  createSnapshot,
  restoreSnapshot,
  getLatestSnapshot,
  listSnapshots
};
