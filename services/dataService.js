const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '../data');

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

async function writeData(filename, data) {
    try {
        const filePath = path.join(dataDir, filename);
        // Ensure data directory exists
        await fs.mkdir(dataDir, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        throw error;
    }
}

module.exports = {
    readData,
    writeData
};
