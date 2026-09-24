const { readData, writeData } = require('../services/dataService');
const { v4: uuidv4 } = require('uuid');
const seatService = require('../services/seatService');
const snapshotService = require('../services/snapshotService');
const auditService = require('../services/auditService');

function normalizeSeats(seatsInput, seatStr, attended = false, attendedSeats = []) {
    let seatCodes = [];
    if (Array.isArray(seatsInput) && seatsInput.length > 0) {
        if (typeof seatsInput[0] === 'object' && seatsInput[0] !== null && 'code' in seatsInput[0]) {
            return seatsInput.map(s => ({
                code: String(s.code).trim().toUpperCase(),
                checkedIn: !!s.checkedIn
            }));
        }
        seatCodes = seatsInput.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    } else if (seatStr && typeof seatStr === 'string') {
        seatCodes = seatService.expandSeatRanges(seatStr);
    }

    const attSet = new Set((Array.isArray(attendedSeats) ? attendedSeats : []).map(s => String(s).trim().toUpperCase()));
    return seatCodes.map(code => ({
        code,
        checkedIn: attSet.size > 0 ? attSet.has(code) : !!attended
    }));
}

function computeGuestStatus(guest) {
    const rawSeats = Array.isArray(guest.seats) ? guest.seats : [];
    const seats = rawSeats.map(s => typeof s === 'object' && s !== null ? s : { code: String(s), checkedIn: !!guest.attended });
    const quota = parseInt(guest.participant, 10) || (seats.length > 0 ? seats.length : 1);
    
    if (seats.length > 0) {
        const checkedInCount = seats.filter(s => s.checkedIn).length;
        const attended = checkedInCount >= seats.length;
        const checkInStatus = checkedInCount === 0 ? 'not-checked' : (checkedInCount >= seats.length ? 'complete' : 'partial');
        return {
            seats,
            attended,
            attendedCount: checkedInCount,
            attendedSeats: seats.filter(s => s.checkedIn).map(s => s.code),
            checkInStatus,
            seat: seats.map(s => s.code).join(', ')
        };
    } else {
        const attendedCount = guest.attendedCount !== undefined ? guest.attendedCount : (guest.attended ? quota : 0);
        const attended = !!guest.attended || (attendedCount >= quota && quota > 0);
        const checkInStatus = attendedCount === 0 ? 'not-checked' : (attendedCount >= quota ? 'complete' : 'partial');
        return {
            seats: [],
            attended,
            attendedCount,
            attendedSeats: [],
            checkInStatus,
            seat: guest.seat || null
        };
    }
}

exports.computeGuestStatus = computeGuestStatus;
exports.normalizeSeats = normalizeSeats;

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

exports.getById = async (req, res, next) => {
    try {
        const guests = await readData('guests.json');
        const guest = guests.find(g => g.id === req.params.id);
        if (!guest) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' });
        }

        const computed = computeGuestStatus(guest);
        const result = {
            ...guest,
            ...computed,
            _deprecatedFields: {
                seat: "Deprecated: use 'seats' array of { code, checkedIn } instead of 'seat' string",
                attended: "Deprecated: use 'checkInStatus' and 'seats[].checkedIn' instead of record-level 'attended' boolean"
            }
        };

        res.json({ success: true, data: result });
    } catch (error) {
        next(error);
    }
};

