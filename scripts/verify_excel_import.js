// scripts/verify_excel_import.js
// Exhaustive Test Suite for Enterprise Excel (.xlsx / .xls) & CSV Import Pipeline

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Load Vendored SheetJS & ExcelImporter
const XLSX = require('../public/vendor/xlsx/xlsx.full.min.js');
const ExcelImporter = require('../public/js/excelImporter.js');

const tests = [];
function suite(name) {
  tests.push({ type: 'suite', name });
}
function it(desc, fn) {
  tests.push({ type: 'test', desc, fn });
}

console.log('===============================================================');
console.log('  TEST SUITE: EXCEL & CSV ENTERPRISE IMPORT PIPELINE           ');
console.log('===============================================================');

suite('Suite 1: File Validation & Security (validateFileSignature)');

it('Rejects 0-byte empty file with EMPTY_FILE code', () => {
  const buf = new Uint8Array(0).buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'empty.xlsx');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'EMPTY_FILE');
});

it('Rejects file exceeding 10MB limit with FILE_TOO_LARGE code', () => {
  const buf = new Uint8Array(11 * 1024 * 1024).buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'giant.xlsx');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'FILE_TOO_LARGE');
});

it('Rejects .xlsm file explicitly with MACRO_REJECTED code', () => {
  const buf = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0, 0, 0, 0]).buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'macro_payload.xlsm');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'MACRO_REJECTED');
});

it('Accepts valid .xlsx with zip magic bytes PK\\x03\\x04', () => {
  const buf = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0, 0x06, 0]).buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'valid.xlsx');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.format, 'xlsx');
});

it('Rejects fake .xlsx file without zip header with INVALID_XLSX_SIGNATURE', () => {
  const buf = Buffer.from('Just plain text pretend to be excel').buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'fake.xlsx');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'INVALID_XLSX_SIGNATURE');
});

it('Accepts valid .xls with CFB magic bytes D0 CF 11 E0 A1 B1 1A E1', () => {
  const buf = new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]).buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'legacy.xls');
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.format, 'xls');
});

it('Rejects fake .xls without CFB header with INVALID_XLS_SIGNATURE', () => {
  const buf = Buffer.from('Not a CFB file').buffer;
  const res = ExcelImporter.validateFileSignature(buf, 'fake.xls');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.code, 'INVALID_XLS_SIGNATURE');
});

it('Accepts .csv, .tsv, and .txt files', () => {
  const buf = Buffer.from('Name,Seat\nAlice,A1').buffer;
  const resCsv = ExcelImporter.validateFileSignature(buf, 'data.csv');
  const resTsv = ExcelImporter.validateFileSignature(buf, 'data.tsv');
  const resTxt = ExcelImporter.validateFileSignature(buf, 'data.txt');
  assert.strictEqual(resCsv.valid, true);
  assert.strictEqual(resCsv.format, 'csv');
  assert.strictEqual(resTsv.valid, true);
  assert.strictEqual(resTsv.format, 'csv');
  assert.strictEqual(resTxt.valid, true);
  assert.strictEqual(resTxt.format, 'csv');
});

// -----------------------------------------------------------------
// Suite 2: Normalization & Edge Cases (Pitfalls 1, 4, 6, 7, 9, 10)
suite('Suite 2: Normalization & Data Cleansing');

it('Phone: Restores dropped leading 0 for 9-digit Thai numbers (891234567 -> 0891234567)', () => {
  const res = ExcelImporter.normalizePhoneNumber('891234567');
  assert.strictEqual(res.phone, '0891234567');
  assert.strictEqual(res.warning, null);
});

it('Phone: Handles scientific notation (8.91234567E+8 -> 0891234567)', () => {
  const res = ExcelImporter.normalizePhoneNumber('8.91234567E+8');
  assert.strictEqual(res.phone, '0891234567');
  assert.strictEqual(res.warning, null);
});

