/**
 * Verification Script: Seat Category Color Coding (หมวดหมู่โควตา / PIC) — Updated Specification
 * Tests:
 * 1. Single source of truth config (seatCategoryColors.js)
 *    - All 6 categories: Ani Network (#443BF6), Idol (#EC4899), Lucky Draw (#FFD500),
 *      Phoenix Next (#00DAFF), Blessing Studio (#A4E629), VIP (#CFA82B)
 *    - Major is completely removed and falls back to default
 *    - Dynamic luminance contrast calculation (WCAG) for text colors
 * 2. HTML Markup & script integration (index.html) - Legend reordered, Major removed, Blessing Studio added
 * 3. CSS Custom properties, check-in coexistence & dimming (style.css)
 * 4. JavaScript seat rendering engine, cache & filter functions (app.js)
 * 5. Tooltip & side panel details
 */

const fs = require('fs');
const path = require('path');

console.log('===============================================================');
console.log('  TEST SUITE: SEAT CATEGORY COLOR CODING (QUOTA / PIC) v2     ');
console.log('===============================================================\n');

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

// --- Suite 1: Single Source of Truth Config (seatCategoryColors.js) ---
console.log('--- Suite 1: Single Source of Truth Config (seatCategoryColors.js) ---');
const seatCategoryColors = require('../public/js/seatCategoryColors.js');

assert('seatCategoryColors exports getSeatCategoryColor', typeof seatCategoryColors.getSeatCategoryColor === 'function');
assert('seatCategoryColors exports getSeatCategoryInfo', typeof seatCategoryColors.getSeatCategoryInfo === 'function');
assert('seatCategoryColors exports getContrastTextColor', typeof seatCategoryColors.getContrastTextColor === 'function');
assert('seatCategoryColors exports CATEGORIES array', Array.isArray(seatCategoryColors.CATEGORIES) && seatCategoryColors.CATEGORIES.length === 6);

// Category Colors Verification (New Specification)
assert('Ani Network -> #443BF6 (น้ำเงินเข้มสด)', seatCategoryColors.getSeatCategoryColor('Ani Network') === '#443BF6');
assert('Idol -> #EC4899 (ชมพู)', seatCategoryColors.getSeatCategoryColor('Idol') === '#EC4899');
assert('Lucky Draw -> #FFD500 (เหลืองสด)', seatCategoryColors.getSeatCategoryColor('Lucky Draw') === '#FFD500');
assert('Phoenix Next -> #00DAFF (ฟ้า cyan)', seatCategoryColors.getSeatCategoryColor('Phoenix Next') === '#00DAFF');
assert('Blessing Studio -> #A4E629 (เขียวอ่อน lime)', seatCategoryColors.getSeatCategoryColor('Blessing Studio') === '#A4E629');
assert('VIP -> #CFA82B (ทอง gold)', seatCategoryColors.getSeatCategoryColor('VIP') === '#CFA82B');

// Major must be removed and fallback to default
assert('Major (removed) returns "default"', seatCategoryColors.getSeatCategoryColor('Major') === 'default');
assert('Major pic info is marked isDefault: true', seatCategoryColors.getSeatCategoryInfo('Major').isDefault === true);

// Case-insensitivity & Normalization
assert('Case-insensitive "ani network"', seatCategoryColors.getSeatCategoryColor('ani network') === '#443BF6');
assert('No spaces "AniNetwork"', seatCategoryColors.getSeatCategoryColor('AniNetwork') === '#443BF6');
assert('Uppercase hyphenated "ANI-NETWORK"', seatCategoryColors.getSeatCategoryColor('ANI-NETWORK') === '#443BF6');
assert('Case-insensitive "blessing studio"', seatCategoryColors.getSeatCategoryColor('blessing studio') === '#A4E629');
assert('No spaces "BlessingStudio"', seatCategoryColors.getSeatCategoryColor('BlessingStudio') === '#A4E629');
assert('Alias "blessing"', seatCategoryColors.getSeatCategoryColor('blessing') === '#A4E629');
assert('Normalized alias "phoenix next"', seatCategoryColors.getSeatCategoryColor('phoenix next') === '#00DAFF');
assert('Dotted abbreviation "V.I.P."', seatCategoryColors.getSeatCategoryColor('V.I.P.') === '#CFA82B');

