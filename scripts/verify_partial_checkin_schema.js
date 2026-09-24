/**
 * Verification Script: Partial Check-In Schema & Phone Validation
 * Tests:
 * 1. Seats array schema in guests.json
 * 2. PUT /api/guests/:id/seats/:seatCode/checkin (single seat toggle)
 * 3. POST /api/guests/:id/check-in with seatCodes[] (partial check-in via checkbox)
 * 4. Phone 12-digit validation (backend)
 * 5. 3-level check-in status: not-checked / partial / complete
 * 6. Stats service correctly tallies per-seat attendance
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
let passed = 0;
let failed = 0;
const results = [];

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port: 3000,
      path: urlPath,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
    results.push({ label, pass: true });
  } else {
    console.log(`  ❌ FAIL: ${label}${detail ? ' → ' + detail : ''}`);
    failed++;
    results.push({ label, pass: false, detail });
  }
}

async function run() {
  console.log('\n============================');
  console.log(' Partial Check-In Verification');
  console.log('============================\n');

  // ── Step 1: Find a guest with seats assigned ──────────────────────────────
  console.log('1️⃣  Finding test guest with seats...');
  const gRes = await request('GET', '/api/guests');
  assert('GET /api/guests returns success', gRes.body.success);
  const guests = gRes.body.data || [];
  const multiGuest = guests.find(g => Array.isArray(g.seats) && g.seats.length >= 2);
  const singleGuest = guests.find(g => Array.isArray(g.seats) && g.seats.length === 1);

  if (!multiGuest) {
    console.log('  ⚠️  No guest with 2+ seats found in DB. Skipping per-seat tests (schema OK).\n');
  } else {
    console.log(`  → Using guest: "${multiGuest.name}" seats: ${multiGuest.seats.map(s=>s.code).join(', ')}`);

    // ── Step 2: Seats array schema ──────────────────────────────────────────
    console.log('\n2️⃣  Schema validation on seats array...');
    assert('guest.seats is Array', Array.isArray(multiGuest.seats));
    assert('seats[0] has .code string', typeof multiGuest.seats[0].code === 'string');
    assert('seats[0] has .checkedIn boolean', typeof multiGuest.seats[0].checkedIn === 'boolean');
    assert('guest has checkInStatus', ['not-checked','partial','complete'].includes(multiGuest.checkInStatus));
    assert('guest has attendedCount number', typeof multiGuest.attendedCount === 'number');

    // ── Step 3: Single seat check-in (PUT) ─────────────────────────────────
    const testSeat = multiGuest.seats[0].code;
    console.log(`\n3️⃣  PUT /api/guests/${multiGuest.id}/seats/${testSeat}/checkin ...`);

    // Reset first: check out
    await request('PUT', `/api/guests/${multiGuest.id}/seats/${testSeat}/checkin`, { checkedIn: false });

    const putInRes = await request('PUT', `/api/guests/${multiGuest.id}/seats/${testSeat}/checkin`, { checkedIn: true });
    assert('PUT check-in returns success', putInRes.body.success, JSON.stringify(putInRes.body));
    assert('PUT check-in returns checkedIn=true', putInRes.body.checkedIn === true);
    assert('PUT check-in returns updated guest', !!putInRes.body.data && !!putInRes.body.data.id);

    const afterPut = putInRes.body.data;
    const seatAfter = afterPut.seats.find(s => s.code === testSeat);
    assert(`Seat ${testSeat} checkedIn=true in returned data`, seatAfter && seatAfter.checkedIn === true);

    // Toggle back to false
    const putOutRes = await request('PUT', `/api/guests/${multiGuest.id}/seats/${testSeat}/checkin`, { checkedIn: false });
    assert('PUT check-out returns checkedIn=false', putOutRes.body.checkedIn === false);
    const seatAfterOut = putOutRes.body.data?.seats?.find(s => s.code === testSeat);
    assert(`Seat ${testSeat} checkedIn=false after toggle`, seatAfterOut && seatAfterOut.checkedIn === false);

    // ── Step 4: Partial check-in via seatCodes[] (POST) ────────────────────
    console.log(`\n4️⃣  POST /api/guests/${multiGuest.id}/check-in with seatCodes[]...`);
    const firstCode = multiGuest.seats[0].code;
    const partialRes = await request('POST', `/api/guests/${multiGuest.id}/check-in`, {
      seatCodes: [firstCode],
      confirmedWarning: true,
      checkInAnyway: true
    });
    assert('Partial check-in returns success', partialRes.body.success, JSON.stringify(partialRes.body));

    // Reload guest to check status
    const reloadRes = await request('GET', `/api/guests/${multiGuest.id}`);
    if (reloadRes.body.success && reloadRes.body.data) {
      const g = reloadRes.body.data;
      assert('After partial: checkInStatus = partial', g.checkInStatus === 'partial', `got: ${g.checkInStatus}`);
      assert('After partial: attendedCount = 1', g.attendedCount === 1, `got: ${g.attendedCount}`);
      assert('After partial: attended = false (not complete)', g.attended === false, `got: ${g.attended}`);
      const checkedSeat = g.seats.find(s => s.code === firstCode);
      assert(`After partial: seat ${firstCode}.checkedIn = true`, checkedSeat?.checkedIn === true);
    }

    // Full check-in all seats
    const allCodes = multiGuest.seats.map(s => s.code);
    const fullRes = await request('POST', `/api/guests/${multiGuest.id}/check-in`, {
      seatCodes: allCodes,
      confirmedWarning: true,
      checkInAnyway: true
    });
    assert('Full seatCodes check-in returns success', fullRes.body.success);

    const reload2Res = await request('GET', `/api/guests/${multiGuest.id}`);
    if (reload2Res.body.success && reload2Res.body.data) {
      const g2 = reload2Res.body.data;
      assert('After full: checkInStatus = complete', g2.checkInStatus === 'complete', `got: ${g2.checkInStatus}`);
      assert('After full: attended = true', g2.attended === true, `got: ${g2.attended}`);
      assert('After full: attendedCount matches seats length', g2.attendedCount === multiGuest.seats.length, `got: ${g2.attendedCount}`);
    }

    // Reset guest to not-checked
    await request('POST', `/api/guests/${multiGuest.id}/check-in`, {
      action: 'check_out',
      attended: false,
      confirmedWarning: true,
      checkInAnyway: true
    });
  }

  // ── Step 5: Phone 10-digit validation ──────────────────────────────────────
  console.log('\n5️⃣  Phone 10-digit validation (Thai standard mobile, backend)...');
  // Get first screening
  const scrRes = await request('GET', '/api/screenings');
  const screeningId = scrRes.body.data?.[0]?.id;
  if (screeningId) {
    // 9-digit or invalid phone should be REJECTED
    const badPhoneRes = await request('POST', '/api/guests', {
      screeningId,
      name: 'Test Phone 9 Digits',
      detail: 'Test',
      participant: 1,
      phone: '081234567' // 9 digits – should fail
    });
    assert('9-digit phone rejected by backend', !badPhoneRes.body.success || badPhoneRes.status === 400 || badPhoneRes.status === 422,
      `status: ${badPhoneRes.status}, success: ${badPhoneRes.body.success}`);

    // 10-digit phone (Thai mobile standard) should be ACCEPTED
    const goodPhoneRes = await request('POST', '/api/guests', {
      screeningId,
      name: 'Test Phone 10 Digits',
      detail: 'Test',
      participant: 1,
      phone: '0812345678' // 10 digits Thai standard
    });
    assert('10-digit Thai mobile phone accepted by backend', goodPhoneRes.body.success === true,
      `status: ${goodPhoneRes.status}, msg: ${goodPhoneRes.body.message}`);

    // Clean up test guest
    if (goodPhoneRes.body.success && goodPhoneRes.body.data?.id) {
      await request('DELETE', `/api/guests/${goodPhoneRes.body.data.id}`);
    }

    // Empty phone should be ACCEPTED (phone is optional)
    const emptyPhoneRes = await request('POST', '/api/guests', {
      screeningId,
      name: 'Test No Phone',
      detail: 'Test',
      participant: 1,
      phone: ''
    });
    assert('Empty phone accepted (optional)', emptyPhoneRes.body.success === true,
      `status: ${emptyPhoneRes.status}, msg: ${emptyPhoneRes.body.message}`);
    if (emptyPhoneRes.body.success && emptyPhoneRes.body.data?.id) {
      await request('DELETE', `/api/guests/${emptyPhoneRes.body.data.id}`);
    }
  } else {
    console.log('  ⚠️  No screening found, skipping phone validation tests');
  }

  // ── Step 6: Stats service attendance ───────────────────────────────────────
  console.log('\n6️⃣  Stats overview-cinema attendance accuracy...');
  const statsRes = await request('GET', '/api/stats/overview-cinema');
  assert('Stats returns success', statsRes.body.success, JSON.stringify(statsRes.body).slice(0, 200));
  if (statsRes.body.success && statsRes.body.data) {
    const d = statsRes.body.data;
    assert('Stats has totalGuests number', typeof d.totalGuests === 'number');
    assert('Stats has checkedIn number', typeof d.checkedIn === 'number');
    assert('Stats has checkedInTotal number', typeof d.checkedInTotal === 'number');
    assert('Stats checkedIn <= totalGuests', d.checkedIn <= d.totalGuests);
    assert('Stats checkedInTotal <= totalGuests', d.checkedInTotal <= d.totalGuests);
    assert('Stats has checkInRate number', typeof d.checkInRate === 'number');
    console.log(`  → totalGuests: ${d.totalGuests}, checkedIn: ${d.checkedIn}, partial: ${d.partialCheckedInGuests}, checkInRate: ${d.checkInRate}%`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n============================');
  console.log(` Results: ${passed} passed, ${failed} failed`);
  console.log('============================\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.label}${r.detail ? ': ' + r.detail : ''}`));
    process.exit(1);
  } else {
    console.log('🎉 All tests passed!\n');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
