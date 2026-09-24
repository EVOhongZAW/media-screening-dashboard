const { body, validationResult } = require('express-validator');

const validateScreening = [
    body('title').notEmpty().withMessage('กรุณาระบุชื่อเรื่อง'),
    body('branchId').notEmpty().withMessage('กรุณาระบุสาขา'),
    body('date').notEmpty().withMessage('กรุณาระบุวันที่จัดฉาย'),
    body('time').notEmpty().withMessage('กรุณาระบุเวลา')
];

const validateGuest = [
    body('name').notEmpty().withMessage('กรุณาระบุชื่อ'),
    body('guestType').optional().isIn(['press', 'influencer', 'vip', 'guest', 'creator']).withMessage('ประเภทแขกไม่ถูกต้อง'),
    body('phone').optional({ checkFalsy: true }).matches(/^0\d{9}$|^\d{10}$/).withMessage('เบอร์โทรต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)'),
    body('follower').optional({ nullable: true, checkFalsy: true }),
    body('pic').optional({ nullable: true })
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
