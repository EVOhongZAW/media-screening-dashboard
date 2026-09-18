const { readData, writeData } = require('../services/dataService');
const { v4: uuidv4 } = require('uuid');
const seatService = require('../services/seatService');
const snapshotService = require('../services/snapshotService');
const auditService = require('../services/auditService');

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
        const screeningId = req.body.screeningId;

        // If seat provided, check availability
        if (req.body.seat && screeningId) {
            const seatList = req.body.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            for (const s of seatList) {
                const check = await seatService.checkSeatAvailability(screeningId, s);
                if (!check.available) {
                    const alternatives = await seatService.findAlternativeSeats(screeningId, s, 1);
                    return res.status(409).json({
                        success: false,
                        code: 'SEAT_CONFLICT',
                        message: `ที่นั่ง ${s} ถูกจองแล้วโดย ${check.occupant.name} (${check.occupant.organization})`,
                        occupant: check.occupant,
                        seatId: s,
                        alternatives
                    });
                }
            }
        }

        const participant = parseInt(req.body.participant, 10) || 1;
        const attended = !!req.body.attended;

        const newGuest = {
            id: 'gst-' + uuidv4().substring(0, 8),
            ...req.body,
            participant,
            attended,
            attendedCount: attended ? participant : (parseInt(req.body.attendedCount, 10) || 0),
            attendedSeats: req.body.attendedSeats || [],
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
            details: { organization: newGuest.organization, seat: newGuest.seat }
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

        // If seat is being changed, verify conflict
        if (req.body.seat !== undefined && req.body.seat !== currentGuest.seat && req.body.seat) {
            const newSeats = req.body.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            for (const s of newSeats) {
                const check = await seatService.checkSeatAvailability(screeningId, s, currentGuest.id);
                if (!check.available) {
                    const alternatives = await seatService.findAlternativeSeats(screeningId, s, 1);
                    return res.status(409).json({
                        success: false,
                        code: 'SEAT_CONFLICT',
                        message: `ที่นั่ง ${s} ถูกจองแล้วโดย ${check.occupant.name} (${check.occupant.organization})`,
                        occupant: check.occupant,
                        seatId: s,
                        alternatives
                    });
                }
            }
        }

        // Handle participant & attended synchronization
        const updatedParticipant = req.body.participant !== undefined ? (parseInt(req.body.participant, 10) || 1) : currentGuest.participant;
        let updatedAttended = req.body.attended !== undefined ? !!req.body.attended : currentGuest.attended;
        let updatedAttendedCount = currentGuest.attendedCount || 0;

        if (req.body.attendedCount !== undefined) {
            updatedAttendedCount = parseInt(req.body.attendedCount, 10) || 0;
            updatedAttended = updatedAttendedCount >= updatedParticipant;
        } else if (req.body.attended !== undefined) {
            updatedAttendedCount = updatedAttended ? updatedParticipant : 0;
        }

        guests[index] = {
            ...currentGuest,
            ...req.body,
            participant: updatedParticipant,
            attended: updatedAttended,
            attendedCount: updatedAttendedCount,
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
        const { screeningId, name, organization, phone, participant = 1, seat, seats, attended = false } = req.body;

        if (!screeningId || !name) {
            return res.status(400).json({
                success: false,
                message: 'กรุณาระบุ screeningId และชื่อแขก (Name)'
            });
        }

        const partCount = parseInt(participant, 10) || 1;

        // Parse seat list from seats array or seat string
        let seatList = [];
        if (Array.isArray(seats) && seats.length > 0) {
            seatList = seats.map(s => s.trim().toUpperCase()).filter(Boolean);
        } else if (seat) {
            seatList = seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
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

        // Validate seat availability for all selected seats
        if (seatList.length > 0) {
            const conflicted = [];
            const valid = [];

            for (const s of seatList) {
                const check = await seatService.checkSeatAvailability(screeningId, s);
                if (!check.available) {
                    conflicted.push({ seatId: s, occupant: check.occupant });
                } else {
                    valid.push(s);
                }
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

        const newGuest = {
            id: 'gst-' + uuidv4().substring(0, 8),
            screeningId,
            name: name.trim(),
            organization: (organization && organization.trim()) || 'Walk-in แขกทั่วไป',
            phone: (phone && phone.trim()) || '',
            email: '',
            guestType: 'press',
            status: 'accepted',
            seat: seatList.length > 0 ? seatList.join(', ') : null,
            seats: seatList,
            participant: partCount,
            attended: isAttended,
            attendedCount: isAttended ? partCount : 0,
            attendedSeats: isAttended ? [...seatList] : [],
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

        // Apply check-in or check-out
        const partQuota = guest.participant || 1;
        let finalAttendedCount = 0;
        let finalAttended = false;

        if (attendedCount !== undefined) {
            finalAttendedCount = Math.max(0, Math.min(partQuota, parseInt(attendedCount, 10)));
            finalAttended = finalAttendedCount >= partQuota;
        } else if (attended !== undefined) {
            finalAttended = !!attended;
            finalAttendedCount = finalAttended ? partQuota : 0;
        } else {
            // Toggle
            finalAttended = !guest.attended;
            finalAttendedCount = finalAttended ? partQuota : 0;
        }

        guests[guestIndex].attended = finalAttended;
        guests[guestIndex].attendedCount = finalAttendedCount;
        guests[guestIndex].attendedAt = finalAttendedCount > 0 ? new Date().toISOString() : null;

        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: finalAttendedCount > 0 ? 'CHECK_IN' : 'CHECK_OUT',
            screeningId: guest.screeningId,
            guestId: guest.id,
            guestName: guest.name,
            details: {
                attended: finalAttended,
                attendedCount: finalAttendedCount,
                quota: partQuota
            }
        });

        res.json({
            success: true,
            data: guests[guestIndex],
            message: finalAttendedCount > 0
                ? `เช็คอินคุณ ${guest.name} (${finalAttendedCount}/${partQuota} ท่าน) สำเร็จ`
                : `ยกเลิกการเช็คอินคุณ ${guest.name}`
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

        let guests = await readData('guests.json');

        if (replaceExisting) {
            // Snapshot before replace
            await snapshotService.createSnapshot(screeningId, 'import_replace');
            guests = guests.filter(g => g.screeningId !== screeningId);
        }

        const processed = newGuestsList.map((item, idx) => {
            const part = parseInt(item.participant, 10) || 1;
            const isAttended = !!item.attended;
            return {
                id: item.id || ('gst-' + uuidv4().substring(0, 8)),
                screeningId,
                name: (item.name && item.name.trim()) || (item.organization && item.organization.trim()) || `แขกลำดับที่ ${idx + 1}`,
                organization: (item.organization && item.organization.trim()) || 'ไม่ระบุสังกัด',
                phone: (item.phone && item.phone.trim()) || '',
                email: (item.email && item.email.trim()) || '',
                guestType: item.guestType || 'press',
                status: item.status || 'accepted',
                seat: item.seat ? item.seat.trim() : null,
                participant: part,
                attended: isAttended,
                attendedCount: isAttended ? part : 0,
                attendedSeats: [],
                notes: item.notes || '',
                platforms: item.platforms || {},
                handles: item.handles || {},
                source: item.source || 'import',
                createdAt: new Date().toISOString()
            };
        });

        guests.push(...processed);
        await writeData('guests.json', guests);

        await auditService.logActivity({
            action: 'IMPORT_BATCH',
            screeningId,
            details: { count: processed.length, replaceExisting: !!replaceExisting }
        });

        res.json({
            success: true,
            message: `นำเข้าข้อมูลสำเร็จ ${processed.length} รายการ`,
            data: { count: processed.length }
        });
    } catch (error) {
        next(error);
    }
};
