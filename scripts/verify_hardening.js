/**
 * Automated Verification: Production Hardening & Reliability Suite
 */
const http = require('http');
const assert = require('assert');
const { readData, writeData } = require('../services/dataService');
const snapshotService = require('../services/snapshotService');
const seatService = require('../services/seatService');

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runHardeningTests() {
  console.log('================================================================');
  console.log('  SENIOR FULL-STACK VERIFICATION: PRODUCTION HARDENING SUITE    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    return fn()
      .then(() => {
        passed++;
        console.log(`[PASS] Test ${total}: ${name}`);
      })
      .catch(err => {
        console.error(`[FAIL] Test ${total}: ${name}`);
        console.error(`       Error: ${err.message}`);
      });
  }

  // Find a valid active screeningId
  const screeningsRes = await request('GET', '/api/screenings');
  assert(screeningsRes.status === 200, 'GET /api/screenings failed');
  const screeningId = screeningsRes.body.data[0].id;
  console.log(`Testing with Active Screening: ${screeningId}\n`);

  // --- Suite 1: In-Memory Mutex & Atomic File Writes ---
  console.log('--- Suite 1: In-Memory Mutex & Atomic Concurrency ---');
  await test('Concurrent writeData operations serialize cleanly without corruption', async () => {
    const filename = 'test_concurrency.json';
    const writePromises = [];
    for (let i = 1; i <= 10; i++) {
      writePromises.push(writeData(filename, { iteration: i, timestamp: Date.now() }));
    }
    await Promise.all(writePromises);
    const finalData = await readData(filename);
    assert(finalData && typeof finalData.iteration === 'number', 'Final data must be valid JSON');
    const fs = require('fs').promises;
    const path = require('path');
    try { await fs.unlink(path.join(__dirname, '../data', filename)); } catch (_) {}
  });

  // --- Suite 2: Security & Path Traversal Rejection ---
  console.log('\n--- Suite 2: Security & Path Traversal Rejection ---');
  await test('Reject path traversal in restoreSnapshot with malformed snapshotId', async () => {
    const res = await request('POST', '/api/guests/restore-snapshot', {
      screeningId,
      snapshotId: '../../../../etc/passwd'
    });
    assert(res.status >= 400, `Expected 4xx or 500 rejection, got ${res.status}`);
  });

  // --- Suite 3: Layout Topology & Invalid Seat Rejection ---
  console.log('\n--- Suite 3: Layout Topology & Invalid Seat Detection ---');
  await test('isValidSeatId accurately validates seats in Siam Pavalai layout', async () => {
    assert(seatService.isValidSeatId('A1') === true, 'A1 should be valid');
    assert(seatService.isValidSeatId('AA1') === true, 'AA1 should be valid');
    assert(seatService.isValidSeatId('G15') === true, 'G15 should be valid');
    assert(seatService.isValidSeatId('Z999') === false, 'Z999 should be invalid');
    assert(seatService.isValidSeatId('NOT_A_SEAT') === false, 'NOT_A_SEAT should be invalid');
  });

  await test('Walk-in rejects non-existent seat ID with HTTP 400 INVALID_SEAT', async () => {
    const res = await request('POST', '/api/guests/walk-in', {
      screeningId,
      name: 'Test Nonexistent Seat',
      participant: 1,
      seats: ['Z999']
    });
    assert(res.status === 400, `Expected HTTP 400, got ${res.status}`);
    assert(res.body.code === 'INVALID_SEAT', `Expected INVALID_SEAT code, got ${res.body.code}`);
  });

  // --- Suite 4: Seat Range Expansion ---
  console.log('\n--- Suite 4: Seat Range Expansion ---');
  await test('expandSeatRanges correctly expands ranges like B16-B18, E10-12, AA1-4', async () => {
    const r1 = seatService.expandSeatRanges('B16-B18');
    assert.deepStrictEqual(r1, ['B16', 'B17', 'B18'], 'B16-B18 should expand to 3 seats');
    const r2 = seatService.expandSeatRanges('E10-12');
    assert.deepStrictEqual(r2, ['E10', 'E11', 'E12'], 'E10-12 should expand to 3 seats');
    const r3 = seatService.expandSeatRanges('AA1-AA3, AA5');
    assert.deepStrictEqual(r3, ['AA1', 'AA2', 'AA3', 'AA5'], 'Compound ranges should expand correctly');
  });

  // --- Suite 5: Batch Import Pre-validation Engine ---
  console.log('\n--- Suite 5: Batch Import Pre-validation Engine ---');
  await test('Import batch rejects internal duplicate seats with HTTP 409', async () => {
    const res = await request('POST', '/api/guests/import', {
      screeningId,
      replaceExisting: false,
      guests: [
        { name: 'Guest 1', seat: 'H1', participant: 1 },
        { name: 'Guest 2', seat: 'H1', participant: 1 }
      ]
    });
    assert(res.status === 409, `Expected HTTP 409, got ${res.status}`);
    assert(res.body.code === 'IMPORT_SEAT_VALIDATION_FAILED', `Expected IMPORT_SEAT_VALIDATION_FAILED, got ${res.body.code}`);
    assert(res.body.details.internalDuplicates.length > 0, 'Must report internal duplicates details');
  });

  await test('Import batch rejects invalid seat IDs with HTTP 409', async () => {
    const res = await request('POST', '/api/guests/import', {
      screeningId,
      replaceExisting: false,
      guests: [
        { name: 'Guest Bad Seat', seat: 'FAKE999', participant: 1 }
      ]
    });
    assert(res.status === 409, `Expected HTTP 409, got ${res.status}`);
    assert(res.body.details.invalidSeats.length > 0, 'Must report invalid seats details');
  });

  await test('Import batch rejects over-capacity requests with HTTP 400', async () => {
    const res = await request('POST', '/api/guests/import', {
      screeningId,
      replaceExisting: false,
      guests: [
        { name: 'Giant Delegation', participant: 2000 }
      ]
    });
    assert(res.status === 400, `Expected HTTP 400, got ${res.status}`);
    assert(res.body.code === 'CAPACITY_EXCEEDED', `Expected CAPACITY_EXCEEDED, got ${res.body.code}`);
  });

  await test('Import batch accepts large payload > 100KB without HTTP 413 (817+ items)', async () => {
    // 1. Create a dedicated test screening
    const scRes = await request('POST', '/api/screenings', {
      title: 'Large Batch Import Verification Screening',
      branchId: 'b-01',
      theater: 'Siam Pavalai Royal Grand Theatre',
      date: '2026-09-30',
      time: '19:00',
      capacity: 1164
    });
    assert(scRes.status === 201, `Failed to create test screening, got ${scRes.status}: ${JSON.stringify(scRes.body)}`);
    const tempScreeningId = scRes.body.data.id;

    // 2. Generate 817 guests (approx 250KB JSON payload)
    const largeGuestList = [];
    for (let i = 1; i <= 817; i++) {
      largeGuestList.push({
        name: `Guest Large Batch ${i} - Doraemon Test Media Org`,
        organization: `Independent Media & Creator Studio Channel ${i}`,
        phone: `081${String(i).padStart(7, '0')}`,
        participant: 1,
        seat: ''
      });
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify({ screeningId: tempScreeningId, guests: largeGuestList, replaceExisting: true }));
    assert(payloadBytes > 100000, `Payload must be > 100KB, was ${payloadBytes} bytes`);

    // 3. Send import request
    const res = await request('POST', '/api/guests/import', {
      screeningId: tempScreeningId,
      replaceExisting: true,
      guests: largeGuestList
    });

    // 4. Clean up test screening
    await request('DELETE', `/api/screenings/${tempScreeningId}`);

    assert(res.status !== 413, `Must NOT return HTTP 413 Payload Too Large, got ${res.status}`);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success === true, 'Import should be successful');
  });

  // --- Suite 6: Idempotent Check-in Verification ---
  console.log('\n--- Suite 6: Idempotent Check-in Verification ---');
  let testGuestId = null;
  await test('Create temporary guest for check-in verification', async () => {
    const res = await request('POST', '/api/guests', {
      screeningId,
      name: 'Idempotency Test Guest',
      organization: 'Testing Corp',
      phone: '0812345678',
      seat: 'X30',
      participant: 1,
      attended: false
    });
    assert(res.status === 201, `Failed to create guest: ${res.status}`);
    testGuestId = res.body.data.id;
  });

  await test('Check-in guest once -> status is true', async () => {
    const res = await request('POST', `/api/guests/${testGuestId}/check-in`, {
      attended: true,
      action: 'check_in'
    });
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    assert(res.body.data.attended === true, 'Guest must be attended');
    assert(res.body.data.attendedCount === 1, 'AttendedCount must be 1');
  });

  await test('Check-in guest second time -> status remains true (Idempotent, no toggle-off)', async () => {
    const res = await request('POST', `/api/guests/${testGuestId}/check-in`, {
      attended: true,
      action: 'check_in'
    });
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    assert(res.body.data.attended === true, 'Guest must STILL be attended (not toggled off)');
  });

  // Clean up
  await test('Clean up temporary test guest', async () => {
    if (testGuestId) {
      const res = await request('DELETE', `/api/guests/${testGuestId}`);
      assert(res.status === 200, 'Cleanup failed');
    }
  });

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED (${Math.round(passed / total * 100)}%)`);
  console.log('================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runHardeningTests().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