exports.create = async (req, res, next) => {
    try {
        const guests = await readData('guests.json');
        const screeningId = req.body.screeningId;
        const participant = parseInt(req.body.participant, 10) || 1;

        // 1. Check Theater Capacity (Siam Pavalai 1,164 seats)
        if (screeningId) {
            const capCheck = await seatService.checkCapacity(screeningId, participant);
            if (capCheck.exceeded) {
                return res.status(400).json({
                    success: false,
                    code: 'CAPACITY_EXCEEDED',
                    message: `จำนวนแขกจะเกินความจุโรงภาพยนตร์ (${capCheck.currentTotal + participant}/${capCheck.capacity} ที่นั่ง)`,
                    capacity: capCheck.capacity,
                    currentTotal: capCheck.currentTotal,
                    availableQuota: capCheck.availableQuota
                });
            }
        }

        // 2. If seat provided, expand ranges and validate availability & topology
        let seatList = [];
        if (req.body.seat && screeningId) {
            seatList = seatService.expandSeatRanges(req.body.seat);
            
            // Check internal duplicates within request
            const seen = new Set();
            for (const s of seatList) {
                if (seen.has(s)) {
                    return res.status(400).json({
                        success: false,
                        code: 'DUPLICATE_SEAT_IN_REQUEST',
                        message: `ที่นั่ง ${s} ถูกระบุซ้ำกันในคำขอ`
                    });
                }
                seen.add(s);

                const check = await seatService.checkSeatAvailability(screeningId, s);
                if (!check.available) {
                    if (check.reason === 'INVALID_SEAT') {
                        return res.status(400).json({
                            success: false,
                            code: 'INVALID_SEAT',
                            message: check.message,
                            seatId: s
                        });
                    }
                    const alternatives = await seatService.findAlternativeSeats(screeningId, s, 1);
                    return res.status(409).json({
                        success: false,
                        code: 'SEAT_CONFLICT',
                        message: check.message || `ที่นั่ง ${s} ถูกจองแล้วโดย ${check.occupant?.name}`,
                        occupant: check.occupant,
                        seatId: s,
                        alternatives
                    });
                }
            }
        }

        const attended = !!req.body.attended;
        const detail = (req.body.detail !== undefined ? req.body.detail : req.body.organization) || '';
        const organization = (req.body.organization !== undefined ? req.body.organization : req.body.detail) || 'ไม่ระบุสังกัด';

        let followerVal = null;
        if (req.body.follower !== undefined && req.body.follower !== null && req.body.follower !== '') {
            const parsed = parseInt(String(req.body.follower).replace(/,/g, ''), 10);
            followerVal = isNaN(parsed) ? null : parsed;
        }
        const picVal = req.body.pic !== undefined && req.body.pic !== null && String(req.body.pic).trim() !== ''
            ? String(req.body.pic).trim()
            : null;

        const seatsObjArray = seatList.map(code => ({ code, checkedIn: attended }));
        const checkInStatus = seatList.length > 0
            ? (attended ? 'complete' : 'not-checked')
            : (attended ? 'complete' : 'not-checked');

        const newGuest = {
            id: 'gst-' + uuidv4().substring(0, 8),
            ...req.body,
            organization,
            detail,
            follower: followerVal,
            pic: picVal,
            seat: seatList.length > 0 ? seatList.join(', ') : (req.body.seat || null),
            seats: seatsObjArray,
            participant,
            attended,
            attendedCount: attended ? (seatList.length > 0 ? seatList.length : participant) : (parseInt(req.body.attendedCount, 10) || 0),
            attendedSeats: attended ? [...seatList] : [],
            checkInStatus,
            source: req.body.source || 'invite',
            createdAt: new Date().toISOString()
        };
        
        guests.push(newGuest);
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: 'GUEST_CREATE',
            screeningId,
            guestId: newGuest.id,
            guestName: newGuest.name,
            details: { organization: newGuest.organization, seat: newGuest.seat, seats: newGuest.seats }
        });
        
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

        const currentGuest = guests[index];
        const screeningId = currentGuest.screeningId;

        // Validate phone number if provided (must be 10 digits Thai mobile standard)
        if (req.body.phone !== undefined && req.body.phone !== null && String(req.body.phone).trim() !== '') {
            const cleanPhone = String(req.body.phone).trim().replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                return res.status(400).json({
                    success: false,
                    message: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)'
                });
            }
        }

        // If seat is being changed, expand and verify conflict
        let seatCodes = [];
        if (Array.isArray(currentGuest.seats) && currentGuest.seats.length > 0) {
            seatCodes = currentGuest.seats.map(s => (typeof s === 'object' ? s.code : s).toUpperCase());
        } else if (currentGuest.seat) {
            seatCodes = seatService.expandSeatRanges(currentGuest.seat);
        }

        if (req.body.seat !== undefined && req.body.seat !== currentGuest.seat) {
            if (req.body.seat) {
                seatCodes = seatService.expandSeatRanges(req.body.seat);
                const seen = new Set();
                for (const s of seatCodes) {
                    if (seen.has(s)) {
                        return res.status(400).json({
                            success: false,
                            code: 'DUPLICATE_SEAT_IN_REQUEST',
                            message: `ที่นั่ง ${s} ถูกระบุซ้ำกันในคำขอ`
                        });
                    }
                    seen.add(s);

                    const check = await seatService.checkSeatAvailability(screeningId, s, currentGuest.id);
                    if (!check.available) {
                        if (check.reason === 'INVALID_SEAT') {
                            return res.status(400).json({
                                success: false,
                                code: 'INVALID_SEAT',
                                message: check.message,
                                seatId: s
                            });
                        }
                        const alternatives = await seatService.findAlternativeSeats(screeningId, s, 1);
                        return res.status(409).json({
                            success: false,
                            code: 'SEAT_CONFLICT',
                            message: check.message || `ที่นั่ง ${s} ถูกจองแล้วโดย ${check.occupant?.name}`,
                            occupant: check.occupant,
                            seatId: s,
                            alternatives
                        });
                    }
                }
            } else {
                seatCodes = [];
            }
        }

        // Map previous checkedIn states
        const prevSeatStatusMap = new Map();
        if (Array.isArray(currentGuest.seats)) {
            currentGuest.seats.forEach(s => {
                if (typeof s === 'object' && s !== null) {
                    prevSeatStatusMap.set(s.code.toUpperCase(), !!s.checkedIn);
                } else {
                    prevSeatStatusMap.set(String(s).toUpperCase(), !!currentGuest.attended);
                }
            });
        }

        let updatedSeatsObjects = seatCodes.map(code => ({
            code,
            checkedIn: prevSeatStatusMap.has(code) ? prevSeatStatusMap.get(code) : false
        }));

        // Handle participant & attended synchronization
        const updatedParticipant = req.body.participant !== undefined ? (parseInt(req.body.participant, 10) || 1) : currentGuest.participant;
        
        if (req.body.attended !== undefined) {
            const isAtt = !!req.body.attended;
            updatedSeatsObjects = updatedSeatsObjects.map(s => ({ ...s, checkedIn: isAtt }));
        } else if (req.body.attendedCount !== undefined) {
            const count = Math.max(0, parseInt(req.body.attendedCount, 10) || 0);
            updatedSeatsObjects = updatedSeatsObjects.map((s, idx) => ({ ...s, checkedIn: idx < count }));
        }

        const checkedInCount = updatedSeatsObjects.length > 0
            ? updatedSeatsObjects.filter(s => s.checkedIn).length
            : (req.body.attendedCount !== undefined ? parseInt(req.body.attendedCount, 10) : (req.body.attended ? updatedParticipant : (currentGuest.attendedCount || 0)));

        const isFullyAttended = updatedSeatsObjects.length > 0
            ? checkedInCount >= updatedSeatsObjects.length
            : (req.body.attended !== undefined ? !!req.body.attended : (checkedInCount >= updatedParticipant));

        const checkInStatus = updatedSeatsObjects.length > 0
            ? (checkedInCount === 0 ? 'not-checked' : (checkedInCount >= updatedSeatsObjects.length ? 'complete' : 'partial'))
            : (checkedInCount === 0 ? 'not-checked' : (checkedInCount >= updatedParticipant ? 'complete' : 'partial'));

        const updatedAttendedSeats = updatedSeatsObjects.filter(s => s.checkedIn).map(s => s.code);

        const updatedDetail = req.body.detail !== undefined ? req.body.detail : (req.body.organization !== undefined ? req.body.organization : currentGuest.detail);
        const updatedOrg = req.body.organization !== undefined ? req.body.organization : (req.body.detail !== undefined ? req.body.detail : currentGuest.organization);

        let updatedFollower = currentGuest.follower !== undefined ? currentGuest.follower : null;
        if (req.body.follower !== undefined) {
            if (req.body.follower === null || req.body.follower === '') {
                updatedFollower = null;
            } else {
                const parsed = parseInt(String(req.body.follower).replace(/,/g, ''), 10);
                updatedFollower = isNaN(parsed) ? null : parsed;
            }
        }

        let updatedPic = currentGuest.pic !== undefined ? currentGuest.pic : null;
        if (req.body.pic !== undefined) {
            updatedPic = (req.body.pic !== null && String(req.body.pic).trim() !== '') ? String(req.body.pic).trim() : null;
        }

        guests[index] = {
            ...currentGuest,
            ...req.body,
            organization: updatedOrg,
            detail: updatedDetail,
            follower: updatedFollower,
            pic: updatedPic,
            seat: updatedSeatsObjects.length > 0 ? updatedSeatsObjects.map(s => s.code).join(', ') : null,
            seats: updatedSeatsObjects,
            participant: updatedParticipant,
            attended: isFullyAttended,
            attendedCount: checkedInCount,
            attendedSeats: updatedAttendedSeats,
            checkInStatus,
            updatedAt: new Date().toISOString()
        };

        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: 'GUEST_UPDATE',
            screeningId,
            guestId: currentGuest.id,
            guestName: guests[index].name,
            details: req.body
        });
        
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

        const removedGuest = guests[index];
        guests.splice(index, 1);
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: 'GUEST_DELETE',
            screeningId: removedGuest.screeningId,
            guestId: removedGuest.id,
            guestName: removedGuest.name,
            details: { organization: removedGuest.organization, seat: removedGuest.seat }
        });
        
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
    } catch (error) {
        next(error);
    }
};

