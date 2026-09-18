const { readData, writeData } = require('./dataService');
const { logActivity } = require('./auditService');

/**
 * Get map of all booked seats for a screening
 */
async function getScreeningSeatsMap(screeningId) {
  const guests = await readData('guests.json');
  const screeningGuests = guests.filter(g => g.screeningId === screeningId);
  const map = {};

  for (const g of screeningGuests) {
    if (!g.seat) continue;
    const seats = g.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    for (const seatId of seats) {
      map[seatId] = g;
    }
  }

  return { map, guests, screeningGuests };
}

/**
 * Check if a seat is available in a screening
 */
async function checkSeatAvailability(screeningId, seatId, excludeGuestId = null) {
  const { map } = await getScreeningSeatsMap(screeningId);
  const normalized = seatId.trim().toUpperCase();
  const occupant = map[normalized];

  if (occupant && occupant.id !== excludeGuestId) {
    return {
      available: false,
      occupant: {
        id: occupant.id,
        name: occupant.name,
        organization: occupant.organization,
        phone: occupant.phone,
        attended: occupant.attended
      }
    };
  }

  return { available: true, occupant: null };
}

/**
 * Assign a single seat to a guest with conflict detection
 */
async function assignSeat(screeningId, guestId, seatId) {
  return assignSeatsBulk(screeningId, guestId, [seatId]);
}

/**
 * Assign multiple seats to a guest with atomic non-destructive conflict detection
 */
async function assignSeatsBulk(screeningId, guestId, seatIds) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    throw new Error('กรุณาระบุที่นั่งที่ต้องการจัด');
  }

  const normalizedSeats = seatIds.map(s => s.trim().toUpperCase()).filter(Boolean);
  const { map } = await getScreeningSeatsMap(screeningId);

  const conflictedSeats = [];
  const validSeats = [];

  for (const s of normalizedSeats) {
    const occupant = map[s];
    if (occupant && occupant.id !== guestId) {
      conflictedSeats.push({
        seatId: s,
        occupant: {
          id: occupant.id,
          name: occupant.name,
          organization: occupant.organization,
          phone: occupant.phone
        }
      });
    } else {
      validSeats.push(s);
    }
  }

  if (conflictedSeats.length > 0) {
    const suggestedReplacements = [];
    for (const c of conflictedSeats) {
      const alts = await findAlternativeSeats(screeningId, c.seatId, 1);
      if (alts.length > 0) {
        suggestedReplacements.push(...alts.slice(0, 3));
      }
    }

    const error = new Error(`ที่นั่ง ${conflictedSeats.map(c => c.seatId).join(', ')} ถูกจัดให้แขกท่านอื่นแล้ว`);
    error.code = 'SEAT_CONFLICT';
    error.conflictedSeats = conflictedSeats.map(c => c.seatId);
    error.validSeats = validSeats;
    error.conflictedDetails = conflictedSeats;
    error.suggestedReplacements = suggestedReplacements;
    throw error;
  }

  const allGuests = await readData('guests.json');
  const guestIndex = allGuests.findIndex(g => g.id === guestId && g.screeningId === screeningId);
  if (guestIndex === -1) {
    throw new Error('ไม่พบข้อมูลแขกในรอบฉายนี้');
  }

  const guest = allGuests[guestIndex];
  let currentSeats = guest.seat ? guest.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  
  for (const s of normalizedSeats) {
    if (!currentSeats.includes(s)) {
      currentSeats.push(s);
    }
  }

  guest.seat = currentSeats.join(', ');
  guest.seats = currentSeats;
  await writeData('guests.json', allGuests);

  await logActivity({
    action: 'SEAT_ASSIGN',
    screeningId,
    guestId: guest.id,
    guestName: guest.name,
    details: { assignedSeats: normalizedSeats, allSeats: guest.seat }
  });

  return guest;
}

/**
 * Move a single seat from one location to another
 */
async function moveSeat(screeningId, guestId, fromSeat, toSeat) {
  return movePartialSeats(screeningId, guestId, [{ from: fromSeat, to: toSeat }]);
}

/**
 * Move partial or multiple seats for a guest
 * moves: Array<{ from: string, to: string }>
 */
