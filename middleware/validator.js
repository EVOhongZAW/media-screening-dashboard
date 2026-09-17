const { body, validationResult } = require('express-validator');

const validateScreening = [
    body('title').notEmpty().withMessage('กรุณาระบุชื่อเรื่อง'),
    body('branchId').notEmpty().withMessage('กรุณาระบุสาขา'),
    body('date').notEmpty().withMessage('กรุณาระบุวันที่จัดฉาย'),
    body('time').notEmpty().withMessage('กรุณาระบุเวลา')
];

const validateGuest = [
    body('name').notEmpty().withMessage('กรุณาระบุชื่อ'),
    body('guestType').optional().isIn(['press', 'influencer', 'vip', 'guest', 'creator']).withMessage('ประเภทแขกไม่ถูกต้อง')
];

const handleValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

module.exports = {
    validateScreening,
    validateGuest,
    handleValidation
};