/**
 * Atomic Walk-in Registration from Seat Map
 * Creates guest, assigns seat, checks in (optional), tags source: "walk_in"
 */
exports.walkIn = async (req, res, next) => {
    try {
        const { screeningId, name, organization, phone, participant = 1, seat, seats, attended = false, follower, pic } = req.body;

        if (!screeningId || !name) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ screeningId และชื่อแขก (Name)'
            });
        }

        if (phone && String(phone).trim() !== '') {
            const cleanPhone = String(phone).trim().replace(/\D/g, '');
            if (cleanPhone.length !== 10) {
                return res.status(400).json({
                    success: false,
                    message: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)'
                });
            }
        }

        const partCount = parseInt(participant, 10) || 1;

        // 1. Check Theater Capacity (Siam Pavalai 1,164 seats)
        const capCheck = await seatService.checkCapacity(screeningId, partCount);
        if (capCheck.exceeded) {
            return res.status(400).json({
                success: false,
                code: 'CAPACITY_EXCEEDED',
                message: `จำนวนแขกจะเกินความจุโรงภาพยนตร์ (${capCheck.currentTotal + partCount}/${capCheck.capacity} ที่นั่ง)`,
                capacity: capCheck.capacity,
                currentTotal: capCheck.currentTotal,
                availableQuota: capCheck.availableQuota
            });
        }

        // 2. Parse and expand seat list
        let rawSeatStr = '';
        if (Array.isArray(seats) && seats.length > 0) {
            rawSeatStr = seats.join(',');
        } else if (seat) {
            rawSeatStr = seat;
        }
        const seatList = seatService.expandSeatRanges(rawSeatStr);

        // Check internal duplicate seats in request
        const seen = new Set();
        for (const s of seatList) {
            if (seen.has(s)) {
                return res.status(400).json({
                    success: false,
                    code: 'DUPLICATE_SEAT_IN_REQUEST',
                    message: `ที่นั่ง ${s} ถูกระบุซ้ำกันในคำขอ`
                });
            }
            seen.add(s);
        }

        // Golden Rule of Walk-in Groups: Seat Count Parity
        if (seatList.length > 0 && seatList.length !== partCount) {
            return res.status(400).json({
                success: false,
                code: 'SEAT_COUNT_MISMATCH',
                message: `จำนวนที่นั่งที่เลือก (${seatList.length} ที่) ไม่ตรงกับจำนวนผู้เข้าร่วม (${partCount} ท่าน)`,
                required: partCount,
                selected: seatList.length
            });
        }

        // Validate seat availability and validity for all selected seats
        if (seatList.length > 0) {
            const conflicted = [];
            const invalid = [];
            const valid = [];

            for (const s of seatList) {
                const check = await seatService.checkSeatAvailability(screeningId, s);
                if (!check.available) {
                    if (check.reason === 'INVALID_SEAT') {
                        invalid.push({ seatId: s, message: check.message });
                    } else {
                        conflicted.push({ seatId: s, occupant: check.occupant });
                    }
                } else {
                    valid.push(s);
                }
            }

            if (invalid.length > 0) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_SEAT',
                    message: `พบเลขที่นั่งที่ไม่มีอยู่ในผังโรงภาพยนตร์: ${invalid.map(i => i.seatId).join(', ')}`,
                    invalidSeats: invalid
                });
            }

            if (conflicted.length > 0) {
                const suggestedReplacements = [];
                for (const c of conflicted) {
                    const alts = await seatService.findAlternativeSeats(screeningId, c.seatId, 1);
                    if (alts.length > 0) {
                        suggestedReplacements.push(...alts.slice(0, 3));
                    }
                }

                return res.status(409).json({
                    success: false,
                    code: 'SEAT_CONFLICT',
                    message: `ที่นั่ง ${conflicted.map(c => c.seatId).join(', ')} ถูกจัดให้แขกท่านอื่นแล้ว`,
                    conflictedSeats: conflicted.map(c => c.seatId),
                    validSeats: valid,
                    conflictedDetails: conflicted,
                    suggestedReplacements
                });
            }
        }

        const guests = await readData('guests.json');
        const isAttended = !!attended;
        const seatsObjArray = seatList.map(code => ({ code, checkedIn: isAttended }));
        const checkInStatus = seatList.length > 0
            ? (isAttended ? 'complete' : 'not-checked')
            : (isAttended ? 'complete' : 'not-checked');

        let followerVal = null;
        if (follower !== undefined && follower !== null && follower !== '') {
            const parsed = parseInt(String(follower).replace(/,/g, ''), 10);
            followerVal = isNaN(parsed) ? null : parsed;
        }
        const picVal = pic !== undefined && pic !== null && String(pic).trim() !== ''
            ? String(pic).trim()
            : null;

        const newGuest = {
            id: 'gst-' + uuidv4().substring(0, 8),
            screeningId,
            name: name.trim(),
            organization: (organization && organization.trim()) || 'Walk-in แขกทั่วไป',
            phone: (phone && phone.trim()) || '',
            email: '',
            guestType: 'press',
            status: 'accepted',
            follower: followerVal,
            pic: picVal,
            seat: seatList.length > 0 ? seatList.join(', ') : null,
            seats: seatsObjArray,
            participant: partCount,
            attended: isAttended,
            attendedCount: isAttended ? (seatList.length > 0 ? seatList.length : partCount) : 0,
            attendedSeats: isAttended ? [...seatList] : [],
            checkInStatus,
            attendedAt: isAttended ? new Date().toISOString() : null,
            source: 'walk_in',
            notes: 'Walk-in หน้างาน',
            createdAt: new Date().toISOString()
        };

        guests.push(newGuest);
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: 'WALK_IN_CREATE',
            screeningId,
            guestId: newGuest.id,
            guestName: newGuest.name,
            details: { seats: seatList, participant: partCount, attended: isAttended }
        });

        res.status(201).json({
            success: true,
            data: newGuest,
            message: `เพิ่มแขก Walk-in คุณ ${newGuest.name} (${partCount} ท่าน, ที่นั่ง: ${seatList.join(', ') || 'ยังไม่ระบุ'}) ${isAttended ? 'และเช็คอินเรียบร้อย' : ''}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Safe Pre-Check-in & Partial Check-in
 */
exports.checkIn = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { attended, attendedCount, checkInAnyway } = req.body;

        const guests = await readData('guests.json');
        const guestIndex = guests.findIndex(g => g.id === id);

        if (guestIndex === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' });
        }

        const guest = guests[guestIndex];

        // If checking IN (attended = true or attendedCount > 0), perform validation
        const willBeAttended = attended !== undefined ? !!attended : (attendedCount > 0);

        if (willBeAttended && !checkInAnyway) {
            const missingCritical = [];
            if (!guest.name || guest.name.trim() === '' || guest.name === '-') missingCritical.push('ชื่อ (Name)');
            if (!guest.seat || guest.seat.trim() === '') missingCritical.push('ที่นั่ง (Seat)');

            const missingWarning = [];
            if (!guest.phone || guest.phone.trim() === '') missingWarning.push('เบอร์โทร (Tel)');

            if (missingCritical.length > 0) {
                return res.status(422).json({
                    success: false,
                    code: 'PRE_CHECKIN_VALIDATION_FAILED',
                    message: `ข้อมูลสำคัญไม่ครบ: ${missingCritical.join(', ')}`,
                    missingCritical,
                    missingWarning,
                    guest
                });
            }

            if (missingWarning.length > 0 && req.body.confirmedWarning !== true) {
                return res.status(200).json({
                    success: true,
                    requiresWarningConfirmation: true,
                    message: `แขกยังไม่มี ${missingWarning.join(', ')}`,
                    missingWarning,
                    guest
                });
            }
        }

        // Normalize seats array
        let seats = Array.isArray(guest.seats) && guest.seats.length > 0 && typeof guest.seats[0] === 'object'
            ? [...guest.seats]
            : (guest.seat ? seatService.expandSeatRanges(guest.seat).map(code => ({ code, checkedIn: !!guest.attended })) : []);

        const partQuota = guest.participant || (seats.length > 0 ? seats.length : 1);
        const action = req.body.action; // 'check_in' | 'check_out' | 'toggle' | 'partial'

        if (Array.isArray(req.body.seatCodes)) {
            // Explicit list of checked-in seats (from Assisted Partial Check-in modal checkboxes)
            const selectedSet = new Set(req.body.seatCodes.map(s => String(s).trim().toUpperCase()));
            seats = seats.map(s => ({
                code: s.code,
                checkedIn: selectedSet.has(s.code.toUpperCase())
            }));
        } else if (action === 'check_out' || attended === false) {
            seats = seats.map(s => ({ ...s, checkedIn: false }));
        } else if (action === 'check_in' || attended === true) {
            seats = seats.map(s => ({ ...s, checkedIn: true }));
        } else if (attendedCount !== undefined) {
            const count = Math.max(0, Math.min(partQuota, parseInt(attendedCount, 10)));
            seats = seats.map((s, idx) => ({ ...s, checkedIn: idx < count }));
        } else if (action === 'toggle' || req.body.allowToggle === true) {
            const nextAttended = !guest.attended;
            seats = seats.map(s => ({ ...s, checkedIn: nextAttended }));
        } else {
            // Default: Idempotent check-in
            seats = seats.map(s => ({ ...s, checkedIn: true }));
        }

        guest.seats = seats;
        const computed = computeGuestStatus(guest);
        Object.assign(guest, computed);
        guest.attendedAt = computed.attendedCount > 0 ? (guest.attendedAt || new Date().toISOString()) : null;
        guest.updatedAt = new Date().toISOString();

        guests[guestIndex] = guest;
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: computed.attendedCount > 0 ? 'CHECK_IN' : 'CHECK_OUT',
            screeningId: guest.screeningId,
            guestId: guest.id,
            guestName: guest.name,
            details: {
                attended: guest.attended,
                attendedCount: guest.attendedCount,
                checkInStatus: guest.checkInStatus,
                quota: partQuota
            }
        });

        res.json({
            success: true,
            data: guests[guestIndex],
            message: computed.attendedCount > 0
                ? `เช็คอินคุณ ${guest.name} (${computed.attendedCount}/${partQuota} ท่าน) สำเร็จ`
                : `ยกเลิกการเช็คอินคุณ ${guest.name}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Single-Seat Check-in / Check-out Toggle
 * PUT /api/guests/:id/seats/:seatCode/checkin
 * Body: { checkedIn: boolean } (optional, toggles if omitted)
 */
exports.checkInSeat = async (req, res, next) => {
    try {
        const { id, seatCode } = req.params;
        const targetSeatCode = (seatCode || '').trim().toUpperCase();

        const guests = await readData('guests.json');
        const guestIndex = guests.findIndex(g => g.id === id);
        if (guestIndex === -1) {
            return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้เข้าร่วม' });
        }

        const guest = guests[guestIndex];
        let seats = Array.isArray(guest.seats) && guest.seats.length > 0
            ? guest.seats.map(s => typeof s === 'object' && s !== null ? { ...s } : { code: String(s), checkedIn: !!guest.attended })
            : (guest.seat ? seatService.expandSeatRanges(guest.seat).map(code => ({ code, checkedIn: !!guest.attended })) : []);

        const seatIdx = seats.findIndex(s => s.code.toUpperCase() === targetSeatCode);
        if (seatIdx === -1) {
            return res.status(404).json({
                success: false,
                message: `ไม่พบที่นั่ง ${targetSeatCode} ในรายการที่จัดไว้ให้แขกท่านนี้`,
                availableSeats: seats.map(s => s.code)
            });
        }

        const currentSeatObj = seats[seatIdx];
        const newCheckedIn = req.body.checkedIn !== undefined ? !!req.body.checkedIn : !currentSeatObj.checkedIn;

        seats[seatIdx] = {
            code: targetSeatCode,
            checkedIn: newCheckedIn
        };

        guest.seats = seats;
        const computed = computeGuestStatus(guest);
        Object.assign(guest, computed);
        guest.attendedAt = computed.attendedCount > 0 ? (guest.attendedAt || new Date().toISOString()) : null;
        guest.updatedAt = new Date().toISOString();

        guests[guestIndex] = guest;
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: newCheckedIn ? 'SEAT_CHECK_IN' : 'SEAT_CHECK_OUT',
            screeningId: guest.screeningId,
            guestId: guest.id,
            guestName: guest.name,
            details: { seat: targetSeatCode, checkedIn: newCheckedIn, checkInStatus: guest.checkInStatus }
        });

        res.json({
            success: true,
            data: guest,
            seatCode: targetSeatCode,
            checkedIn: newCheckedIn,
            message: newCheckedIn
                ? `เช็คอินที่นั่ง ${targetSeatCode} ของคุณ ${guest.name} เรียบร้อย`
                : `ยกเลิกเช็คอินที่นั่ง ${targetSeatCode} ของคุณ ${guest.name}`
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Safe Bulk Delete with Auto-Snapshot and Undo preparation
 */
exports.bulkDelete = async (req, res, next) => {
    try {
        const { screeningId, confirmation } = req.body;
        if (!screeningId) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ screeningId' });
        }

        const allGuests = await readData('guests.json');
        const targetGuests = allGuests.filter(g => g.screeningId === screeningId);

        if (targetGuests.length === 0) {
            return res.status(400).json({ success: false, message: 'ไม่มีรายชื่อแขกในรอบฉายนี้' });
        }

        // Expected confirmation: 'DELETE' or 'DELETE ' + targetGuests.length
        const validConfirmation = (confirmation === 'DELETE' || confirmation === `DELETE ${targetGuests.length}`);
        if (!validConfirmation) {
            return res.status(400).json({
                success: false,
                message: `คำยืนยันไม่ถูกต้อง กรุณาพิมพ์ DELETE ${targetGuests.length} เพื่อยืนยันการลบ`
            });
        }

        // 1. Create safety snapshot before delete
        const snapshot = await snapshotService.createSnapshot(screeningId, 'bulk_delete');

        // 2. Remove only guests for this screening
        const remainingGuests = allGuests.filter(g => g.screeningId !== screeningId);
        await writeData('guests.json', remainingGuests);

        // 3. Log activity
        await auditService.logActivity({
            action: 'BULK_DELETE',
            screeningId,
            details: {
                deletedCount: targetGuests.length,
                snapshotId: snapshot.id
            }
        });

        res.json({
            success: true,
            message: `ลบรายชื่อแขกในรอบนี้จำนวน ${targetGuests.length} รายการเรียบร้อยแล้ว (สามารถกด Undo กู้คืนได้)`,
            data: {
                deletedCount: targetGuests.length,
                snapshotId: snapshot.id,
                snapshot
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Undo / Restore from Snapshot
 */
exports.restoreSnapshot = async (req, res, next) => {
    try {
        const { screeningId, snapshotId } = req.body;
        if (!screeningId || !snapshotId) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ screeningId และ snapshotId'
            });
        }

        const result = await snapshotService.restoreSnapshot(screeningId, snapshotId);

        await auditService.logActivity({
            action: 'RESTORE_SNAPSHOT',
            screeningId,
            details: { snapshotId, restoredCount: result.restoredCount }
        });

        res.json({
            success: true,
            message: `กู้คืนรายชื่อแขกสำเร็จ ${result.restoredCount} รายการ`,
            data: result
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Detect Duplicate Guests (by phone or name)
 */
exports.checkDuplicates = async (req, res, next) => {
    try {
        const { screeningId, phone, name } = req.query;
        if (!screeningId) {
            return res.status(400).json({ success: false, message: 'กรุณาระบุ screeningId' });
        }

        const guests = await readData('guests.json');
        const screeningGuests = guests.filter(g => g.screeningId === screeningId);
        const duplicates = [];

        const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
        const cleanName = name ? name.toLowerCase().trim() : '';

        for (const g of screeningGuests) {
            let matchType = null;
            const gPhone = g.phone ? g.phone.replace(/\D/g, '') : '';
            const gName = g.name ? g.name.toLowerCase().trim() : '';

            if (cleanPhone && gPhone && cleanPhone.length >= 8 && (gPhone === cleanPhone || gPhone.includes(cleanPhone) || cleanPhone.includes(gPhone))) {
                matchType = 'เบอร์โทรศัพท์ตรงกัน';
            } else if (cleanName && gName && (gName === cleanName || (cleanName.length > 4 && gName.includes(cleanName)))) {
                matchType = 'ชื่อคล้ายหรือตรงกัน';
            }

            if (matchType) {
                duplicates.push({
                    guest: {
                        id: g.id,
                        name: g.name,
                        organization: g.organization,
                        phone: g.phone,
                        seat: g.seat,
                        attended: g.attended
                    },
                    matchType
                });
            }
        }

        res.json({ success: true, duplicates });
    } catch (error) {
        next(error);
    }
};

exports.importBatch = async (req, res, next) => {
    try {
        const { screeningId, guests: newGuestsList, replaceExisting } = req.body;
        if (!screeningId || !Array.isArray(newGuestsList)) {
            return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง กรุณาระบุ screeningId และรายการแขก' });
        }

        // 1. Check Capacity (1,164 seats default)
        const totalImportParticipants = newGuestsList.reduce((sum, item) => sum + (parseInt(item.participant, 10) || 1), 0);
        let allGuests = await readData('guests.json');
        const existingScreeningGuests = allGuests.filter(g => g.screeningId === screeningId);
        const existingParticipants = replaceExisting ? 0 : existingScreeningGuests.reduce((sum, g) => sum + (parseInt(g.participant, 10) || 1), 0);

        const screenings = await readData('screenings.json');
        const sc = screenings.find(s => s.id === screeningId);
        const maxCapacity = (sc && sc.capacity) ? sc.capacity : 1164;

        if (existingParticipants + totalImportParticipants > maxCapacity) {
            return res.status(400).json({
                success: false,
                code: 'CAPACITY_EXCEEDED',
                message: `จำนวนผู้เข้าร่วมทั้งหมด (${existingParticipants + totalImportParticipants} ท่าน) จะเกินความจุของโรงภาพยนตร์ (${maxCapacity} ที่นั่ง)`,
                currentCount: existingParticipants,
                importCount: totalImportParticipants,
                capacity: maxCapacity
            });
        }

        // 2. Validate Seats in the Import Batch
        // A) Internal duplicate seats within file
        // B) Invalid seat IDs not existing in layout
        // C) Collisions with existing guests (if not replacing)
        const batchSeatsMap = new Map();
        const internalDuplicates = [];
        const invalidSeats = [];
        const externalConflicts = [];

        // Build existing seats map if not replacing
        const existingSeatsMap = new Map();
        if (!replaceExisting) {
            for (const g of existingScreeningGuests) {
                if (!g.seat) continue;
                const seats = seatService.expandSeatRanges(g.seat);
                for (const s of seats) {
                    existingSeatsMap.set(s, g);
                }
            }
        }

        newGuestsList.forEach((item, idx) => {
            const rowNumber = idx + 1;
            const guestName = (item.name && item.name.trim()) || (item.organization && item.organization.trim()) || `แถวที่ ${rowNumber}`;
            if (!item.seat) return;

            const seats = seatService.expandSeatRanges(item.seat);
            for (const s of seats) {
                // Check if seat exists in layout
                if (!seatService.isValidSeatId(s)) {
                    invalidSeats.push({ row: rowNumber, name: guestName, seat: s });
                    continue;
                }

                // Check internal duplicates within batch
                if (batchSeatsMap.has(s)) {
                    const prev = batchSeatsMap.get(s);
                    internalDuplicates.push({
                        seat: s,
                        firstOccurrence: { row: prev.row, name: prev.name, org: prev.org },
                        duplicateOccurrence: { row: rowNumber, name: guestName, org: item.organization || '' }
                    });
                } else {
                    batchSeatsMap.set(s, { row: rowNumber, name: guestName, org: item.organization || '' });
                }

                // Check external conflicts with existing guests
                if (!replaceExisting && existingSeatsMap.has(s)) {
                    const occupant = existingSeatsMap.get(s);
                    externalConflicts.push({
                        seat: s,
                        importRow: rowNumber,
                        importGuest: guestName,
                        occupiedBy: { id: occupant.id, name: occupant.name, organization: occupant.organization }
                    });
                }
            }
        });

        // If validation errors found, reject before writing anything to file!
        const errorMessages = [];
        if (internalDuplicates.length > 0) {
            errorMessages.push(`พบที่นั่งซ้ำกันเองในไฟล์ ${internalDuplicates.length} รายการ (เช่น ${internalDuplicates.slice(0, 3).map(d => `${d.seat} ซ้ำระหว่างแถว ${d.firstOccurrence.row} กับ ${d.duplicateOccurrence.row}`).join(', ')})`);
        }
        if (invalidSeats.length > 0) {
            errorMessages.push(`พบเลขที่นั่งที่ไม่มีในผังโรง ${invalidSeats.length} รายการ (เช่น ${invalidSeats.slice(0, 3).map(i => `${i.seat} ที่แถว ${i.row}`).join(', ')})`);
        }
        if (externalConflicts.length > 0) {
            errorMessages.push(`พบที่นั่งที่ชนกับแขกเดิมในระบบ ${externalConflicts.length} รายการ (เช่น ${externalConflicts.slice(0, 3).map(c => `${c.seat} ชนกับคุณ ${c.occupiedBy.name}`).join(', ')})`);
        }

        if (errorMessages.length > 0) {
            return res.status(409).json({
                success: false,
                code: 'IMPORT_SEAT_VALIDATION_FAILED',
                message: errorMessages.join(' | '),
                details: {
                    internalDuplicates,
                    invalidSeats,
                    externalConflicts
                }
            });
        }

        // Passed validation! Proceed to snapshot and save
        if (replaceExisting) {
            await snapshotService.createSnapshot(screeningId, 'import_replace');
            allGuests = allGuests.filter(g => g.screeningId !== screeningId);
        }

        const processed = newGuestsList.map((item, idx) => {
            const part = parseInt(item.participant, 10) || 1;
            const isAttended = !!item.attended;
            const expandedSeats = item.seat ? seatService.expandSeatRanges(item.seat) : [];
            const seatString = expandedSeats.length > 0 ? expandedSeats.join(', ') : null;
            const seatsObjArray = expandedSeats.map(code => ({ code, checkedIn: isAttended }));
            const checkInStatus = expandedSeats.length > 0
                ? (isAttended ? 'complete' : 'not-checked')
                : (isAttended ? 'complete' : 'not-checked');

            const detailVal = (item.detail && item.detail.trim()) || (item.organization && item.organization.trim()) || '';
            const orgVal = (item.organization && item.organization.trim()) || (item.detail && item.detail.trim()) || 'ไม่ระบุสังกัด';
            const nameVal = (item.name && item.name.trim()) || orgVal || `แขกลำดับที่ ${idx + 1}`;

            let followerVal = null;
            if (item.follower !== undefined && item.follower !== null && item.follower !== '') {
                const parsed = parseInt(String(item.follower).replace(/,/g, ''), 10);
                followerVal = isNaN(parsed) ? null : parsed;
            }
            const picVal = item.pic !== undefined && item.pic !== null && String(item.pic).trim() !== ''
                ? String(item.pic).trim()
                : null;

            return {
                id: item.id || ('gst-' + uuidv4().substring(0, 8)),
                screeningId,
                name: nameVal,
                organization: orgVal,
                detail: detailVal,
                follower: followerVal,
                pic: picVal,
                phone: (item.phone && item.phone.trim()) || '',
                email: (item.email && item.email.trim()) || '',
                guestType: item.guestType || 'press',
                status: item.status || 'accepted',
                seat: seatString,
                seats: seatsObjArray,
                participant: part,
                attended: isAttended,
                attendedCount: isAttended ? (expandedSeats.length > 0 ? expandedSeats.length : part) : 0,
                attendedSeats: isAttended ? [...expandedSeats] : [],
                checkInStatus,
                notes: item.notes || '',
                platforms: item.platforms || {},
                handles: item.handles || {},
                source: item.source || 'import',
                createdAt: new Date().toISOString()
            };
        });

        allGuests.push(...processed);
        await writeData('guests.json', allGuests);

        await auditService.logActivity({
            action: 'IMPORT_BATCH',
            screeningId,
            details: { count: processed.length, replaceExisting: !!replaceExisting }
        });

        res.json({
            success: true,
            message: `นำเข้าข้อมูลสำเร็จ ${processed.length} รายการ (ผ่านการตรวจสอบความถูกต้องเรียบร้อย)`,
            data: { count: processed.length }
        });
    } catch (error) {
        next(error);
    }
};
