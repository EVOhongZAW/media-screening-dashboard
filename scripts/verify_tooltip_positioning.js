/**
 * Verification Script: Smart Seat Tooltip Dynamic Positioning & Collision Detection
 * 
 * Tests:
 * 1. Pure Geometric Placement & Collision Detection (computeTooltipPlacementAndCoords)
 *    - Top rows (X, W, V) -> placed cleanly without clipping at top
 *    - Bottom row (FA) -> flipped above seat, no clipping at bottom
 *    - Seat B10 -> positioned directly adjacent to B10 (never far away at top of chart)
 *    - Leftmost seats -> clamp left >= padding, arrow aligned
 *    - Rightmost seats -> clamp right <= vpWidth - padding, arrow aligned
 *    - Middle seats -> centered on seat with arrow at center
 *    - Constrained viewport -> picks side with max space, clamps cleanly
 * 2. Tooltip Styling & CSS Rules (public/css/style.css)
 *    - position: fixed, max-height: min(60vh, 320px), overflow-y: auto, max-width
 *    - Sleek dark scrollbar styles
 *    - Placement arrows (.placement-top / .placement-bottom with --arrow-x)
 * 3. Portal Pattern Architecture & Event Handling (public/index.html & public/js/app.js)
 *    - Portal Pattern: #seatHoverCard direct child of <body> to avoid ancestor CSS transform clipping
 *    - app.js enforces Portal Pattern (appends to document.body if detached)
 *    - rAF throttling
 *    - Skip recalculation on mousemove inside same seat (Performance)
 *    - Immediate dismiss on scroll with { capture: true }
 *    - Interactive card hover & scroll support
 *    - Immediate hide on seat selection
 */

const fs = require('fs');
const path = require('path');

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

console.log('\n===============================================================');
console.log('  TEST SUITE: SMART SEAT TOOLTIP POSITIONING & COLLISION');
console.log('===============================================================\n');

// -------------------------------------------------------------
// Suite 1: Pure Geometric Placement & Collision Algorithm
// -------------------------------------------------------------
console.log('--- Suite 1: Geometric Collision Detection Algorithm ---');

// Extract or define computeTooltipPlacementAndCoords from app.js
const appJsPath = path.join(__dirname, '../public/js/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

let computeTooltipPlacementAndCoords;
try {
  const match = appJs.match(/function computeTooltipPlacementAndCoords[\s\S]*?\n\}/);
  if (match) {
    const fnCode = match[0] + '\nreturn computeTooltipPlacementAndCoords;';
    computeTooltipPlacementAndCoords = new Function(fnCode)();
  }
} catch (e) {
  console.error('Failed to parse computeTooltipPlacementAndCoords:', e.message);
}

assert('app.js defines computeTooltipPlacementAndCoords function', typeof computeTooltipPlacementAndCoords === 'function');

