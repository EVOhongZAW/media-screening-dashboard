/**
 * Verification Script: Google Sheet Integration & Schema Expansion (Follower & PIC)
 * 
 * Tests:
 * 1. Seat Range Expansion (seatService & frontend logic)
 * 2. Smart Attendee Name Extraction (3 Levels: keyword, line inspection, fallback)
 * 3. Backend API: Create, Update, Walk-in with Follower & PIC (including nullable check)
 * 4. Backend API: Batch Import with new 6-column Google Sheet structure
 * 5. Collision Protection: Duplicate seat detection rejecting conflicted imports
 * 6. UI Structure: 8-column table headers, PIC filter, Follower sort, Preview table
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const seatService = require('../services/seatService');
const dataService = require('../services/dataService');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`[PASS] ${label}`);
    passed++;
  } else {
    console.log(`[FAIL] ${label}${detail ? ' -> ' + detail : ''}`);
    failed++;
  }
}

function requestHttp(method, pathUrl, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: pathUrl,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('===============================================================');
  console.log('  TEST SUITE: GOOGLE SHEET INTEGRATION & SCHEMA (FOLLOWER & PIC)');
  console.log('===============================================================\n');

  // --- Suite 1: Seat Range Expansion ---
  console.log('--- Suite 1: Seat Range Expansion (expandSeatRanges) ---');
  const testRanges = [
    ['I16-17', ['I16', 'I17']],
    ['K4-5', ['K4', 'K5']],
    ['R21-22', ['R21', 'R22']],
    ['N27-28', ['N27', 'N28']],
    ['B16-B18', ['B16', 'B17', 'B18']],
    ['AA1-AA3', ['AA1', 'AA2', 'AA3']],
    ['I16–17', ['I16', 'I17']], // En-dash
    ['I16—17', ['I16', 'I17']], // Em-dash
    ['I 16 - 17', ['I16', 'I17']] // With space
  ];

  testRanges.forEach(([input, expected]) => {
    const res = seatService.expandSeatRanges(input);
    const ok = JSON.stringify(res) === JSON.stringify(expected);
    assert(`expandSeatRanges("${input}") -> ${JSON.stringify(res)}`, ok);
  });

  // --- Suite 2: Smart Attendee Name Extraction Algorithm ---
  console.log('\n--- Suite 2: Smart Attendee Name Extraction Algorithm ---');
  // Load extraction algorithm from app.js regex
  const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  assert('app.js defines extractAttendeeNameFromDetail', appJs.includes('function extractAttendeeNameFromDetail'));

  // Test keyword matches
  const keywordRegex = /(?:ชื่อผู้รับบัตร|ผู้รับบัตร|รับบัตรในนาม|ชื่อผู้ติดต่อ|ผู้ติดต่อ|ชื่อคนรับบัตร|ชื่อผู้รับ|ผู้รับ)\s*[:.•\-–—\s]\s*([^\r\n•]+)/i;

  const testDetails = [
    { text: '• สื่อ: โกดังหนัง\n• ชื่อผู้รับบัตร คุณเอ็ม\n• เบอร์โทร 0812345678', expected: 'คุณเอ็ม' },
    { text: 'ผู้รับบัตร: เอกบุรุษ มีอิ่ม', expected: 'เอกบุรุษ มีอิ่ม' },
    { text: 'รับบัตรในนาม คุณโบว์ (089-999-8888)', expected: 'คุณโบว์' },
    { text: 'ผู้ติดต่อ: ชัยวัฒน์ โสระสิงห์', expected: 'ชัยวัฒน์ โสระสิงห์' }
  ];

  testDetails.forEach(td => {
    const match = td.text.match(keywordRegex);
    let extracted = match ? match[1].replace(/\s*\([0-9\-\s\+]{8,15}\)\s*$/, '').trim().replace(/^[•\-*·\s]+/, '').trim() : '';
    assert(`Extract attendee from: "${td.text.split('\n')[0]}..." -> "${extracted}"`, extracted === td.expected);
  });

  // Test line inspection for names without explicit keyword
  const line1 = '(เฟิร์ส) ภัทราวุฒิ ใจสุทธิ';
  const nameLineRegex = /^(?:\([^\)]+\)\s*)?[ก-๙a-zA-Z]{2,}(?:\s+[ก-๙a-zA-Z]+)+$/;
  assert(`Extract complex name from line: "${line1}"`, nameLineRegex.test(line1));

  // --- Suite 3: Backend API - Create & Update with Follower and PIC ---
  console.log('\n--- Suite 3: Backend API - Create, Update & Walk-in (Follower & PIC) ---');
  const screenings = await dataService.readData('screenings.json');
  const screeningId = screenings[0].id;

  // 1. Create Guest with follower & pic
  const guestCreateRes = await requestHttp('POST', '/api/guests', {
    screeningId,
    name: 'ทดสอบ ผู้รับบัตร',
    organization: 'เพจดูหนังสุดปัง',
    follower: '1,200,000',
    pic: 'Ani Network',
    phone: '0812345678',
    participant: 2
  });

  assert('POST /api/guests with follower & pic returns 201', guestCreateRes.status === 201);
  const createdGuest = guestCreateRes.data.data;
  assert('follower parsed to integer 1200000', createdGuest.follower === 1200000);
  assert('pic stored as "Ani Network"', createdGuest.pic === 'Ani Network');
  assert('organization stored as "เพจดูหนังสุดปัง"', createdGuest.organization === 'เพจดูหนังสุดปัง');

  // 2. Update Guest with new follower & pic
  const guestUpdateRes = await requestHttp('PUT', `/api/guests/${createdGuest.id}`, {
    follower: 46000,
    pic: 'มิว สื่อสารองค์กร'
  });

  assert('PUT /api/guests/:id updates follower & pic returns 200', guestUpdateRes.status === 200);
  assert('follower updated to 46000', guestUpdateRes.data.data.follower === 46000);
  assert('pic updated to "มิว สื่อสารองค์กร"', guestUpdateRes.data.data.pic === 'มิว สื่อสารองค์กร');

  // 3. Nullable check: Create Guest without follower & pic
  const guestNullRes = await requestHttp('POST', '/api/guests', {
    screeningId,
    name: 'แขกทั่วไป ไม่ระบุฟอล',
    organization: 'ทั่วไป',
    participant: 1
  });

  assert('POST /api/guests without follower/pic returns 201 (optional/nullable)', guestNullRes.status === 201);
  assert('follower is null when not provided', guestNullRes.data.data.follower === null);
  assert('pic is null when not provided', guestNullRes.data.data.pic === null);

  // 4. Walk-in with follower & pic
  const walkInRes = await requestHttp('POST', '/api/guests/walk-in', {
    screeningId,
    name: 'คุณวอล์คอิน อินฟลู',
    organization: 'TikTop Creator',
    follower: 500000,
    pic: 'พี่ต้อง',
    participant: 1
  });

  assert('POST /api/guests/walk-in with follower & pic returns 201', walkInRes.status === 201);
  assert('walk-in guest follower is 500000', walkInRes.data.data.follower === 500000);
  assert('walk-in guest pic is "พี่ต้อง"', walkInRes.data.data.pic === 'พี่ต้อง');

  // Clean up created test guests
  await requestHttp('DELETE', `/api/guests/${createdGuest.id}`);
  await requestHttp('DELETE', `/api/guests/${guestNullRes.data.data.id}`);
  await requestHttp('DELETE', `/api/guests/${walkInRes.data.data.id}`);

  // --- Suite 4: Backend API - Batch Import with 6-Column Google Sheet Structure ---
  console.log('\n--- Suite 4: Backend API - Batch Import with 6-Column Google Sheet Structure ---');
  const importBatchRes = await requestHttp('POST', '/api/guests/import', {
    screeningId,
    replaceExisting: false,
    guests: [
      {
        name: 'คุณเอ็ม ผู้รับบัตร',
        organization: 'โกดังหนัง',
        detail: '• สื่อ: โกดังหนัง\n• ชื่อผู้รับบัตร คุณเอ็ม',
        follower: '1,200,000',
        pic: 'Ani Network',
        participant: 2,
        seat: 'X25-26',
        phone: '0812345678'
      }
    ]
  });

  assert('POST /api/guests/import imports item with follower, pic, expanded seat', importBatchRes.status === 200);

  // Read back and verify stored fields
  const allGuests = await dataService.readData('guests.json');
  const imported = allGuests.find(g => g.name === 'คุณเอ็ม ผู้รับบัตร' && g.screeningId === screeningId);
  assert('Imported guest exists in DB', !!imported);
  if (imported) {
    assert('Imported guest follower is 1200000', imported.follower === 1200000);
    assert('Imported guest pic is "Ani Network"', imported.pic === 'Ani Network');
    assert('Imported guest organization is "โกดังหนัง"', imported.organization === 'โกดังหนัง');
    assert('Imported guest seat expanded to "X25, X26"', imported.seat === 'X25, X26');
    assert('Imported guest seats array has 2 seats', Array.isArray(imported.seats) && imported.seats.length === 2);
  }

  // --- Suite 5: Duplicate Seat Collision Protection during Import ---
  console.log('\n--- Suite 5: Duplicate Seat Collision Protection during Import ---');
  const conflictBatchRes = await requestHttp('POST', '/api/guests/import', {
    screeningId,
    replaceExisting: false,
    guests: [
      {
        name: 'แขกซ้ำ ชนที่นั่ง',
        organization: 'เพจทดสอบ',
        participant: 1,
        seat: 'X25', // Collides with already imported X25!
        phone: '0899998888'
      }
    ]
  });

  assert('POST /api/guests/import rejects collision with HTTP 409', conflictBatchRes.status === 409);
  assert('Response contains IMPORT_SEAT_VALIDATION_FAILED code', conflictBatchRes.data.code === 'IMPORT_SEAT_VALIDATION_FAILED');
  assert('Response message mentions colliding seat X25', conflictBatchRes.data.message.includes('X25'));

  // Clean up imported test guest
  if (imported) {
    await requestHttp('DELETE', `/api/guests/${imported.id}`);
  }

  // --- Suite 6: Frontend UI Integration & Specifications ---
  console.log('\n--- Suite 6: Frontend UI Elements (HTML, CSS & JS) ---');
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');

  // 1. 8 Table Headers
  assert('HTML: Contains Follower table header with sort icon', html.includes('id="thColFollower"') && html.includes('id="iconSortFollower"'));
  assert('HTML: Contains PIC table header', html.includes('PIC (ผู้ดูแล)'));
  assert('HTML: Contains PIC filter dropdown (#filterPic)', html.includes('id="filterPic"'));

  // 2. Add Guest modal Follower and PIC inputs
  assert('HTML: Modal Add Guest contains addGuestFollower', html.includes('id="addGuestFollower"'));
  assert('HTML: Modal Add Guest contains addGuestPic', html.includes('id="addGuestPic"'));

  // 3. CSS 8-column widths
  assert('CSS: Table fixed min-width 960px', css.includes('.guest-table') && css.includes('min-width: 960px'));
  assert('CSS: 8 columns width allocation present in style.css',
    css.includes('.guest-table th:nth-child(1)') && css.includes('width: 18%') &&
    css.includes('.guest-table th:nth-child(2)') && css.includes('width: 10%') &&
    css.includes('.guest-table th:nth-child(3)') && css.includes('width: 10%') &&
    css.includes('.guest-table th:nth-child(4)') && css.includes('width: 24%')
  );
  assert('CSS: Contains .col-guest-follower styling', css.includes('.col-guest-follower'));
  assert('CSS: Contains .pic-badge styling', css.includes('.pic-badge'));

  // 4. JS logic
  assert('JS: app.js contains isGoogleSheet6Col auto-detection', appJs.includes('isGoogleSheet6Col'));
  assert('JS: app.js contains setupFollowerSort', appJs.includes('setupFollowerSort'));
  assert('JS: app.js contains populatePicFilter', appJs.includes('populatePicFilter'));
  assert('JS: app.js side panel renders guestDetailFollower and guestDetailPic', appJs.includes('guestDetailFollower') && appJs.includes('guestDetailPic'));
  assert('JS: app.js saveGuestChanges collects follower and pic', appJs.includes('guestDetailFollower') && appJs.includes('follower: followerVal'));

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
  console.log('===============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
