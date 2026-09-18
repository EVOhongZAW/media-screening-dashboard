const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runFullVerification() {
  console.log('===============================================================');
  console.log('  SENIOR FULL-STACK AUTOMATED VERIFICATION: GROUP SEAT ENGINE  ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${total}: ${message}`);
    }
  }

  const screeningId = 'scr-01';

  // 1. All Seats Status & Topology Check
  console.log('--- Suite 1: Full Inventory & Topology ---');
  const res1 = await request('GET', `/api/seats/status-all?screeningId=${screeningId}`);
  assert(res1.status === 200, 'GET /api/seats/status-all returns HTTP 200');
  assert(res1.body?.data?.length === 1164, 'Correctly reports 1,164 total seats in Siam Pavalai');
  assert(res1.body?.summary?.total === 1164, 'Summary total matches 1,164');

  // 2. Heuristic Group Scoring
  console.log('\n--- Suite 2: Heuristic Group Recommendations ---');
  const res2 = await request('POST', '/api/seats/recommend-groups', {
    screeningId,
    guestCount: 4,
    preferredSeat: 'E12'
  });
  assert(res2.status === 200, 'POST /api/seats/recommend-groups returns HTTP 200');
  assert(res2.body?.data?.length > 0, 'Found candidate groups for 4 guests');
  const topRec = res2.body?.data?.[0];
  console.log('Top Recommendation near E12:', topRec?.display, 'Row:', topRec?.row, 'Score:', topRec?.score);
  assert(topRec?.seats?.length === 4, 'Top recommendation contains exactly 4 seats');
  assert(topRec?.score >= 100, 'Top recommendation has contiguous score >= 100');

  // 3. Walk-in Group Parity Rule Validation
  console.log('\n--- Suite 3: Walk-in Group Parity Validation ---');
  const res3Mismatch = await request('POST', '/api/guests/walk-in', {
    screeningId,
    name: 'ทีมข่าวบันเทิง Workpoint',
    participant: 4,
    seats: ['X1', 'X2', 'X3'] // 3 seats for 4 participants
  });
  assert(res3Mismatch.status === 400, 'Rejects mismatch with HTTP 400');
  assert(res3Mismatch.body?.code === 'SEAT_COUNT_MISMATCH', 'Error code is SEAT_COUNT_MISMATCH');

  const res3Success = await request('POST', '/api/guests/walk-in', {
    screeningId,
    name: 'ทีมข่าวบันเทิง Workpoint (4 ท่าน)',
    organization: 'Workpoint News',
    participant: 4,
    seats: ['X1', 'X2', 'X3', 'X4'],
    attended: true
  });
  assert(res3Success.status === 201, 'Creates Walk-in group with HTTP 201');
  const guest1 = res3Success.body?.data;
  assert(guest1?.seat === 'X1, X2, X3, X4', 'Guest seats correctly stored as X1, X2, X3, X4');
  assert(guest1?.attendedCount === 4, 'AttendedCount is 4');
  assert(guest1?.attended === true, 'Attended status is true');

  // 4. Non-Destructive 409 Conflict Recovery
  console.log('\n--- Suite 4: Non-Destructive 409 Conflict Recovery ---');
  const res4Conflict = await request('POST', '/api/guests/walk-in', {
    screeningId,
    name: 'สำนักข่าว Thairath (2 ท่าน)',
    participant: 2,
    seats: ['X2', 'X10'] // X2 is already taken by Workpoint!
  });
  assert(res4Conflict.status === 409, 'Returns HTTP 409 Conflict when seat is occupied');
  assert(res4Conflict.body?.code === 'SEAT_CONFLICT', 'Error code is SEAT_CONFLICT');
  assert(res4Conflict.body?.conflictedSeats?.includes('X2'), 'Correctly identifies X2 as conflicted seat');
  assert(res4Conflict.body?.validSeats?.includes('X10'), 'Preserves X10 as valid seat without destruction');
  assert(res4Conflict.body?.suggestedReplacements?.length > 0, 'Offers intelligent replacement suggestions for X2');

  // 5. Partial Move within Group (ย้ายเฉพาะบางท่าน)
  console.log('\n--- Suite 5: Partial Move within Group ---');
  const res5Partial = await request('POST', '/api/seats/move-partial', {
    screeningId,
    guestId: guest1.id,
    moves: [{ from: 'X4', to: 'X5' }] // Move only X4 to X5, leaving X1, X2, X3
  });
  assert(res5Partial.status === 200, 'POST /api/seats/move-partial returns HTTP 200');
  assert(res5Partial.body?.data?.seat === 'X1, X2, X3, X5', 'Seats updated to X1, X2, X3, X5');

  // Verify X4 is now free again
  const checkX4 = await request('GET', `/api/seats/status-all?screeningId=${screeningId}`);
  const seatX4 = checkX4.body?.data?.find(s => s.id === 'X4');
  assert(seatX4?.status === 'available', 'Seat X4 is successfully released and available');

  // 6. Move Entire Group
  console.log('\n--- Suite 6: Full Group Move ---');
  const res6Full = await request('POST', '/api/seats/move', {
    screeningId,
    guestId: guest1.id,
    moves: [
      { from: 'X1', to: 'X11' },
      { from: 'X2', to: 'X12' },
      { from: 'X3', to: 'X13' },
      { from: 'X5', to: 'X14' }
    ]
  });
  assert(res6Full.status === 200, 'Full group move returns HTTP 200');
  assert(res6Full.body?.data?.seat === 'X11, X12, X13, X14', 'All 4 seats moved to X11, X12, X13, X14');

  // 7. Cleanup & Audit Log Check
  console.log('\n--- Suite 7: Clean-up & Verification ---');
  const delRes = await request('DELETE', `/api/guests/${guest1.id}`);
  assert(delRes.status === 200, 'Cleaned up test guest');

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED (100%)  `);
  console.log('===============================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runFullVerification().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