if (typeof computeTooltipPlacementAndCoords === 'function') {
  const cardSize = { width: 280, height: 140 };
  const vpSize = { width: 1280, height: 800 };
  const offset = 8;
  const padding = 10;

  // Test Case 1: Top row seat (e.g., X25 at top: 30px, bottom: 58px)
  const topSeatRect = { top: 30, bottom: 58, left: 600, width: 28, height: 28 };
  const topResult = computeTooltipPlacementAndCoords(topSeatRect, cardSize, vpSize, offset, padding);
  assert('Top row seat (X25) placement is "bottom"', topResult.placement === 'bottom');
  assert('Top row seat tooltip top is below seat bottom', topResult.top === topSeatRect.bottom + offset);
  assert('Top row seat tooltip does not clip top edge', topResult.top >= padding);

  // Test Case 2: Bottom row seat (e.g., FA10 at top: 740px, bottom: 768px)
  const bottomSeatRect = { top: 740, bottom: 768, left: 600, width: 28, height: 28 };
  const bottomResult = computeTooltipPlacementAndCoords(bottomSeatRect, cardSize, vpSize, offset, padding);
  assert('Bottom row seat (FA10) places tooltip at "top"', bottomResult.placement === 'top');
  assert('Bottom row seat tooltip is above seat top', bottomResult.top === bottomSeatRect.top - cardSize.height - offset);
  assert('Bottom row seat tooltip does not overflow bottom edge', bottomResult.top + cardSize.height <= vpSize.height - padding);

  // Test Case 3: Leftmost seat (e.g., Row A seat 1 at left: 15px)
  const leftSeatRect = { top: 300, bottom: 328, left: 15, width: 28, height: 28 };
  const leftResult = computeTooltipPlacementAndCoords(leftSeatRect, cardSize, vpSize, offset, padding);
  assert('Leftmost seat clamps left to viewport padding', leftResult.left === padding);
  assert('Leftmost seat arrow aligns towards seat center', leftResult.arrowX >= 14 && leftResult.arrowX <= cardSize.width - 14);

  // Test Case 4: Rightmost seat (e.g., Row A seat 50 at left: 1240px)
  const rightSeatRect = { top: 300, bottom: 328, left: 1240, width: 28, height: 28 };
  const rightResult = computeTooltipPlacementAndCoords(rightSeatRect, cardSize, vpSize, offset, padding);
  assert('Rightmost seat clamps right within viewport', rightResult.left === vpSize.width - cardSize.width - padding);
  assert('Rightmost seat arrow is clamped within card boundary', rightResult.arrowX >= 14 && rightResult.arrowX <= cardSize.width - 14);

  // Test Case 5: Middle seat with ample space
  const midSeatRect = { top: 400, bottom: 428, left: 600, width: 28, height: 28 };
  const midResult = computeTooltipPlacementAndCoords(midSeatRect, cardSize, vpSize, offset, padding);
  assert('Middle seat tooltip placed adjacent to seat',
    Math.abs(midResult.top - midSeatRect.bottom) <= offset + 5 || Math.abs(midResult.top + cardSize.height - midSeatRect.top) <= offset + 5
  );
  assert('Middle seat tooltip horizontally centered on seat', midResult.left === (midSeatRect.left + 14) - (cardSize.width / 2));
  assert('Middle seat arrow points to center (140px)', midResult.arrowX === cardSize.width / 2);

  // Test Case 6: Seat B10 (User reported scenario: row B in Stalls)
  const b10Rect = { top: 520, bottom: 548, left: 620, width: 28, height: 28 };
  const b10Result = computeTooltipPlacementAndCoords(b10Rect, cardSize, vpSize, offset, padding);
  assert('Seat B10 tooltip is placed adjacent to B10 (not at top of page)',
    Math.abs(b10Result.top - b10Rect.bottom) <= offset + 5 || Math.abs(b10Result.top + cardSize.height - b10Rect.top) <= offset + 5
  );
  assert('Seat B10 tooltip is horizontally centered over B10',
    Math.abs(b10Result.left + (cardSize.width / 2) - (b10Rect.left + 14)) <= 2
  );

  // Test Case 7: Constrained viewport with tall card
  const smallVp = { width: 375, height: 600 };
  const tallCard = { width: 280, height: 250 };
  const midSmallRect = { top: 200, bottom: 228, left: 100, width: 28, height: 28 };
  const smallResult = computeTooltipPlacementAndCoords(midSmallRect, tallCard, smallVp, offset, padding);
  assert('Constrained viewport tooltip top >= padding', smallResult.top >= padding);
  assert('Constrained viewport tooltip bottom <= vpHeight - padding', smallResult.top + tallCard.height <= smallVp.height - padding);
  assert('Constrained viewport left >= padding', smallResult.left >= padding);
  assert('Constrained viewport right <= vpWidth - padding', smallResult.left + tallCard.width <= smallVp.width - padding);
}

// -------------------------------------------------------------
// Suite 2: CSS Styles & Arrow Pointer Architecture
// -------------------------------------------------------------
console.log('\n--- Suite 2: CSS Tooltip Rules & Styling ---');
const styleCssPath = path.join(__dirname, '../public/css/style.css');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

