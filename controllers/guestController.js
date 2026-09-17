const { readData, writeData } = require('../services/dataService');
const { v4: uuidv4 } = require('uuid');

exports.getAll = async (req, res, next) => {
    try {
        let guests = await readData('guests.json');
        const { screeningId, search, status, platform } = req.query;

        if (screeningId) {
            guests = guests.filter(g => g.screeningId === screeningId);
        }

        if (search) {
            const q = search.toLowerCase().trim();
            guests = guests.filter(g => 
                (g.name && g.name.toLowerCase().includes(q)) ||
                (g.organization && g.organization.toLowerCase().includes(q)) ||
                (g.phone && g.phone.includes(q)) ||
                (g.email && g.email.toLowerCase().includes(q)) ||
                (g.seat && g.seat.toLowerCase().includes(q)) ||
                (g.handles && Object.values(g.handles).some(h => h.toLowerCase().includes(q)))
            );
        }

        if (status && status !== 'all') {
            guests = guests.filter(g => g.status === status);
        }

        if (platform && platform !== 'all') {
            guests = guests.filter(g => g.platforms && g.platforms[platform]);
        }

        res.json({ success: true, data: guests });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const guests = await readData('guests.json');
        const newGuest = {
            id: 'gst-' + uuidv4().substring(0, 8),
            ...req.body,
            attended: req.body.attended || false
        };
        
        guests.push(newGuest);
        await writeData('guests.json', guests);
        
        res.status(201).json({ success: true, data: newGuest });
    } catch (error) {
        next(error);
    }
};

exports.update = async (req, res, next) => {
    try {
        const guests = await readData('guests.json');
        const index = guests.findIndex(g => g.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' });
        }

        guests[index] = { ...guests[index], ...req.body };
        await writeData('guests.json', guests);
        
        res.json({ success: true, data: guests[index] });
    } catch (error) {
        next(error);
    }
};

exports.remove = async (req, res, next) => {
    try {
        const guests = await readData('guests.json');
        const index = guests.findIndex(g => g.id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' });
        }

        guests.splice(index, 1);
        await writeData('guests.json', guests);
        
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        next(error);
    }
};
