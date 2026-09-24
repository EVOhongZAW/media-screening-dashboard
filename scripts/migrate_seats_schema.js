/**
 * Migration Script: Migrate guests.json schema to per-seat check-in model
 * 
 * Converts:
 *   seat: "E7, E8" / seats: ["E7", "E8"]
 * To:
 *   seats: [{ code: "E7", checkedIn: boolean }, { code: "E8", checkedIn: boolean }]
 * 
 * Preserves backward compatibility:
 *   seat: "E7, E8"
 *   attended: boolean (true only if complete)
 *   attendedCount: number
 *   attendedSeats: string[]
 *   checkInStatus: 'complete' | 'partial' | 'not-checked'
 * 
 * Usage:
 *   node scripts/migrate_seats_schema.js --dry-run
 *   node scripts/migrate_seats_schema.js --apply
 */

const fs = require('fs');
const path = require('path');

const GUESTS_PATH = path.join(__dirname, '..', 'data', 'guests.json');

function expandSeatRanges(seatStr) {
  if (!seatStr || typeof seatStr !== 'string') return [];
  const clean = seatStr.trim();
  if (!clean) return [];

  const tokens = clean.split(/[,;/+]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
  const result = [];

  for (const token of tokens) {
    const rangeMatch = token.match(/^([A-Z]{1,2})(\d+)\s*[-–]\s*([A-Z]{1,2})?(\d+)$/i);
    if (rangeMatch) {
      const row1 = rangeMatch[1].toUpperCase();
      const startNum = parseInt(rangeMatch[2], 10);
      const row2 = (rangeMatch[3] || row1).toUpperCase();
      const endNum = parseInt(rangeMatch[4], 10);

      if (row1 === row2 && !isNaN(startNum) && !isNaN(endNum)) {
        const step = startNum <= endNum ? 1 : -1;
        for (let n = startNum; startNum <= endNum ? n <= endNum : n >= endNum; n += step) {
          result.push(`${row1}${n}`);
        }
        continue;
      }
    }
    result.push(token);
  }

  return result;
}

function migrateGuest(guest) {
  const g = { ...guest };

  // 1. Extract seat codes
  let seatCodes = [];
  if (Array.isArray(g.seats) && g.seats.length > 0) {
    if (typeof g.seats[0] === 'object' && g.seats[0] !== null && 'code' in g.seats[0]) {
      // Already migrated structure
      seatCodes = g.seats.map(s => s.code.toUpperCase());
    } else {
      // Array of strings
      seatCodes = g.seats.map(s => String(s).trim().toUpperCase()).filter(Boolean);
    }
  } else if (g.seat && typeof g.seat === 'string') {
    seatCodes = expandSeatRanges(g.seat);
  }

  // 2. Build seats object array
  let newSeats = [];
  const attendedSeatsSet = new Set(
    (Array.isArray(g.attendedSeats) ? g.attendedSeats : []).map(s => String(s).trim().toUpperCase())
  );

  if (Array.isArray(g.seats) && g.seats.length > 0 && typeof g.seats[0] === 'object' && 'code' in g.seats[0]) {
    newSeats = g.seats.map(s => ({
      code: s.code.toUpperCase(),
      checkedIn: !!s.checkedIn
    }));
  } else if (seatCodes.length > 0) {
    newSeats = seatCodes.map(code => {
      let isChecked = false;
      if (attendedSeatsSet.size > 0) {
        isChecked = attendedSeatsSet.has(code);
      } else {
        isChecked = !!g.attended;
      }
      return {
        code,
        checkedIn: isChecked
      };
    });
  } else {
    newSeats = [];
  }

  // 3. Compute counts and status
  const checkedInCount = newSeats.filter(s => s.checkedIn).length;
  const participantQuota = parseInt(g.participant, 10) || (newSeats.length > 0 ? newSeats.length : 1);

  let checkInStatus = 'not-checked';
  let isFullyAttended = false;

  if (newSeats.length > 0) {
    if (checkedInCount === 0) {
      checkInStatus = 'not-checked';
      isFullyAttended = false;
    } else if (checkedInCount >= newSeats.length) {
      checkInStatus = 'complete';
      isFullyAttended = true;
    } else {
      checkInStatus = 'partial';
      isFullyAttended = false;
    }
  } else {
    const rawAttendedCount = g.attendedCount || (g.attended ? participantQuota : 0);
    if (rawAttendedCount === 0) {
      checkInStatus = 'not-checked';
      isFullyAttended = false;
    } else if (rawAttendedCount >= participantQuota) {
      checkInStatus = 'complete';
      isFullyAttended = true;
    } else {
      checkInStatus = 'partial';
      isFullyAttended = false;
    }
  }

  // 4. Update guest record
  g.seats = newSeats;
  g.seat = newSeats.length > 0 ? newSeats.map(s => s.code).join(', ') : (g.seat || null);
  g.attended = isFullyAttended;
  g.attendedCount = newSeats.length > 0 ? checkedInCount : (g.attendedCount || (isFullyAttended ? participantQuota : 0));
  g.attendedSeats = newSeats.filter(s => s.checkedIn).map(s => s.code);
  g.checkInStatus = checkInStatus;

  return g;
}

function runMigration() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isApply = args.includes('--apply');

  if (!isDryRun && !isApply) {
    console.error('Error: Please specify either --dry-run or --apply');
    console.log('Usage:');
    console.log('  node scripts/migrate_seats_schema.js --dry-run');
    console.log('  node scripts/migrate_seats_schema.js --apply');
    process.exit(1);
  }

  if (!fs.existsSync(GUESTS_PATH)) {
    console.error(`Error: guests.json not found at ${GUESTS_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(GUESTS_PATH, 'utf8');
  const originalGuests = JSON.parse(raw);

  console.log('===============================================================');
  console.log('       GUESTS SCHEMA MIGRATION: PER-SEAT CHECK-IN ENGINE       ');
  console.log('===============================================================');
  console.log(`Loaded ${originalGuests.length} records from data/guests.json`);

  const migratedGuests = originalGuests.map(migrateGuest);

  const stats = {
    total: migratedGuests.length,
    unassigned: migratedGuests.filter(g => g.seats.length === 0).length,
    singleSeat: migratedGuests.filter(g => g.seats.length === 1).length,
    multiSeat: migratedGuests.filter(g => g.seats.length > 1).length,
    notChecked: migratedGuests.filter(g => g.checkInStatus === 'not-checked').length,
    partial: migratedGuests.filter(g => g.checkInStatus === 'partial').length,
    complete: migratedGuests.filter(g => g.checkInStatus === 'complete').length
  };

  console.log('\n--- Migration Statistics ---');
  console.log(`Total Guests:         ${stats.total}`);
  console.log(`Unassigned Seats:     ${stats.unassigned}`);
  console.log(`Single Seat Guests:   ${stats.singleSeat}`);
  console.log(`Multi-Seat Guests:    ${stats.multiSeat}`);
  console.log(`Status Not-Checked:   ${stats.notChecked}`);
  console.log(`Status Partial:       ${stats.partial}`);
  console.log(`Status Complete:      ${stats.complete}`);

  console.log('\n--- Sample Transformed Records ---');
  const samples = migratedGuests.filter(g => g.seats.length > 0).slice(0, 3);
  samples.forEach((s, idx) => {
    console.log(`\n[Sample ${idx + 1}] ID: ${s.id} | Name: ${s.name}`);
    console.log(`  Seats Array:    ${JSON.stringify(s.seats)}`);
    console.log(`  Seat String:    "${s.seat}"`);
    console.log(`  Attended:       ${s.attended}`);
    console.log(`  AttendedCount:  ${s.attendedCount} / ${s.participant}`);
    console.log(`  CheckInStatus:  "${s.checkInStatus}"`);
  });

  if (isDryRun) {
    console.log('\n===============================================================');
    console.log('DRY-RUN COMPLETE: No files were modified.');
    console.log('To apply changes and create an automatic backup, run with --apply');
    console.log('===============================================================');
    return;
  }

  if (isApply) {
    // 1. Create Timestamped Backup
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, '..', 'data', `guests.backup.${timestamp}.json`);

    fs.writeFileSync(backupPath, raw, 'utf8');
    console.log(`\n[SAFETY BACKUP CREATED] Saved copy to: ${backupPath}`);

    // Verify backup
    const backupRaw = fs.readFileSync(backupPath, 'utf8');
    if (backupRaw.length !== raw.length) {
      throw new Error('Backup integrity check failed: file sizes do not match!');
    }

    // 2. Write Migrated Data Atomically
    const tempPath = path.join(__dirname, '..', 'data', `guests.tmp.${Date.now()}.json`);
    fs.writeFileSync(tempPath, JSON.stringify(migratedGuests, null, 2), 'utf8');
    fs.renameSync(tempPath, GUESTS_PATH);

    console.log(`[MIGRATION APPLIED] data/guests.json successfully updated with ${migratedGuests.length} records.`);
    console.log('===============================================================');
  }
}

if (require.main === module) {
  runMigration();
}

module.exports = { migrateGuest, expandSeatRanges };