it('Phone: Handles +66 prefix and cleans symbols (+66 89-123-4567 -> 0891234567)', () => {
  const res = ExcelImporter.normalizePhoneNumber('+66 89-123-4567');
  assert.strictEqual(res.phone, '0891234567');
  assert.strictEqual(res.warning, null);
});

it('Phone: Emits non-blocking warning for abnormal length (e.g. 9 digits starting with 02)', () => {
  const res = ExcelImporter.normalizePhoneNumber('021234567');
  assert.strictEqual(res.phone, '021234567');
  assert.ok(res.warning && res.warning.includes('ความยาว 9 หลัก'));
});

it('Phone: Returns empty string without warning for null or empty input', () => {
  const resNull = ExcelImporter.normalizePhoneNumber(null);
  const resEmpty = ExcelImporter.normalizePhoneNumber('   ');
  assert.strictEqual(resNull.phone, '');
  assert.strictEqual(resNull.warning, null);
  assert.strictEqual(resEmpty.phone, '');
  assert.strictEqual(resEmpty.warning, null);
});

it('Text: normalizeText strips leading bullet characters, hyphens, and zero-width spaces', () => {
  assert.strictEqual(ExcelImporter.normalizeText(' • สื่อออนไลน์ดอทคอม '), 'สื่อออนไลน์ดอทคอม');
  assert.strictEqual(ExcelImporter.normalizeText('\uFEFF \u00A0 นายสมชาย เข็มกลัด '), 'นายสมชาย เข็มกลัด');
  assert.strictEqual(ExcelImporter.normalizeText('- รายการพิเศษ'), 'รายการพิเศษ');
});

it('Security: escapeHtml properly sanitizes XSS payloads', () => {
  const safe = ExcelImporter.escapeHtml('<script>alert("xss")</script>');
  assert.strictEqual(safe, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.strictEqual(ExcelImporter.escapeHtml("Tom's & Jerry's"), 'Tom&#039;s &amp; Jerry&#039;s');
});

it('Participant: Identifies non-numeric status words (VIP, เชิญ, ไม่ว่าง, ติดงาน)', () => {
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('VIP'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('vip'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('เชิญ'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('ไม่ว่าง'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('ติดงาน'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('สละสิทธิ์'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('รอยืนยัน'), true);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('2'), false);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant(3), false);
  assert.strictEqual(ExcelImporter.isNonNumericParticipant('1,200,000'), false);
});

it('Participant: Extracts participant count with comma and embedded strings', () => {
  assert.strictEqual(ExcelImporter.extractParticipantCount('1,200,000').count, 1200000);
  assert.strictEqual(ExcelImporter.extractParticipantCount('(โควตา 2 ใบ)').count, 2);
  assert.strictEqual(ExcelImporter.extractParticipantCount('4 ท่าน').count, 4);
  assert.strictEqual(ExcelImporter.extractParticipantCount(null, 'จำนวนผู้เข้าชม: 5 คน').count, 5);
});

it('Recipient Name: Extracts attendee name from multiline detail or falls back to organization', () => {
  const detail = '• คุณสมชาย เข็มกลัด (ผู้รับบัตร)\n• โทร 081-234-5678';
  const res1 = ExcelImporter.extractRecipientName(detail, 'Media Channel');
  assert.strictEqual(res1.name, 'สมชาย เข็มกลัด');
  assert.strictEqual(res1.isFallback, false);

  const detail2 = 'ชื่อผู้รับ: วรวิทย์ สิทธิโชค';
  const res2 = ExcelImporter.extractRecipientName(detail2, 'Media Channel');
  assert.strictEqual(res2.name, 'วรวิทย์ สิทธิโชค');
  assert.strictEqual(res2.isFallback, false);

  const fallback = ExcelImporter.extractRecipientName('', 'Ani Network');
  assert.strictEqual(fallback.name, 'Ani Network');
  assert.strictEqual(fallback.isFallback, true);
});

// -----------------------------------------------------------------
// Suite 3: Seat Syntax Expansion (All Variants)
suite('Suite 3: Seat Syntax Expansion (expandSeats)');

it('Expands single seat', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('A1'), ['A1']);
  assert.deepStrictEqual(ExcelImporter.expandSeats('fa10'), ['FA10']);
});

it('Expands "I16-17" to ["I16", "I17"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('I16-17'), ['I16', 'I17']);
});

it('Expands "B16-B17" to ["B16", "B17"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('B16-B17'), ['B16', 'B17']);
});