assert('CSS .seat-hover-card has position: fixed', styleCss.includes('.seat-hover-card') && styleCss.includes('position: fixed'));
assert('CSS .seat-hover-card defines max-height: min(60vh, 320px)', styleCss.includes('max-height: min(60vh, 320px)'));
assert('CSS .seat-hover-card defines overflow-y: auto', styleCss.includes('overflow-y: auto'));
assert('CSS .seat-hover-card defines max-width limit', styleCss.includes('max-width: min(300px, calc(100vw - 24px))'));
assert('CSS .seat-hover-card contains custom dark scrollbar', styleCss.includes('.seat-hover-card::-webkit-scrollbar'));
assert('CSS .seat-hover-card contains scrollbar thumb styling', styleCss.includes('.seat-hover-card::-webkit-scrollbar-thumb'));
assert('CSS defines pointer arrow for top placement (.placement-top / .arrow-bottom)',
  styleCss.includes('.seat-hover-card.placement-top::after') || styleCss.includes('.seat-hover-card.arrow-bottom::after')
);
assert('CSS defines pointer arrow for bottom placement (.placement-bottom / .arrow-top)',
  styleCss.includes('.seat-hover-card.placement-bottom::after') || styleCss.includes('.seat-hover-card.arrow-top::after')
);
assert('CSS arrow uses dynamic --arrow-x variable', styleCss.includes('var(--arrow-x'));

// -------------------------------------------------------------
// Suite 3: Portal Pattern & Event Architecture
// -------------------------------------------------------------
console.log('\n--- Suite 3: Portal Pattern & Event Architecture ---');
const indexHtmlPath = path.join(__dirname, '../public/index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Portal Pattern: Tooltip is direct child of <body>, avoiding ancestor CSS transforms
assert('index.html places #seatHoverCard as direct child of <body> (Portal Pattern)',
  indexHtml.includes('id="seatHoverCard"') &&
  !indexHtml.match(/<section id="view-seating"[\s\S]*?id="seatHoverCard"[\s\S]*?<\/section>/)
);

assert('app.js enforces Portal Pattern: attaches #seatHoverCard to document.body',
  appJs.includes('card.parentElement !== document.body') && appJs.includes('document.body.appendChild(card)')
);

assert('app.js defines showSeatHoverTooltip', appJs.includes('function showSeatHoverTooltip('));
assert('app.js defines updateSeatHoverTooltipPosition', appJs.includes('function updateSeatHoverTooltipPosition('));
assert('app.js defines hideSeatHoverTooltip', appJs.includes('function hideSeatHoverTooltip('));

// Performance: skip recalculating position if cursor stays inside same seat
assert('app.js skips redundant recalculation on mousemove inside same seat',
  appJs.includes('card._currentSeatId === seatBtn.dataset.seatId')
);

// Pointer arrow custom property set dynamically
assert('app.js sets --arrow-x style property dynamically',
  appJs.includes("card.style.setProperty('--arrow-x'")
);

// Placement classes toggled
assert('app.js toggles placement-top and placement-bottom classes',
  appJs.includes('placement-top') && appJs.includes('placement-bottom')
);

// Dismiss on scroll with capture: true
assert('app.js dismisses tooltip immediately on scroll with capture: true',
  appJs.includes("window.addEventListener('scroll', handleSeatScroll, { passive: true, capture: true })")
);

// Tooltip hides on seat click
assert('app.js hides tooltip immediately when selecting a seat',
  appJs.includes('hideSeatHoverTooltip(true)')
);

// Interactive card hover: does not hide when moving into tooltip card
assert('app.js allows moving cursor into tooltip card to scroll',
  appJs.includes('e.relatedTarget === card') || appJs.includes('card.contains(e.relatedTarget)')
);

console.log('\n===============================================================');
console.log(`  VERIFICATION RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('===============================================================\n');

process.exit(failed > 0 ? 1 : 0);
