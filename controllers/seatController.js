const seatService = require('../services/seatService');

exports.assign = async (req, res, next) => {
  try {
    const { screeningId, guestId, seatId, seats } = req.body;
    if (!screeningId || !guestId || (!seatId && (!seats || seats.length === 0))) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId, guestId และที่นั่ง (seatId หรือ seats)'
      });
    }

    const seatList = Array.isArray(seats) && seats.length > 0 ? seats : [seatId];
    const updatedGuest = await seatService.assignSeatsBulk(screeningId, guestId, seatList);
    
    res.json({
      success: true,
      data: updatedGuest,
      message: `มอบหมายที่นั่ง ${seatList.join(', ')} สำเร็จ`
    });
  } catch (error) {
    if (error.code === 'SEAT_CONFLICT') {
      return res.status(409).json({
        success: false,
        code: 'SEAT_CONFLICT',
        message: error.message,
        conflictedSeats: error.conflictedSeats || [],
        validSeats: error.validSeats || [],
        conflictedDetails: error.conflictedDetails || [],
        suggestedReplacements: error.suggestedReplacements || []
      });
    }
    next(error);
  }
};

exports.move = async (req, res, next) => {
  try {
    const { screeningId, guestId, fromSeat, toSeat, moves } = req.body;
    
    let moveList = [];
    if (Array.isArray(moves) && moves.length > 0) {
      moveList = moves;
    } else if (fromSeat && toSeat) {
      moveList = [{ from: fromSeat, to: toSeat }];
    } else {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId, guestId และข้อมูลการย้ายที่นั่ง (fromSeat, toSeat หรือ moves)'
      });
    }

    const updatedGuest = await seatService.movePartialSeats(screeningId, guestId, moveList);
    res.json({
      success: true,
      data: updatedGuest,
      message: `ย้ายที่นั่งสำเร็จ (${moveList.map(m => m.from + ' -> ' + m.to).join(', ')})`
    });
  } catch (error) {
    if (error.code === 'SEAT_CONFLICT') {
      return res.status(409).json({
        success: false,
        code: 'SEAT_CONFLICT',
        message: error.message,
        conflictedSeats: error.conflictedSeats || [],
        conflictedDetails: error.conflictedDetails || [],
        suggestedReplacements: error.suggestedReplacements || []
      });
    }
    next(error);
  }
};

exports.movePartial = async (req, res, next) => {
  return exports.move(req, res, next);
};

exports.release = async (req, res, next) => {
  try {
    const { screeningId, guestId, seatId } = req.body;
    if (!screeningId || !guestId || !seatId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId, guestId และ seatId'
      });
    }

    const updatedGuest = await seatService.releaseSeat(screeningId, guestId, seatId);
    res.json({
      success: true,
      data: updatedGuest,
      message: `ปลดที่นั่ง ${seatId} เรียบร้อยแล้ว`
    });
  } catch (error) {
    next(error);
  }
};

exports.getSuggestions = async (req, res, next) => {
  try {
    const { screeningId, targetSeat, count } = req.query;
    if (!screeningId || !targetSeat) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId และ targetSeat'
      });
    }

    const alternatives = await seatService.findAlternativeSeats(
      screeningId,
      targetSeat,
      parseInt(count, 10) || 1
    );

    res.json({ success: true, data: alternatives });
  } catch (error) {
    next(error);
  }
};

exports.recommendGroups = async (req, res, next) => {
  try {
    const { screeningId, guestCount, preferredSeat } = req.body;
    if (!screeningId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId'
      });
    }

    const count = parseInt(guestCount, 10) || 1;
    const groups = await seatService.findGroupRecommendations(screeningId, count, preferredSeat);

    res.json({
      success: true,
      count,
      data: groups
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllStatus = async (req, res, next) => {
  try {
    const { screeningId } = req.query;
    if (!screeningId) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุ screeningId'
      });
    }

    const result = await seatService.getAllSeatsStatus(screeningId);
    res.json({
      success: true,
      data: result.seats,
      summary: result.summary
    });
  } catch (error) {
    next(error);
  }
};