async function movePartialSeats(screeningId, guestId, moves) {
  if (!Array.isArray(moves) || moves.length === 0) {
    throw new Error('กรุณาระบุรายการย้ายที่นั่ง');
  }

  const { map } = await getScreeningSeatsMap(screeningId);
  const conflictedSeats = [];
  const normalizedMoves = moves.map(m => ({
    from: m.from.trim().toUpperCase(),
    to: m.to.trim().toUpperCase()
  }));

  for (const m of normalizedMoves) {
    if (m.from === m.to) {
      throw new Error(`ที่นั่งใหม่ ${m.to} ต้องไม่ตรงกับที่นั่งเดิม`);
    }
    const occupant = map[m.to];
    if (occupant && occupant.id !== guestId) {
      conflictedSeats.push({
        seatId: m.to,
        occupant: {
          id: occupant.id,
          name: occupant.name,
          organization: occupant.organization
        }
      });
    }
  }

  if (conflictedSeats.length > 0) {
    const suggestedReplacements = [];
    for (const c of conflictedSeats) {
      const alts = await findAlternativeSeats(screeningId, c.seatId, 1);
      if (alts.length > 0) {
        suggestedReplacements.push(...alts.slice(0, 3));
      }
    }

    const error = new Error(`ที่นั่งปลายทาง ${conflictedSeats.map(c => c.seatId).join(', ')} ถูกจัดให้ผู้อื่นแล้ว`);
    error.code = 'SEAT_CONFLICT';
    error.conflictedSeats = conflictedSeats.map(c => c.seatId);
    error.conflictedDetails = conflictedSeats;
    error.suggestedReplacements = suggestedReplacements;
    throw error;
  }

  const allGuests = await readData('guests.json');
  const guestIndex = allGuests.findIndex(g => g.id === guestId && g.screeningId === screeningId);
  if (guestIndex === -1) {
    throw new Error('ไม่พบข้อมูลแขกในรอบฉายนี้');
  }

  const guest = allGuests[guestIndex];
  let currentSeats = guest.seat ? guest.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  let attendedSeats = Array.isArray(guest.attendedSeats) ? [...guest.attendedSeats] : [];

  for (const m of normalizedMoves) {
    const fromIdx = currentSeats.indexOf(m.from);
    if (fromIdx !== -1) {
      currentSeats[fromIdx] = m.to;
    } else {
      currentSeats.push(m.to);
    }

    const attIdx = attendedSeats.indexOf(m.from);
    if (attIdx !== -1) {
      attendedSeats[attIdx] = m.to;
    }
  }

  guest.seat = currentSeats.join(', ');
  guest.seats = currentSeats;
  guest.attendedSeats = attendedSeats;
  await writeData('guests.json', allGuests);

  await logActivity({
    action: 'SEAT_MOVE',
    screeningId,
    guestId: guest.id,
    guestName: guest.name,
    details: { moves: normalizedMoves, allSeats: guest.seat }
  });

  return guest;
}

/**
 * Release / unassign a seat
 */
async function releaseSeat(screeningId, guestId, seatId) {
  const normalized = seatId.trim().toUpperCase();
  const allGuests = await readData('guests.json');
  const guestIndex = allGuests.findIndex(g => g.id === guestId && g.screeningId === screeningId);
  if (guestIndex === -1) {
    throw new Error('ไม่พบข้อมูลแขกในรอบฉายนี้');
  }

  const guest = allGuests[guestIndex];
  let currentSeats = guest.seat ? guest.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  currentSeats = currentSeats.filter(s => s !== normalized);

  guest.seat = currentSeats.length > 0 ? currentSeats.join(', ') : null;
  guest.seats = currentSeats;
  if (Array.isArray(guest.attendedSeats)) {
    guest.attendedSeats = guest.attendedSeats.filter(s => s !== normalized);
  }

  await writeData('guests.json', allGuests);

  await logActivity({
    action: 'SEAT_RELEASE',
    screeningId,
    guestId: guest.id,
    guestName: guest.name,
    details: { releasedSeat: normalized, remainingSeats: guest.seat }
  });

  return guest;
}

/**
 * Smart Alternative Seat Recommendations for a single target seat
 */
