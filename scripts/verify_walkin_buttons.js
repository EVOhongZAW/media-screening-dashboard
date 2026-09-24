/**
 * Verification Script: Walk-in Buttons in Seating Chart and Guest List
 * Tests:
 * 1. Button #btnOpenGroupWalkInFromSeats in Seating Chart
 * 2. Button #btnOpenGroupWalkInFromGuests in Guest List Toolbar
 * 3. Walk-in modal #modalWalkInSeat markup and title
 * 4. JS binding and event handler connection
 * 5. CSS cursor and hover rules
 */

const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('  VERIFICATION: WALK-IN BUTTONS (SEAT MAP & GUEST LIST)        ');
console.log('===============================================================\n');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const jsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');

const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

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

// Suite 1: HTML Markup Checks
console.log('--- Suite 1: HTML Markup Checks ---');
assert(
  'Seating Chart has #btnOpenGroupWalkInFromSeats button',
  html.includes('id="btnOpenGroupWalkInFromSeats"')
);
assert(
  'Seating Chart walk-in button has text "+ เพิ่ม Walk-in (เดี่ยว / กลุ่ม)"',
  html.includes('+ เพิ่ม Walk-in (เดี่ยว / กลุ่ม)')
);
assert(
  'Guest List has #btnOpenGroupWalkInFromGuests button',
  html.includes('id="btnOpenGroupWalkInFromGuests"')
);
assert(
  'Guest List walk-in button has text "+ เพิ่ม Walk-in"',
  html.includes('+ เพิ่ม Walk-in')
);
assert(
  'Walk-in modal #modalWalkInSeat exists',
  html.includes('id="modalWalkInSeat"')
);
assert(
  'Walk-in modal has title container #walkInModalTitle',
  html.includes('id="walkInModalTitle"')
);

// Suite 2: JavaScript Bindings & Handler
console.log('\n--- Suite 2: JavaScript Event Listeners & Handler ---');
assert(
  'app.js binds #btnOpenGroupWalkInFromSeats click event',
  js.includes('#btnOpenGroupWalkInFromSeats')
);
assert(
  'app.js binds #btnOpenGroupWalkInFromGuests click event',
  js.includes('#btnOpenGroupWalkInFromGuests')
);
assert(
  'app.js exposes window.openWalkInModal',
  js.includes('window.openWalkInModal = function')
);
assert(
  'openWalkInModal sanitizes seatId argument',
  js.includes('typeof seatId === \'string\'')
);
assert(
  'openWalkInModal updates modal title dynamically',
  js.includes('walkInModalTitle')
);
assert(
  'openWalkInModal resets phone validation error on open',
  js.includes('walkInPhoneError')
);

// Suite 3: CSS Styles
console.log('\n--- Suite 3: CSS Styles & Interactivity ---');
assert(
  'CSS has .btn-header-walkin styling with cursor pointer',
  css.includes('.btn-header-walkin') && css.includes('cursor: pointer')
);
assert(
  'CSS has .btn-header-walkin:hover rule',
  css.includes('.btn-header-walkin:hover')
);
assert(
  'CSS has #btnOpenGroupWalkInFromGuests hover rule',
  css.includes('#btnOpenGroupWalkInFromGuests:hover')
);

console.log('\n===============================================================');
console.log(`  VERIFICATION RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Walk-in button checks passed successfully!\n');
  process.exit(0);
}