it('Expands "E3-4" to ["E3", "E4"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('E3-4'), ['E3', 'E4']);
});

it('Expands "AA11-AA12" to ["AA11", "AA12"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('AA11-AA12'), ['AA11', 'AA12']);
});

it('Expands "FH12-13" to ["FH12", "FH13"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('FH12-13'), ['FH12', 'FH13']);
});

it('Expands "E7, E8" comma separated to ["E7", "E8"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('E7, E8'), ['E7', 'E8']);
});

it('Expands "A1 - A3" with spaces and en-dash "B5 – B7"', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('A1 - A3'), ['A1', 'A2', 'A3']);
  assert.deepStrictEqual(ExcelImporter.expandSeats('B5 – B7'), ['B5', 'B6', 'B7']);
});

it('Expands reverse range "C10-C8" into ascending order ["C8", "C9", "C10"]', () => {
  assert.deepStrictEqual(ExcelImporter.expandSeats('C10-C8'), ['C8', 'C9', 'C10']);
});

// -----------------------------------------------------------------
// Suite 4: Header Detection & Column Mapping
suite('Suite 4: Header Auto-Detection & Column Mapping');

it('detectHeaderRow finds the header index scanning first 10 rows', () => {
  const dummyRows = [
    { rowIndex: 0, cells: [{ text: 'บันทึกการเชิญ' }, { text: '' }] },
    { rowIndex: 1, cells: [{ text: '' }, { text: '' }] },
    { rowIndex: 2, cells: [{ text: 'ชื่อสื่อ/เพจ' }, { text: 'จำนวน' }, { text: 'เบอร์โทร' }, { text: 'ที่นั่ง' }] },
    { rowIndex: 3, cells: [{ text: 'ช่อง A' }, { text: '2' }, { text: '0812345678' }, { text: 'A1, A2' }] }
  ];
  const detected = ExcelImporter.detectHeaderRow(dummyRows);
  assert.strictEqual(detected, 2);
});

it('mapColumns associates column headers with canonical keys', () => {
  const headerCells = [
    { text: 'ชื่อสื่อ / เพจ' },
    { text: 'ชื่อผู้รับบัตร' },
    { text: 'ยอดผู้ติดตาม' },
    { text: 'PIC (ผู้ดูแล)' },
    { text: 'จำนวน' },
    { text: 'รายละเอียด' },
    { text: 'Seat (ที่นั่ง)' },
    { text: 'เบอร์โทร' }
  ];
  const mapping = ExcelImporter.mapColumns(headerCells);
  assert.strictEqual(mapping[0], 'organization');
  assert.strictEqual(mapping[1], 'name');
  assert.strictEqual(mapping[2], 'follower');
  assert.strictEqual(mapping[3], 'pic');
  assert.strictEqual(mapping[4], 'participant');
  assert.strictEqual(mapping[5], 'detail');
  assert.strictEqual(mapping[6], 'seat');
  assert.strictEqual(mapping[7], 'phone');
});

// -----------------------------------------------------------------
// Suite 5: Real Dataset Ingestion (Set A, Set B, Seated)
suite('Suite 5: Real Dataset Processing');

const testFilesDir = path.join(__dirname, '../test_files');
const pavalaiLayout = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/pavalai_layout.json'), 'utf8'));
const validSeatsSet = new Set(pavalaiLayout.allSeats || []);