async function findAlternativeSeats(screeningId, targetSeat, count = 1) {
  const normalized = targetSeat.trim().toUpperCase();
  const match = normalized.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return [];

  const targetRow = match[1];
  const targetCol = parseInt(match[2], 10);

  const { map } = await getScreeningSeatsMap(screeningId);
  const layout = await readData('pavalai_layout.json');

  if (!layout || !layout.rows) return [];

  const rowData = layout.rows.find(r => (r.label || r.id || '').toUpperCase() === targetRow);
  if (!rowData) return [];

  const alternatives = [];
  const isFree = (seatId) => seatId && !map[seatId.toUpperCase()];

  const freeInRow = rowData.seats.filter(s => isFree(s.id));
  freeInRow.sort((a, b) => Math.abs(a.num - targetCol) - Math.abs(b.num - targetCol));

  if (count === 1) {
    for (const s of freeInRow.slice(0, 6)) {
      alternatives.push({
        seatId: s.id,
        row: rowData.label || rowData.id,
        num: s.num,
        tier: rowData.tier,
        zone: s.zone,
        reason: 'แถวเดียวกัน (ใกล้ที่สุด)'
      });
    }
  }

  if (alternatives.length < 3) {
    const rowIdx = layout.rows.findIndex(r => (r.label || r.id || '').toUpperCase() === targetRow);
    const adjacentRowIndices = [rowIdx - 1, rowIdx + 1].filter(idx => idx >= 0 && idx < layout.rows.length);

    for (const adjIdx of adjacentRowIndices) {
      const adjRow = layout.rows[adjIdx];
      const freeAdj = adjRow.seats.filter(s => isFree(s.id));
      freeAdj.sort((a, b) => Math.abs(a.num - targetCol) - Math.abs(b.num - targetCol));

      for (const s of freeAdj.slice(0, 3)) {
        alternatives.push({
          seatId: s.id,
          row: adjRow.label || adjRow.id,
          num: s.num,
          tier: adjRow.tier,
          zone: s.zone,
          reason: `แถวใกล้เคียง (แถว ${adjRow.label})`
        });
        if (alternatives.length >= 6) break;
      }
      if (alternatives.length >= 6) break;
    }
  }

  return alternatives;
}

/**
 * Heuristic Group Recommendations Algorithm
 * Evaluates available seat groups of size count across the theater.
 * Priority 1: All contiguous in the same row (+100)
 * Priority 2: Same row with small gap (+50)
 * Priority 3: Clustered 2x2 or adjacent rows (+30)
 * Priority 4: Distance from preferred/current seat (+20)
 * Penalties: Splitting rows (-30), cross tiers (-100)
 */
async function findGroupRecommendations(screeningId, count = 1, preferredSeat = null) {
  const reqCount = Math.max(1, parseInt(count, 10) || 1);
  const { map } = await getScreeningSeatsMap(screeningId);
  const layout = await readData('pavalai_layout.json');

  if (!layout || !layout.rows) return [];

  const isFree = (seatId) => seatId && !map[seatId.toUpperCase()];
  const candidateGroups = [];

  let targetRow = null;
  let targetCol = null;
  let targetTier = 'stalls';

  if (preferredSeat) {
    const match = preferredSeat.trim().toUpperCase().match(/^([A-Za-z]+)(\d+)$/);
    if (match) {
      targetRow = match[1];
      targetCol = parseInt(match[2], 10);
      const rObj = layout.rows.find(r => (r.label || r.id || '').toUpperCase() === targetRow);
      if (rObj) targetTier = rObj.tier;
    }
  }

  // 1. Search for contiguous blocks in each row
  for (let rIdx = 0; rIdx < layout.rows.length; rIdx++) {
    const row = layout.rows[rIdx];
    const rowLabel = row.label || row.id;
    const seats = row.seats || [];
    const tier = row.tier || 'stalls';

    if (seats.length < reqCount) continue;

    for (let i = 0; i <= seats.length - reqCount; i++) {
      const window = seats.slice(i, i + reqCount);
      const allAvailable = window.every(s => isFree(s.id));

      if (allAvailable) {
        let score = 100; // Base contiguous score

        if (targetRow && targetCol !== null) {
          const rowDist = Math.abs(rIdx - layout.rows.findIndex(r => (r.label || r.id || '').toUpperCase() === targetRow));
          const centerCol = window[Math.floor(window.length / 2)].num;
          const colDist = Math.abs(centerCol - targetCol);

          score += Math.max(0, 30 - rowDist * 5);
          score += Math.max(0, 20 - colDist);
          if (tier === targetTier) score += 10;
        } else {
          const centerCol = window[Math.floor(window.length / 2)].num;
          if (centerCol >= 12 && centerCol <= 38) score += 15;
          if (tier === 'stalls') score += 10;
        }

        const seatIds = window.map(s => s.id);
        const display = `${seatIds[0]} - ${seatIds[seatIds.length - 1]}`;

        candidateGroups.push({
          seats: seatIds,
          display,
          row: rowLabel,
          tier: tier === 'balcony' ? 'Balcony' : 'Grand Stalls',
          score,
          priority: 1,
          reason: 'ที่นั่งติดกันในแถวเดียวกัน (ดีที่สุด)'
        });
      }
    }
  }

  // 2. If we need more groups or if count >= 3, check same row with 1 empty space (gap)
  if (candidateGroups.length < 5 && reqCount >= 2) {
    for (let rIdx = 0; rIdx < layout.rows.length; rIdx++) {
      const row = layout.rows[rIdx];
      const seats = row.seats || [];
      const tier = row.tier || 'stalls';

      const winSize = reqCount + 1;
      if (seats.length < winSize) continue;

      for (let i = 0; i <= seats.length - winSize; i++) {
        const window = seats.slice(i, i + winSize);
        const freeSeats = window.filter(s => isFree(s.id));

        if (freeSeats.length === reqCount) {
          let score = 50;
          if (targetRow) {
            const rowDist = Math.abs(rIdx - layout.rows.findIndex(r => (r.label || r.id || '').toUpperCase() === targetRow));
            score += Math.max(0, 20 - rowDist * 5);
          }

          const seatIds = freeSeats.map(s => s.id);
          candidateGroups.push({
            seats: seatIds,
            display: seatIds.join(', '),
            row: row.label || row.id,
            tier: tier === 'balcony' ? 'Balcony' : 'Grand Stalls',
            score,
            priority: 2,
            reason: 'แถวเดียวกัน (มีช่องว่าง 1 ที่นั่ง)'
          });
        }
      }
    }
  }

  // 3. Clustered across adjacent rows (e.g. 4 people = 2 in row E + 2 in row F)
  if (candidateGroups.length < 5 && reqCount >= 4) {
    const half = Math.ceil(reqCount / 2);
    const rem = reqCount - half;

    for (let rIdx = 0; rIdx < layout.rows.length - 1; rIdx++) {
      const row1 = layout.rows[rIdx];
      const row2 = layout.rows[rIdx + 1];

      if (row1.tier !== row2.tier) continue;

      for (let i = 0; i <= (row1.seats || []).length - half; i++) {
        const win1 = row1.seats.slice(i, i + half);
        if (!win1.every(s => isFree(s.id))) continue;

        const startNum = win1[0].num;
        const win2 = (row2.seats || []).filter(s => s.num >= startNum && s.num < startNum + rem);

        if (win2.length === rem && win2.every(s => isFree(s.id))) {
          const combined = [...win1.map(s => s.id), ...win2.map(s => s.id)];
          candidateGroups.push({
            seats: combined,
            display: `${win1[0].id}-${win1[win1.length - 1].id} & ${win2[0].id}-${win2[win2.length - 1].id}`,
            row: `${row1.label || row1.id}, ${row2.label || row2.id}`,
            tier: row1.tier === 'balcony' ? 'Balcony' : 'Grand Stalls',
            score: 35,
            priority: 3,
            reason: 'กลุ่มติดกัน 2 แถวติดกัน'
          });
          if (candidateGroups.length >= 10) break;
        }
      }
      if (candidateGroups.length >= 10) break;
    }
  }

  candidateGroups.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const uniqueTop = [];

  for (const g of candidateGroups) {
    const key = g.seats.slice().sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      uniqueTop.push(g);
      if (uniqueTop.length >= 5) break;
    }
  }

  return uniqueTop;
}

