const fs = require('fs');
const path = require('path');
const http = require('http');

async function run() {
  console.log('===============================================================');
  console.log('  TEST SUITE: SMART CSV IMPORT & GUEST LIST ENHANCEMENTS       ');
  console.log('===============================================================');

  // 1. Verify seatService autoAssignUnseatedGuests
  const seatService = require('../services/seatService');
  const dataService = require('../services/dataService');

  console.log('\n--- 1. Auto-Assign Unseated Guests Engine ---');
  const screenings = await dataService.readData('screenings.json');
  const screeningId = screenings[0].id;

  const result = await seatService.autoAssignUnseatedGuests(screeningId);
  console.log(`[PASS] autoAssignUnseatedGuests executed: success=${result.success}, assignedCount=${result.assignedCount}, totalSeats=${result.totalSeats}`);

  // 2. Test autoAssign with specific guestIds
  const guests = await dataService.readData('guests.json');
  const testGuest = guests.find(g => g.screeningId === screeningId);
  if (testGuest) {
    const singleResult = await seatService.autoAssignUnseatedGuests(screeningId, [testGuest.id]);
    console.log(`[PASS] autoAssignUnseatedGuests with guestIds filter executed cleanly: success=${singleResult.success}`);
  }

  // 3. Test HTTP endpoint POST /api/seats/auto-assign
  console.log('\n--- 2. HTTP Endpoint POST /api/seats/auto-assign ---');
  const reqData = JSON.stringify({ screeningId });
  const postOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/seats/auto-assign',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqData)
    }
  };

  await new Promise((resolve, reject) => {
    const req = http.request(postOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          const json = JSON.parse(body);
          console.log(`[PASS] POST /api/seats/auto-assign returned HTTP 200: success=${json.success}`);
          resolve();
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.write(reqData);
    req.end();
  });

  // 4. Verify Frontend Elements in index.html & style.css
  console.log('\n--- 3. UI Template & Styles ---');
  const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

  const htmlChecks = [
    { id: 'btnAutoAssignSeats', desc: 'Auto Assign button' },
    { id: 'guestStatTabs', desc: 'Quick Filter Tabs' },
    { id: 'tabCountAll', desc: 'Badge count All' },
    { id: 'tabCountUnassigned', desc: 'Badge count Unassigned' },
    { id: 'guestPaginationBar', desc: 'Guest pagination bar' },
    { id: 'paginationInfo', desc: 'Pagination info' },
    { id: 'paginationControls', desc: 'Pagination controls' },
    { id: 'guestPageSizeSelect', desc: 'Guest page size dropdown' },
    { id: 'chkImportConfirmedOnly', desc: 'Import confirmed only checkbox' }
  ];

  for (const check of htmlChecks) {
    if (html.includes(check.id)) {
      console.log(`[PASS] HTML contains ${check.desc} (#${check.id})`);
    } else {
      throw new Error(`Missing #${check.id} in index.html`);
    }
  }

  const cssChecks = [
    { name: '.guest-stat-tabs', desc: 'Guest stat tabs container' },
    { name: '.guest-tab-chip', desc: 'Guest tab chip' },
    { name: '.guest-name-cell', desc: 'Guest name cell' },
    { name: '.guest-detail-chip', desc: 'Guest detail chip' },
    { name: '.btn-table-assign', desc: 'Table assign quick button' },
    { name: '.btn-auto-assign', desc: 'Auto-assign button gradient' },
    { name: '.guest-pagination-bar', desc: 'Pagination bar' },
    { name: '.pagination-btn', desc: 'Pagination button' },
    { name: '.pagination-dots', desc: 'Pagination dots' },
    { name: '.import-summary-bar', desc: 'Import summary bar' }
  ];

  for (const check of cssChecks) {
    if (css.includes(check.name)) {
      console.log(`[PASS] CSS contains ${check.desc} (${check.name})`);
    } else {
      throw new Error(`Missing ${check.name} in style.css`);
    }
  }

  const jsChecks = [
    { name: 'renderGuestPagination', desc: 'Pagination rendering function' },
    { name: 'quickAssignGuest', desc: '1-click quick assign helper' },
    { name: 'parseCsvOrTsv', desc: 'Smart CSV/TSV parser' },
    { name: 'chkImportConfirmedOnly', desc: 'Import confirmed-only toggle handler' }
  ];

  for (const check of jsChecks) {
    if (appJs.includes(check.name)) {
      console.log(`[PASS] JS contains ${check.desc} (${check.name})`);
    } else {
      throw new Error(`Missing ${check.name} in app.js`);
    }
  }

  // 5. Verify Name is Name and Detail is Detail in Parser
  console.log('\n--- 4. Strict Column Preservation (Name = Name, Detail = Detail) ---');
  // Mock window and document if needed, or extract parseCsvOrTsv from app.js
  const appJsCode = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
  const startIdx = appJsCode.indexOf('function parseCsvOrTsv(rawText) {');
  const endIdx = appJsCode.indexOf('\nlet currentParsedGuests = [];');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Could not extract parseCsvOrTsv from app.js');
  }
  const parseFuncCode = appJsCode.substring(startIdx, endIdx);
  const parseCsvOrTsv = new Function('rawText', `
    function expandSeatRanges(s) { return s; }
    ${parseFuncCode}
    return parseCsvOrTsv(rawText);
  `);

  // Test Case A: Name, Detail, จำนวน (Format from user screenshot)
  const csvA = `Name,Detail,จำนวน
โกดังหนัง,"• ชื่อสื่อ / เพจ โกดังหนัง
• ชื่อผู้รับบัตร คุณเอ็ม
• จำนวนผู้เข้าชม (โควต้า 2 ใบ) 2 ท่านค่า",2
ผู้ชายคนนั้นจากหนังเรื่องนี้,"ชื่อสื่อ / เพจ. ผู้ชายคนนั้นจากหนังเรื่องนี้
• ชื่อผู้รับบัตร. ฐิติมน มงคลสวัสดิ์
• จำนวนผู้เข้าชม 2 คน ค่ะ",2`;

  const parsedA = parseCsvOrTsv(csvA);
  if (parsedA[0].name !== 'โกดังหนัง') {
    throw new Error(`Expected name to be "โกดังหนัง", but got "${parsedA[0].name}"`);
  }
  if (!parsedA[0].detail.includes('ชื่อสื่อ / เพจ โกดังหนัง')) {
    throw new Error(`Expected detail to contain original detail text, but got "${parsedA[0].detail}"`);
  }
  if (parsedA[0].participant !== 2) {
    throw new Error(`Expected participant to be 2, but got ${parsedA[0].participant}`);
  }
  console.log(`[PASS] Format A (Name, Detail, จำนวน): Name is "${parsedA[0].name}", Detail has original text, Participant is ${parsedA[0].participant}`);

  // Test Case B: Name, จำนวน, Detail (Format from gala doraemon export)
  const csvB = `Name,จำนวน,Detail
We Love Movie Club,2,"เพจ Facebook : we love movie club
ชื่อ - นามสกุล :: อวัชพงษ์ คงสิริปัญญากุล (โอ)
เบอร์โทรศัพท์ : 0875054441"`;

  const parsedB = parseCsvOrTsv(csvB);
  if (parsedB[0].name !== 'We Love Movie Club') {
    throw new Error(`Expected name to be "We Love Movie Club", but got "${parsedB[0].name}"`);
  }
  if (!parsedB[0].detail.includes('we love movie club')) {
    throw new Error(`Expected detail to contain detail text, but got "${parsedB[0].detail}"`);
  }
  if (parsedB[0].phone !== '0875054441') {
    throw new Error(`Expected phone to be extracted as 0875054441, but got "${parsedB[0].phone}"`);
  }
  if (parsedB[0].participant !== 2) {
    throw new Error(`Expected participant to be 2, but got ${parsedB[0].participant}`);
  }
  console.log(`[PASS] Format B (Name, จำนวน, Detail): Name is "${parsedB[0].name}", Detail has text, Phone is "${parsedB[0].phone}", Participant is ${parsedB[0].participant}`);

  console.log('\n===============================================================');
  console.log('  ALL TESTS PASSED SUCCESSFULLY!                               ');
  console.log('===============================================================');
}

run().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