// Helper to simulate worker row extraction in Node using SheetJS
function parseWorkbookRows(filePath) {
  const fileBuf = fs.readFileSync(filePath);
  const wb = XLSX.read(fileBuf, { type: 'buffer', cellFormula: false, cellText: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Propagate merges
  if (ws['!merges']) {
    ws['!merges'].forEach(range => {
      const startCoord = XLSX.utils.encode_cell(range.s);
      const masterCell = ws[startCoord];
      if (!masterCell) return;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          if (R === range.s.r && C === range.s.c) continue;
          const targetCoord = XLSX.utils.encode_cell({ r: R, c: C });
          ws[targetCoord] = {
            t: masterCell.t,
            v: masterCell.v,
            w: masterCell.w,
            l: masterCell.l ? { ...masterCell.l } : undefined
          };
        }
      }
    });
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const rows = [];

  for (let R = range.s.r; R <= range.e.r; ++R) {
    const row = [];
    let hasContent = false;
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const coord = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[coord];
      if (!cell || (cell.v === undefined && cell.w === undefined)) {
        row.push({ val: '', text: '', link: null, type: 'z' });
      } else {
        const text = cell.w !== undefined ? String(cell.w).trim() : (cell.v !== undefined ? String(cell.v).trim() : '');
        const val = cell.v !== undefined ? cell.v : text;
        const link = (cell.l && cell.l.Target) ? String(cell.l.Target).trim() : null;
        if (text || val || link) hasContent = true;
        row.push({ val, text, link, type: cell.t || 's' });
      }
    }
    if (hasContent) {
      rows.push({ rowIndex: R, cells: row });
    }
  }

  return { rows, sheetName };
}

it('Set A (gala_doraemon_2026_test_.xlsx): Correctly processes 644 importable rows, skips non-numeric rows, extracts ~55 links', () => {
  const filePath = path.join(testFilesDir, 'gala_doraemon_2026_test_.xlsx');
  assert.ok(fs.existsSync(filePath), 'File gala_doraemon_2026_test_.xlsx must exist');

  const { rows } = parseWorkbookRows(filePath);
  const headerRowIdx = ExcelImporter.detectHeaderRow(rows);
  const headerRow = rows[headerRowIdx];
  const columnMapping = ExcelImporter.mapColumns(headerRow.cells);

  const result = ExcelImporter.processImportRows({
    rawRows: rows,
    headerRowIdx,
    columnMapping,
    validSeats: validSeatsSet,
    existingGuests: [],
    replaceExisting: true
  });

  assert.strictEqual(result.summary.errorCount, 0, 'Should have 0 uncorrectable errors');
  assert.ok(result.importableGuests.length >= 640, `Expected >= 640 importable guests, got ${result.importableGuests.length}`);
  assert.ok(result.skippedRows.length >= 60, `Expected >= 60 skipped rows, got ${result.skippedRows.length}`);

  // Check skipped reasons contain non-numeric notes
  const nonNumericSkipped = result.skippedRows.filter(s => s.reason.includes('ไม่ใช่ตัวเลข'));
  assert.ok(nonNumericSkipped.length >= 60, 'Non-numeric status rows must be skipped with explicit reason');

  // Check hyperlinked items
  const withLinks = result.importableGuests.filter(g => g.link);
  assert.ok(withLinks.length >= 50, `Expected >= 50 guests with link, got ${withLinks.length}`);
  assert.ok(withLinks[0].link.startsWith('http'), 'Link must be valid URL');
  assert.ok(withLinks[0].organization.length > 0, 'Organization must be display text, not URL');

  // Check total participants
  assert.strictEqual(result.summary.totalParticipants, 888, 'Total participants for Set A should match 888');
});

