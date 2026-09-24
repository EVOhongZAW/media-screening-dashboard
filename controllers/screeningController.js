const { readData, writeData } = require('../services/dataService');
const { v4: uuidv4 } = require('uuid');
const snapshotService = require('../services/snapshotService');

exports.getAll = async (req, res, next) => {
    try {
        let screenings = await readData('screenings.json');
        const branches = await readData('branches.json');
        const { branchId, mediaType, dateFrom, dateTo, status } = req.query;

        // Apply filters
        if (branchId) screenings = screenings.filter(s => s.branchId === branchId);
        if (mediaType) screenings = screenings.filter(s => s.mediaType === mediaType);
        if (dateFrom) screenings = screenings.filter(s => s.date >= dateFrom);
        if (dateTo) screenings = screenings.filter(s => s.date <= dateTo);
        if (status) screenings = screenings.filter(s => s.status === status);

        // Join branch name
        screenings = screenings.map(s => {
            const branch = branches.find(b => b.id === s.branchId);
            return {
                ...s,
                branchName: branch ? branch.name : 'Unknown Branch'
            };
        });

        res.json({ success: true, data: screenings });
    } catch (error) {
        next(error);
    }
};

exports.getById = async (req, res, next) => {
    try {
        const screenings = await readData('screenings.json');
        const guests = await readData('guests.json');
        const branches = await readData('branches.json');

        const screening = screenings.find(s => s.id === req.params.id);
        if (!screening) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรอบฉาย' });
        }

        const branch = branches.find(b => b.id === screening.branchId);
        screening.branchName = branch ? branch.name : 'Unknown Branch';
        
        const screeningGuests = guests.filter(g => g.screeningId === screening.id);

        res.json({ success: true, data: { ...screening, guests: screeningGuests } });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const screenings = await readData('screenings.json');
        const newScreening = {
            id: 'scr-' + uuidv4().substring(0, 8),
            ...req.body,
            status: req.body.status || 'scheduled'
        };
        
        screenings.push(newScreening);
        await writeData('screenings.json', screenings);
        
        res.status(201).json({ success: true, data: newScreening });
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const screenings = await readData('screenings.json');
        const index = screenings.findIndex(s => s.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรอบฉาย' });
        }

        screenings[index] = { ...screenings[index], ...req.body };
        await writeData('screenings.json', screenings);
        
        res.json({ success: true, data: screenings[index] });
    } catch (error) {
        next(error);
    }
};

exports.remove = async (req, res, next) => {
    try {
        let screenings = await readData('screenings.json');
        const index = screenings.findIndex(s => s.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลรอบฉาย' });
        }

        // Auto-backup guests of this screening to snapshot before deleting
        try {
            await snapshotService.createSnapshot(req.params.id, 'screening_delete_backup');
        } catch (snapErr) {
            console.warn('Snapshot backup before screening deletion skipped or failed:', snapErr.message);
        }

        screenings.splice(index, 1);
        await writeData('screenings.json', screenings);

        // Remove associated guests
        let guests = await readData('guests.json');
        guests = guests.filter(g => g.screeningId !== req.params.id);
        await writeData('guests.json', guests);
        
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        next(error);
    }
};
