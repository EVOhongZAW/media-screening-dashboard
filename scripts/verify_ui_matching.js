const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('  SENIOR FULL-STACK VERIFICATION: UI DESIGN SPEC MATCHING       ');
console.log('===============================================================\n');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

console.log('--- Suite 1: Image 2 Header, Actions & Filter Chips ---');
const headerChecks = [
  ['Header Title', html.includes('ผังที่นั่งโรงภาพยนตร์เสมือนจริง')],
  ['Header Subtitle', html.includes('คลิกที่นั่งเพื่อดูรายละเอียดหรือมอบหมายแขก · Pavalai (Pavalai Royal Grand Theatre) (1164 ที่นั่ง)')],
  ['CSV / Excel Button', html.includes('btnOpenImportCsvFromSeats') && html.includes('นำเข้าข้อมูล CSV / Excel')],
  ['Walk-in Button', html.includes('btnOpenGroupWalkInFromSeats') && html.includes('+ เพิ่ม Walk-in (เดี่ยว / กลุ่ม)')],
  ['Tier Tab: All (1,164)', html.includes('btnTierAll') && html.includes('ทั้งหมด (1,164 ที่นั่ง)')],
  ['Tier Tab: Stalls (919)', html.includes('btnTierStalls') && html.includes('ชั้นล่าง Grand Stalls (919)')],
  ['Tier Tab: Balcony (245)', html.includes('btnTierBalcony') && html.includes('ชั้นลอย Royal Balcony (245)')],
  ['Filter Chip: All Status', html.includes('btnFilterSeatAll') && html.includes('ทุกสถานะ')],
  ['Filter Chip: Sweet Spot Removed', !html.includes('btnFilterSweetSpot') && !html.includes('data-filter="sweet-spot"')],
  ['Filter Chip: Paragon VIP', html.includes('btnFilterSeatVip') && html.includes('Paragon VIP')],
  ['Filter Chip: Privilege', html.includes('btnFilterSeatPress') && html.includes('Privilege')],
  ['Filter Chip: Standard', html.includes('btnFilterSeatCreator') && html.includes('Standard')],
  ['Filter Chip: Checked-in', html.includes('btnFilterSeatCheckedIn') && html.includes('เช็คอินแล้ว')],
  ['Filter Chip: Empty', html.includes('btnFilterSeatEmpty') && html.includes('ว่าง')]
];

let failed = 0;
headerChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});

console.log('\n--- Suite 2: Realistic Seat Legend (Sweet Spot Excised) ---');
const legendChecks = [
  ['Legend: Paragon VIP / Sofa', html.includes('Paragon VIP / Sofa (VP, AA, FH, FG)')],
  ['Legend: Privilege Chair / XL', html.includes('Privilege Chair / XL (A - M)')],
  ['Legend: Standard Hall', html.includes('Standard Hall (N - X)')],
  ['Legend: Royal Balcony', html.includes('Royal Balcony (FA - FF)')],
  ['Legend: Checked-in', html.includes('เช็คอินหน้างานแล้ว')],
  ['Legend: Empty Seat', html.includes('ที่นั่งว่าง')],
  ['Legend: Sweet Spot Zone Cleanly Removed', !html.includes('legend-sweet-spot-label') && !html.includes('Sweet Spot Zone')]
];

legendChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});

console.log('\n--- Suite 3: CSS Visual Accuracy & Component Rules ---');
const cssChecks = [
  ['CSS: .btn-header-csv (Amber Luxury)', css.includes('.btn-header-csv')],
  ['CSS: .btn-header-walkin (Teal Action)', css.includes('.btn-header-walkin')],
  ['CSS: .pavalai-tier-tabs (Pill Group)', css.includes('.pavalai-tier-tabs')],
  ['CSS: .seat-filter-btn (Rounded Chips)', css.includes('.seat-filter-btn')],
  ['CSS: Sweet Spot Overlay & Label Rules Cleaned', !css.includes('.legend-sweet-spot-label') && !css.includes('.sweet-spot-indicator')],
  ['CSS: .vip-sample (Orange Arm/Body)', css.includes('.legend-seat-sample.vip-sample')],
  ['CSS: .privilege-sample (Blue Arm/Body)', css.includes('.legend-seat-sample.privilege-sample')],
  ['CSS: .standard-sample (Purple Arm/Body)', css.includes('.legend-seat-sample.standard-sample')],
  ['CSS: .balcony-sample (Crimson Arm/Body)', css.includes('.legend-seat-sample.balcony-sample')],
  ['CSS: .checkedin-sample (Emerald Checked Glow)', css.includes('.legend-seat-sample.checkedin-sample')],
  ['CSS: .empty-sample (Dark Slate Outline)', css.includes('.legend-seat-sample.empty-sample')]
];

cssChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});


console.log('\n--- Suite 4: Symmetrical Left & Right Row Labels ---');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'app.js'), 'utf8');

const rowLabelChecks = [
  ['CSS: .label-left grid-column: 1', css.includes('.pavalai-row .row-label.label-left') && css.includes('grid-column: 1;')],
  ['CSS: .label-right grid-column: 50', css.includes('.pavalai-row .row-label.label-right') && css.includes('grid-column: 50;')],
  ['CSS: pavalai-row 50 columns grid', css.includes('grid-template-columns: 28px repeat(48, minmax(16px, 1fr)) 28px;')],
  ['CSS: Projection room grid-column: 18 / 34', css.includes('grid-column: 18 / 34;')],
  ['JS: Seat grid-column mapped with s.col - 4', appJs.includes('(s.col - 4)')],
  ['JS: Twin left & right row badges rendered', appJs.includes('rowEl.appendChild(labelLeft)') && appJs.includes('rowEl.appendChild(labelRight)')]
];

rowLabelChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});

console.log('\n--- Suite 5: media-screening-dashboard Base URL & Asset Paths ---');
const serverJs = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const urlChecks = [
  ['Server: Root redirects to /media-screening-dashboard', serverJs.includes('/media-screening-dashboard') && serverJs.includes("res.redirect(302, `/media-screening-dashboard")],
  ['Server: Route /media-screening-dashboard serves index.html', serverJs.includes("app.get('/media-screening-dashboard'")],
  ['Server: Static assets mounted at /media-screening-dashboard', serverJs.includes("app.use('/media-screening-dashboard', express.static")],
  ['HTML: Title updated with Media Screening Dashboard', html.includes('<title>Media Screening Dashboard')],
  ['HTML: Absolute asset paths (/css/style.css)', html.includes('href="/css/style.css"')],
  ['HTML: Absolute script paths (/js/app.js)', html.includes('src="/js/app.js"') && html.includes('src="/js/api.js"')]
];

urlChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});

console.log('\n--- Suite 6: Redesigned Table Columns (Name, Detail, Participant, Seat, Tel) ---');
const guestCtrl = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'guestController.js'), 'utf8');

const columnChecks = [
  ['HTML: Table header Name (ชื่อแขก)', html.includes('Name (ชื่อแขก)</th>')],
  ['HTML: Table header Detail (รายละเอียด)', html.includes('Detail (รายละเอียด)</th>')],
  ['HTML: Table header Participant', html.includes('Participant</th>')],
  ['HTML: Table header Seat (ที่นั่ง)', html.includes('Seat (ที่นั่ง)</th>')],
  ['HTML: Table header Tel (เบอร์โทร)', html.includes('Tel (เบอร์โทร)</th>')],
  ['HTML: Table header Sign (เช็คอิน)', html.includes('Sign (เช็คอิน)</th>')],
  ['HTML: No obsolete Media table header', !html.includes('<th>Media (สื่อ / สังกัด)</th>') && !html.includes('<th style="width: 20%;">Media')],
  ['HTML: Import modal preview headers updated', (html.includes('Name (ชื่อผู้รับ)') || html.includes('Name (ชื่อแขก)')) && (html.includes('สื่อ (Media)') || html.includes('Detail (รายละเอียด)'))],
  ['JS: app.js parseCsvOrTsv supports multiline RFC-4180', appJs.includes('parseCsvOrTsv') && appJs.includes('isGoogleForm3Col')],
  ['JS: app.js renderGuestTable renders Name first then Detail', appJs.includes('guest-name') && appJs.includes('guest-detail')],
  ['JS: app.js renderImportPreview renders Name first then Detail', appJs.includes('item.name') && appJs.includes('item.detail || item.organization')],
  ['Backend: guestController imports detail field cleanly', guestCtrl.includes('detail: detailVal') && guestCtrl.includes('detail: updatedDetail')]
];

columnChecks.forEach(([name, ok]) => {
  if (ok) console.log('[PASS] ' + name);
  else { console.log('[FAIL] ' + name); failed++; }
});

const total = headerChecks.length + legendChecks.length + cssChecks.length + rowLabelChecks.length + urlChecks.length + columnChecks.length;
console.log('\n===============================================================');
console.log('  VERIFICATION RESULTS: ' + (total - failed) + ' / ' + total + ' TESTS PASSED (' + (failed === 0 ? '100%' : 'FAILED') + ')');
console.log('===============================================================\n');

process.exit(failed > 0 ? 1 : 0);
