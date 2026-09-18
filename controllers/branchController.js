const { readData } = require('../services/dataService');

exports.getAll = async (req, res, next) => {
    try {
        const branches = await readData('branches.json');
        res.json({ success: true, data: branches });
    } catch (error) {
        next(error);
    }
};

exports.getPavalaiLayout = async (req, res, next) => {
    try {
        const layout = await readData('pavalai_layout.json');
        res.json({ success: true, data: layout });
    } catch (error) {
        next(error);
    }
};