it('Set B (Doraemon2026_Final_List.csv): Correctly processes Follower 1,200,000 and expands I16-17', () => {
  const filePath = path.join(testFilesDir, 'Doraemon2026_Final_List.csv');
  assert.ok(fs.existsSync(filePath), 'File Doraemon2026_Final_List.csv must exist');

  const { rows } = parseWorkbookRows(filePath);
  const headerRowIdx = ExcelImporter.detectHeaderRow(rows);
  const columnMapping = ExcelImporter.mapColumns(rows[headerRowIdx].cells);

  const result = ExcelImporter.processImportRows({
    rawRows: rows,
    headerRowIdx,
    columnMapping,
    validSeats: validSeatsSet,
    existingGuests: [],
    replaceExisting: true
  });

  assert.strictEqual(result.summary.errorCount, 0, 'Set B should have 0 uncorrectable errors');
  assert.strictEqual(result.importableGuests.length, 206, 'Should have 206 importable guests');
  assert.strictEqual(result.summary.totalParticipants, 863, 'Total participants should match 863');

  // Check Follower 1,200,000 parsed to number
  const guestWithLargeFollower = result.importableGuests.find(g => g.follower === 1200000);
  assert.ok(guestWithLargeFollower, 'Guest with 1,200,000 followers must be parsed as numeric 1200000');

  // Check I16-17 expanded
  const guestWithExpandedSeat = result.importableGuests.find(g => g.seats.some(s => s.code === 'I16') && g.seats.some(s => s.code === 'I17'));
  assert.ok(guestWithExpandedSeat, 'Seats I16-17 must be expanded to I16 and I17');
});

it('Dataset gala_doraemon_2026_seated.xlsx: Correctly parses seated rows with comma-separated seats ("S1, S2")', () => {
  const filePath = path.join(testFilesDir, 'gala_doraemon_2026_seated.xlsx');
  assert.ok(fs.existsSync(filePath), 'File gala_doraemon_2026_seated.xlsx must exist');

  const { rows } = parseWorkbookRows(filePath);
  const headerRowIdx = ExcelImporter.detectHeaderRow(rows);
  const columnMapping = ExcelImporter.mapColumns(rows[headerRowIdx].cells);

  const result = ExcelImporter.processImportRows({
    rawRows: rows,
    headerRowIdx,
    columnMapping,
    validSeats: validSeatsSet,
    existingGuests: [],
    replaceExisting: true
  });

  assert.strictEqual(result.summary.errorCount, 0, 'Should have 0 errors');
  assert.ok(result.importableGuests.length >= 180, 'Should have seated guests');
  assert.strictEqual(result.summary.totalSeats, 420, 'Total seats should match 420');
});

// -----------------------------------------------------------------
// Suite 6: Template Generation & Skipped Rows Export
suite('Suite 6: Template Generation & Skipped Rows Export');

it('generateTemplateExcel produces valid XLSX buffer with required template columns', async () => {
  const buf = await ExcelImporter.generateTemplateExcel(XLSX);
  assert.ok(buf instanceof Uint8Array || Buffer.isBuffer(buf), 'Must return a binary buffer');

  const wb = XLSX.read(buf, { type: 'buffer' });
  assert.ok(wb.SheetNames.includes('Guest List'), 'Workbook must contain "Guest List" sheet');
  const ws = wb.Sheets['Guest List'];
  assert.strictEqual(ws['A1'].v, 'ชื่อสื่อ / เพจ');
  assert.strictEqual(ws['B1'].v, 'ชื่อผู้รับบัตร');
  assert.strictEqual(ws['C1'].v, 'เบอร์โทร');
  assert.strictEqual(ws['D1'].v, 'ยอดผู้ติดตาม');
  assert.strictEqual(ws['E1'].v, 'ผู้ดูแล (PIC)');
  assert.strictEqual(ws['F1'].v, 'จำนวน (Pax)');
  assert.strictEqual(ws['G1'].v, 'รายละเอียด');
  assert.strictEqual(ws['H1'].v, 'ที่นั่ง (ถ้ามี)');
});

