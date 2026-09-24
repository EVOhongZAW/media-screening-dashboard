function errorHandler(err, req, res, next) {
    console.error(err.stack);

    const statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';

    if (err.type === 'entity.too.large' || statusCode === 413) {
        message = 'ขนาดข้อมูลที่ส่งมามีขนาดใหญ่เกินกว่าที่กำหนด กรุณาลดขนาดไฟล์หรือติดต่อผู้ดูแลระบบ';
    }

    res.status(statusCode).json({
        success: false,
        code: statusCode === 413 ? 'PAYLOAD_TOO_LARGE' : undefined,
        message: message
    });
}

module.exports = errorHandler;
