const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '../data');

// Map of filename -> Promise queue for serializing writes per file
const fileQueues = new Map();

async function readData(filename) {
    try {
        const filePath = path.join(dataDir, filename);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

/**
 * Thread-safe atomic write to JSON file with per-file sequential queue
 */
async function writeData(filename, data) {
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

module.exports = {
    readData,
    writeData
};