/**
 * Get all 1,164 seats with their live status, tier, zone, and occupant details
 */
async function getAllSeatsStatus(screeningId) {
  const { map } = await getScreeningSeatsMap(screeningId);
  const layout = await readData('pavalai_layout.json');

  if (!layout || !layout.rows) return { seats: [], summary: {} };

  const seats = [];
  let availableCount = 0;
  let assignedCount = 0;
  let attendedCount = 0;

  for (const row of layout.rows) {
    for (const s of (row.seats || [])) {
      const occupant = map[s.id.toUpperCase()];
      let status = 'available';
      let occupantSummary = null;

      if (occupant) {
        if (occupant.attended) {
          status = 'attended';
          attendedCount++;
        } else {
          status = 'assigned';
          assignedCount++;
        }
        occupantSummary = {
          id: occupant.id,
          name: occupant.name,
          organization: occupant.organization,
          phone: occupant.phone,
          attended: occupant.attended,
          attendedCount: occupant.attendedCount || 0
        };
      } else {
        availableCount++;
      }

      seats.push({
        id: s.id,
        row: row.label || row.id,
        num: s.num,
        tier: row.tier === 'balcony' ? 'balcony' : 'stalls',
        tierLabel: row.tier === 'balcony' ? 'Balcony' : 'Grand Stalls',
        zone: s.zone || row.zone || 'Standard',
        category: s.category || row.category || 'standard',
        status,
        occupant: occupantSummary
      });
    }
  }

  return {
    seats,
    summary: {
      total: seats.length,
      available: availableCount,
      assigned: assignedCount,
      attended: attendedCount
    }
  };
}

module.exports = {
  getScreeningSeatsMap,
  checkSeatAvailability,
  assignSeat,
  assignSeatsBulk,
  moveSeat,
  movePartialSeats,
  releaseSeat,
  findAlternativeSeats,
  findGroupRecommendations,
  getAllSeatsStatus
};