it('exportSkippedRowsExcel produces valid XLSX buffer containing skipped rows and reasons', async () => {
  const dummyHeaders = ['ชื่อสื่อ', 'จำนวน', 'รายละเอียด'];
  const dummySkipped = [
    {
      row: 5,
      reason: 'จำนวนเป็นข้อความ "VIP" (ไม่ใช่ตัวเลข)',
      originalCells: [{ text: 'เพจ A' }, { text: 'VIP' }, { text: 'เชิญพิเศษ' }]
    },
    {
      row: 8,
      reason: 'จำนวนเป็นข้อความ "ไม่ว่าง" (ไม่ใช่ตัวเลข)',
      originalCells: [{ text: 'เพจ B' }, { text: 'ไม่ว่าง' }, { text: 'ติดธุระ' }]
    }
  ];

  const buf = await ExcelImporter.exportSkippedRowsExcel(dummySkipped, dummyHeaders, XLSX);
  assert.ok(buf instanceof Uint8Array || Buffer.isBuffer(buf), 'Must return a binary buffer');

  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets['Skipped Rows'];
  assert.ok(ws, 'Workbook must contain "Skipped Rows" sheet');
  assert.strictEqual(ws['A1'].v, 'แถวในไฟล์เดิม');
  assert.strictEqual(ws['B1'].v, 'เหตุผลที่ไม่สามารถนำเข้าได้');
  assert.strictEqual(ws['C1'].v, 'ชื่อสื่อ');
  assert.strictEqual(ws['D1'].v, 'จำนวน');
  assert.strictEqual(ws['E1'].v, 'รายละเอียด');

  assert.strictEqual(ws['A2'].v, 5);
  assert.strictEqual(ws['B2'].v, 'จำนวนเป็นข้อความ "VIP" (ไม่ใช่ตัวเลข)');
  assert.strictEqual(ws['C2'].v, 'เพจ A');
  assert.strictEqual(ws['A3'].v, 8);
  assert.strictEqual(ws['C3'].v, 'เพจ B');
});

// -----------------------------------------------------------------
// Suite 7: Backend API Integration (controllers/guestController.js)
suite('Suite 7: Backend API Integration & Schema Integrity');

it('Backend guestController.importBatch preserves guest link field and returns schema stats', async () => {
  const guestController = require('../controllers/guestController');
  const { readData, writeData } = require('../services/dataService');

  // Backup current guests
  const originalGuests = await readData('guests.json');

  try {
    const mockGuestsToImport = [
      {
        name: 'ทดสอบ ลิงก์',
        organization: 'ช่อง YouTube ดัง',
        follower: 500000,
        pic: 'Ani Network',
        participant: 2,
        phone: '0899999999',
        detail: 'หมายเหตุพิเศษ',
        link: 'https://youtube.com/@channel',
        seats: [{ code: 'X24', checkedIn: false }]
      }
    ];

    let responseData = null;
    let statusCode = 200;

    const screenings = await readData('screenings.json');
    const screeningId = (screenings && screenings.length > 0) ? screenings[0].id : 'sc-1';

    const req = {
      body: {
        screeningId,
        replaceExisting: false,
        guests: mockGuestsToImport
      }
    };

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await guestController.importBatch(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.inserted, 1);
    assert.ok(typeof responseData.count === 'number');

    // Verify imported guest in DB has link
    const allGuests = await readData('guests.json');
    const found = allGuests.find(g => g.name === 'ทดสอบ ลิงก์');
    assert.ok(found, 'Imported guest must be saved to DB');
    assert.strictEqual(found.link, 'https://youtube.com/@channel', 'Guest link property must be preserved in DB');
  } finally {
    // Restore original DB state
    await writeData('guests.json', originalGuests);
  }
});

// -----------------------------------------------------------------
// Execute All Tests Sequentially
// -----------------------------------------------------------------
(async function runAll() {
  let passedTests = 0;
  let failedTests = 0;

  for (const item of tests) {
    if (item.type === 'suite') {
      console.log(`\n--- ${item.name} ---`);
      continue;
    }
    try {
      await item.fn();
      console.log(`[PASS] ${item.desc}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${item.desc}`);
      console.error(`       Error: ${err.message}`);
      failedTests++;
    }
  }

  console.log('\n===============================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} / ${passedTests + failedTests} TESTS PASSED`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
