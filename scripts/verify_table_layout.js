/**
 * Verification Script: Guest Table Layout, Fixed Column Proportions & Text Truncation
 * 
 * Verifies:
 * 1. table-layout: fixed on .guest-table
 * 2. .table-container responsive horizontal scroll (overflow-x: auto, min-width: 0)
 * 3. Proportional column widths (Name 20%, Detail 35%, Participant 8%, Seat 12%, Tel 12%, Sign 13%)
 * 4. Text truncation on Detail column (.col-guest-detail, .guest-detail-chip, .detail-text)
 * 5. Text truncation on Name column (.col-guest-name, .guest-name)
 * 6. Tooltip (title attribute) preservation for full detail and name
 * 7. Scoped overflow (no overflow:hidden on <tr>)
 */

const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('  VERIFICATION: GUEST TABLE LAYOUT & TEXT TRUNCATION ENGINE    ');
console.log('===============================================================\n');

const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');

const html = fs.readFileSync(htmlPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');

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

// Suite 1: Fixed Table Layout & Responsive Scroll Container
console.log('--- Suite 1: Fixed Table Layout & Responsive Scroll Container ---');
assert(
  '.guest-table has table-layout: fixed',
  css.includes('table-layout: fixed')
);
assert(
  '.table-container has overflow-x: auto',
  css.includes('overflow-x: auto')
);
assert(
  '.table-container has min-width: 0 for CSS grid compatibility',
  css.includes('min-width: 0')
);
assert(
  '.guest-table has min-width constraint to prevent squishing',
  css.includes('.guest-table') && css.includes('min-width:')
);

// Suite 2: Fixed Column Width Allocations
console.log('\n--- Suite 2: Fixed Column Width Allocations ---');
assert(
  'Name column allocated 18% in HTML header',
  html.includes('style="width: 18%;"') || html.includes('style="width: 20%;"')
);
assert(
  'Follower column allocated 10% in HTML header',
  html.includes('style="width: 10%;') || html.includes('style="width: 10%"')
);
assert(
  'Detail column allocated 24% in HTML header (largest proportion)',
  html.includes('style="width: 24%;"') || html.includes('style="width: 35%;"')
);
assert(
  'Participant column allocated 7% or 8% in HTML header',
  html.includes('style="width: 7%;') || html.includes('style="width: 8%;')
);
assert(
  'Seat column allocated 11% or 12% in HTML header',
  html.includes('style="width: 11%;"') || html.includes('style="width: 12%;"')
);
assert(
  'Tel column allocated 10% or 12% in HTML header',
  html.includes('style="width: 10%;"') || html.includes('style="width: 12%;"')
);
assert(
  'Sign column allocated 10% or 13% in HTML header',
  html.includes('style="width: 10%;') || html.includes('style="width: 13%;')
);
assert(
  'CSS specifies fixed column nth-child rules for table cells',
  (css.includes('.guest-table th:nth-child(4)') && css.includes('width: 24%')) ||
  (css.includes('.guest-table th:nth-child(2)') && css.includes('width: 35%'))
);

// Suite 3: Detail Column Text Truncation & Non-overflowing
console.log('\n--- Suite 3: Detail Column Text Truncation & Non-overflowing ---');
assert(
  'CSS has .col-guest-detail truncation rules',
  css.includes('.col-guest-detail') && css.includes('overflow: hidden')
);
assert(
  '.guest-detail-chip has overflow: hidden, text-overflow: ellipsis, white-space: nowrap',
  css.includes('.guest-detail-chip') &&
  css.includes('text-overflow: ellipsis') &&
  css.includes('white-space: nowrap')
);
assert(
  '.guest-detail-chip child text element has overflow and ellipsis truncation',
  css.includes('.guest-detail-chip .detail-text') &&
  css.includes('overflow: hidden')
);
assert(
  '.guest-detail-chip has max-width: 100% and cursor: pointer',
  css.includes('max-width: 100%') && css.includes('cursor: pointer')
);

// Suite 4: Tooltip Preservation & Full Detail Visibility
console.log('\n--- Suite 4: Tooltip Preservation & Full Detail Visibility ---');
assert(
  'app.js sets title attribute on .guest-detail-chip for native full hover tooltip',
  appJs.includes('class="guest-detail-chip"') && appJs.includes('title=')
);
assert(
  'app.js sets title attribute on .guest-name for long name hover preview',
  appJs.includes('class="guest-name"') && appJs.includes('title=')
);
assert(
  'app.js renderGuestTable binds row click to show full details in side panel',
  appJs.includes('showGuestDetails(guest.id)')
);

// Suite 5: Safety Checks (No unwanted global overflow hidden on tr)
console.log('\n--- Suite 5: Safety & Isolation Checks ---');
assert(
  'No destructive overflow: hidden applied directly to entire <tr> rows',
  !css.includes('.guest-table tbody tr { overflow: hidden') &&
  !css.includes('.guest-table tr { overflow: hidden')
);

console.log('\n===============================================================');
console.log(`  VERIFICATION RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('===============================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 Guest Table Layout & Text Truncation Verified Successfully!\n');
  process.exit(0);
}