// Default / Unmatched Handling
assert('Unspecified/unknown returns "default"', seatCategoryColors.getSeatCategoryColor('Unknown Quota') === 'default');
assert('null returns "default"', seatCategoryColors.getSeatCategoryColor(null) === 'default');
assert('undefined returns "default"', seatCategoryColors.getSeatCategoryColor(undefined) === 'default');
assert('empty string returns "default"', seatCategoryColors.getSeatCategoryColor('') === 'default');

// Dynamic Luminance & Contrast Calculation (getContrastTextColor)
assert('getContrastTextColor(#FFD500 Lucky Draw) -> dark text #0f172a', seatCategoryColors.getContrastTextColor('#FFD500') === '#0f172a');
assert('getContrastTextColor(#A4E629 Blessing Studio) -> dark text #0f172a', seatCategoryColors.getContrastTextColor('#A4E629') === '#0f172a');
assert('getContrastTextColor(#00DAFF Phoenix Next) -> dark text #0f172a', seatCategoryColors.getContrastTextColor('#00DAFF') === '#0f172a');
assert('getContrastTextColor(#CFA82B VIP) -> dark text #0f172a', seatCategoryColors.getContrastTextColor('#CFA82B') === '#0f172a');
assert('getContrastTextColor(#443BF6 Ani Network) -> white text #ffffff', seatCategoryColors.getContrastTextColor('#443BF6') === '#ffffff');
assert('getContrastTextColor(#EC4899 Idol) -> white text #ffffff', seatCategoryColors.getContrastTextColor('#EC4899') === '#ffffff');

const luckyInfo = seatCategoryColors.getSeatCategoryInfo('Lucky Draw');
assert('Lucky Draw info textColor is #0f172a', luckyInfo.textColor === '#0f172a');
const blessingInfo = seatCategoryColors.getSeatCategoryInfo('Blessing Studio');
assert('Blessing Studio info textColor is #0f172a', blessingInfo.textColor === '#0f172a');
const aniInfo = seatCategoryColors.getSeatCategoryInfo('Ani Network');
assert('Ani Network info textColor is #ffffff', aniInfo.textColor === '#ffffff');

// --- Suite 2: HTML Markup & Script Integration ---
console.log('\n--- Suite 2: HTML Markup & Script Integration (index.html) ---');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

assert('HTML loads seatCategoryColors.js before app.js',
  html.includes('src="/js/seatCategoryColors.js"') &&
  html.indexOf('src="/js/seatCategoryColors.js"') < html.indexOf('src="/js/app.js"')
);
assert('HTML contains Category Legend (#seatCategoryLegend)', html.includes('id="seatCategoryLegend"'));
assert('HTML contains Category Legend buttons container (#catLegendButtons)', html.includes('id="catLegendButtons"'));
assert('HTML contains All category button', html.includes('data-category="all"'));
assert('HTML contains Ani Network category button', html.includes('data-category="aninetwork"'));
assert('HTML does NOT contain Major category button (removed)', !html.includes('data-category="major"'));
assert('HTML contains Idol category button', html.includes('data-category="idol"'));
assert('HTML contains Lucky Draw category button', html.includes('data-category="luckydraw"'));
assert('HTML contains Phoenix Next category button', html.includes('data-category="phoenixnext"'));
assert('HTML contains Blessing Studio category button (added)', html.includes('data-category="blessingstudio"'));
assert('HTML contains VIP category button', html.includes('data-category="vip"'));
assert('HTML contains Other category button', html.includes('data-category="other"'));

