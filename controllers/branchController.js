const { readData } = require('../services/dataService');

exports.getAll = async (req, res, next) => {
    try {
        const branches = await readData('branches.json');
        res.json({ success: true, data: branches });
    } catch (error) {
        next(error);
    }
};
