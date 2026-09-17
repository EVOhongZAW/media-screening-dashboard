function errorHandler(err, req, res, next) {
    console.error(err.stack);

    const statusCode = err.statusCode || 500;
    const message = err.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์';

    res.status(statusCode).json({
        success: false,
        message: message
    });
}

module.exports = errorHandler;