// --- Suite 3: CSS Styles & Coexistence of Category Color and Check-in ---
console.log('\n--- Suite 3: CSS Styles & Coexistence (style.css) ---');
const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');

assert('CSS contains .cinema-seat.has-category-color rule', css.includes('.cinema-seat.has-category-color'));
assert('CSS applies background: var(--seat-category-color) !important', css.includes('background: var(--seat-category-color) !important'));
assert('CSS applies color: var(--seat-category-text', css.includes('color: var(--seat-category-text'));

// Checked-in Coexistence: Must NOT replace category background with green!
assert('CSS checked-in coexistence retains background: var(--seat-category-color) !important',
  css.includes('.cinema-seat.has-category-color.is-checked-in') &&
  css.includes('border: 2px solid #10b981 !important')
);
assert('CSS checked-in coexistence has emerald glow box-shadow',
  css.includes('rgba(16, 185, 129, 0.85)')
);
assert('CSS contains checkmark badge for category-colored checked-in seat',
  css.includes('.cinema-seat.has-category-color.is-checked-in::after') &&
  css.includes("content: '✓'")
);

// Legend & Dimming Styles
assert('CSS contains .legend-row-category styling', css.includes('.legend-row-category'));
assert('CSS contains .cat-legend-btn styling', css.includes('.cat-legend-btn'));
assert('CSS contains .cat-legend-btn.active styling', css.includes('.cat-legend-btn.active'));
assert('CSS contains .cinema-seat.seat-cat-dimmed with low opacity for filtering',
  css.includes('.cinema-seat.seat-cat-dimmed') && css.includes('opacity: 0.12 !important')
);

// --- Suite 4: JavaScript Seat Rendering Engine & Performance ---
console.log('\n--- Suite 4: JavaScript Seat Rendering Engine & Caching (app.js) ---');
const appJs = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

assert('app.js defines seatColors cache in state', appJs.includes('seatColors: {}'));
assert('app.js defines activeCategoryFilter in state', appJs.includes("activeCategoryFilter: 'all'"));
assert('app.js contains computeSeatColorsCache function', appJs.includes('function computeSeatColorsCache'));
assert('app.js contains updateCategoryLegendCounts with blessingstudio', appJs.includes('blessingstudio: 0') && appJs.includes('catCountBlessing'));
assert('app.js contains applyCategoryFilter function', appJs.includes('function applyCategoryFilter'));
assert('app.js contains setupCategoryLegend function', appJs.includes('function setupCategoryLegend'));

// Seat button rendering checks
assert('createSeatButtonPavalai sets --seat-category-color property',
  appJs.includes("btn.style.setProperty('--seat-category-color'")
);
assert('createSeatButtonPavalai sets --seat-category-text property',
  appJs.includes("btn.style.setProperty('--seat-category-text'")
);
assert('createSeatButtonPavalai sets has-category-color class',
  appJs.includes("btn.classList.add('has-category-color')")
);
assert('createSeatButton sets dataset.categoryKey',
  appJs.includes('btn.dataset.categoryKey =')
);
assert('createSeatButton handles empty seats without category color',
  appJs.includes("btn.dataset.categoryKey = 'empty'")
);

// Tooltip & Sidebar Checks
assert('showSeatHoverTooltip displays Category (PIC) row',
  appJs.includes('หมวดหมู่ (PIC):') && appJs.includes('hover-seat-cat-row')
);
assert('showSeatDetails displays Category (PIC) badge in side panel',
  appJs.includes('<strong>หมวดหมู่ (PIC):</strong>')
);
assert('setupEventListeners calls setupCategoryLegend',
  appJs.includes('setupCategoryLegend();')
);

console.log('\n===============================================================');
console.log(`  VERIFICATION RESULTS: ${passed} / ${passed + failed} TESTS PASSED`);
console.log('===============================================================\n');

process.exit(failed > 0 ? 1 : 0);
