const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '../data');

// Map of filename -> Promise queue for serializing writes per file
const fileQueues = new Map();

// In-Memory Data Store (filename -> parsed JSON)
const memoryCache = new Map();

/**
 * Fast in-memory read with lazy disk hydration on first access
 */
async function readData(filename) {
    if (memoryCache.has(filename)) {
        // Return deep clone to ensure data integrity
        return JSON.parse(JSON.stringify(memoryCache.get(filename)));
    }

    try {
        const filePath = path.join(dataDir, filename);
        const data = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(data);
        memoryCache.set(filename, parsed);
        return JSON.parse(JSON.stringify(parsed));
    } catch (error) {
        if (error.code === 'ENOENT') {
            memoryCache.set(filename, []);
            return [];
        }
        throw error;
    }
}

/**
 * Thread-safe atomic write to JSON file with per-file sequential queue
 * Updates in-memory store immediately so concurrent reads never block on disk I/O
 */
async function writeData(filename, data) {
    // 1. Immediately update memory cache so subsequent reads see latest state with 0ms delay!
    memoryCache.set(filename, JSON.parse(JSON.stringify(data)));

    // Invalidate stats cache on write if guests or screenings changed
    if (typeof global._invalidateStatsCache === 'function') {
        global._invalidateStatsCache();
    }

    const previousPromise = fileQueues.get(filename) || Promise.resolve();

    const currentPromise = previousPromise
        .catch(() => {}) // Don't let previous failures break subsequent writes
        .then(async () => {
            const filePath = path.join(dataDir, filename);
            const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
            
            await fs.mkdir(dataDir, { recursive: true });
            // Write to temporary file first
            await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
            
            // Atomic rename to replace destination file
            // On Windows, handle occasional transient EPERM/EBUSY locks with retries
            let retries = 5;
            while (retries > 0) {
                try {
                    await fs.rename(tempPath, filePath);
                    break;
                } catch (renameErr) {
                    if ((renameErr.code === 'EPERM' || renameErr.code === 'EBUSY') && retries > 1) {
                        retries--;
                        await new Promise(r => setTimeout(r, 20));
                    } else {
                        try { await fs.unlink(tempPath); } catch (_) {}
                        throw renameErr;
                    }
                }
            }
        });

    fileQueues.set(filename, currentPromise);
    return currentPromise;
}

// Invalidate or reload memory cache (useful for testing or external changes)
function clearMemoryCache(filename) {
    if (filename) memoryCache.delete(filename);
    else memoryCache.clear();
}

module.exports = {
    readData,
    writeData,
    clearMemoryCache
};
