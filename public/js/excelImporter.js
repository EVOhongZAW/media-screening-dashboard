// public/js/excelImporter.js
// Enterprise-Grade Excel (.xlsx / .xls) and CSV Ingestion Engine
// Cinema Media Screening & Seat Management System

(function (window) {
  'use strict';

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB limit
  const PHONE_LENGTH = 10; // Standard Thai mobile phone length

  // Canonical Column Keys
  const COLUMN_KEYS = {
    ORGANIZATION: 'organization',
    NAME: 'name',
    FOLLOWER: 'follower',
    PIC: 'pic',
    PARTICIPANT: 'participant',
    DETAIL: 'detail',
    SEAT: 'seat',
    PHONE: 'phone',
    IGNORE: 'ignore'
  };

  // Known Column Aliases (case-insensitive, normalized)
  const COLUMN_ALIASES = {
    [COLUMN_KEYS.ORGANIZATION]: [
      'name', 'neme', 'ชื่อ', 'ชื่อสื่อ', 'ชื่อสื่อ/เพจ', 'ชื่อสื่อ / เพจ', 'media', 'เพจ', 'องค์กร',
      'organization', 'org', 'company', 'agency'
    ],
    [COLUMN_KEYS.NAME]: [
      'name (ผู้รับบัตร)', 'ชื่อผู้รับบัตร', 'ชื่อผู้รับ', 'ผู้รับบัตร', 'ผู้ติดต่อ', 'attendee',
      'recipient', 'contact person', 'guest name'
    ],
    [COLUMN_KEYS.FOLLOWER]: [
      'follower', 'followers', 'ยอดผู้ติดตาม', 'ผู้ติดตาม', 'subscribers', 'subs'
    ],
    [COLUMN_KEYS.PIC]: [
      'pic', 'ผู้ดูแล', 'ผู้ประสานงาน', 'coordinator', 'pic (ผู้ดูแล)', 'pic/quota', 'quota owner'
    ],
    [COLUMN_KEYS.PARTICIPANT]: [
      'participant', 'จำนวน', 'โควตา', 'โควต้า', 'quota', 'ticket', 'tickets', 'qty', 'count',
      '863 confirm', 'จำนวนผู้เข้าชม', 'จำนวนคน', 'จำนวนที่นั่ง'
    ],
    [COLUMN_KEYS.DETAIL]: [
      'detail', 'details', 'รายละเอียด', 'สังกัด', 'หมายเหตุ', 'notes', 'remark', 'description'
    ],
    [COLUMN_KEYS.SEAT]: [
      'seat', 'seats', 'seat value', 'ที่นั่ง', 'seat (ที่นั่ง)', 'เลขที่นั่ง', 'seat no', 'seat number'
    ],
    [COLUMN_KEYS.PHONE]: [
      'tel', 'phone', 'telephone', 'เบอร์โทร', 'เบอร์', 'โทร', 'contact', 'mobile'
    ]
  };

  /**
   * Helper: Normalize text stripping invisible spaces and bullet characters
   */
  function normalizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/^[\s\u00A0\u200B\uFEFF\u2022\u2023\u25E6\u2043\u2024\u00B7\u2014\u2013\-\•\·]+/, '')
      .replace(/[\s\u00A0\u200B\uFEFF]+$/, '')
      .trim();
  }

  /**
   * Helper: Escape HTML strings for XSS protection
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Helper: Lazy load SheetJS library if not already present
   */
  function loadSheetJs() {
    if (typeof window.XLSX !== 'undefined') {
      return Promise.resolve(window.XLSX);
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/xlsx/xlsx.full.min.js';
      script.onload = () => {
        if (typeof window.XLSX !== 'undefined') resolve(window.XLSX);
        else reject(new Error('โหลดไลบรารี SheetJS สำเร็จแต่ไม่พบออบเจกต์ XLSX'));
      };
      script.onerror = () => reject(new Error('ไม่สามารถดาวน์โหลด /vendor/xlsx/xlsx.full.min.js จากเซิร์ฟเวอร์ได้'));
      document.head.appendChild(script);
    });
  }

  /**
   * Validate file signature (magic bytes) and file size
   */
  function validateFileSignature(buffer, fileName) {
    if (!buffer || buffer.byteLength === 0) {
      return { valid: false, code: 'EMPTY_FILE', message: 'ไฟล์มีขนาด 0 ไบต์ (ไฟล์ว่าง)' };
    }
    if (buffer.byteLength > MAX_FILE_SIZE) {
      return {
        valid: false,
        code: 'FILE_TOO_LARGE',
        message: `ขนาดไฟล์ (${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB) เกินขีดจำกัดที่อนุญาต (${MAX_FILE_SIZE / 1024 / 1024} MB)`
      };
    }

    const lowerName = (fileName || '').toLowerCase();

    // Reject .xlsm explicitly
    if (lowerName.endsWith('.xlsm')) {
      return {
        valid: false,
        code: 'MACRO_REJECTED',
        message: 'ระบบไม่อนุญาตให้นำเข้าไฟล์ที่มี Macro (.xlsm) เพื่อความปลอดภัย กรุณาบันทึกเป็นไฟล์ .xlsx ทั่วไป'
      };
    }

    const bytes = new Uint8Array(buffer.slice(0, 8));

    // Check .xlsx / zip signature: PK\x03\x04 or PK\x05\x06 or PK\x07\x08
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4B &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
       (bytes[2] === 0x05 && bytes[3] === 0x06) ||
       (bytes[2] === 0x07 && bytes[3] === 0x08));

    // Check .xls CFB signature: D0 CF 11 E0 A1 B1 1A E1
    const isCfb = bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 &&
                  bytes[4] === 0xA1 && bytes[5] === 0xB1 && bytes[6] === 0x1A && bytes[7] === 0xE1;

    if (lowerName.endsWith('.xlsx')) {
      if (!isZip) {
        return {
          valid: false,
          code: 'INVALID_XLSX_SIGNATURE',
          message: 'ไฟล์ไม่ใช่รูปแบบ Excel (.xlsx) ที่ถูกต้อง หรือไฟล์อาจเสียหาย (Magic bytes mismatch)'
        };
      }
      return { valid: true, format: 'xlsx' };
    }

    if (lowerName.endsWith('.xls')) {
      if (!isCfb) {
        return {
          valid: false,
          code: 'INVALID_XLS_SIGNATURE',
          message: 'ไฟล์ไม่ใช่รูปแบบ Excel (.xls) ที่ถูกต้อง หรือไฟล์อาจเสียหาย'
        };
      }
      return { valid: true, format: 'xls' };
    }

    if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
      return { valid: true, format: 'csv' };
    }

    // Auto-detect based on signature if extension is ambiguous
    if (isZip) return { valid: true, format: 'xlsx' };
    if (isCfb) return { valid: true, format: 'xls' };

    // Default to CSV / plain text
    return { valid: true, format: 'csv' };
  }

  /**
   * Normalize Phone Numbers (Pitfall 1)
   */
  function normalizePhoneNumber(rawVal) {
    if (rawVal === null || rawVal === undefined || String(rawVal).trim() === '') {
      return { phone: '', warning: null };
    }

    let str = String(rawVal).trim();

    // Check for scientific notation e.g. 8.91234567E+9
    if (/^[0-9.]+[eE][+-]?[0-9]+$/.test(str)) {
      const num = parseFloat(str);
      if (!isNaN(num)) {
        str = BigInt(Math.round(num)).toString();
      }
    }

    // Replace +66 prefix with 0
    str = str.replace(/^\+66/, '0');

    // Strip dashes, spaces, parentheses, slashes
    let cleaned = str.replace(/[\-\s\(\)\/\.]/g, '');

    // If Excel number dropped leading 0: length is 9 and starts with 6, 8, 9
    if (cleaned.length === 9 && /^[689]/.test(cleaned)) {
      cleaned = '0' + cleaned;
    }

    let warning = null;
    if (cleaned && cleaned.length !== PHONE_LENGTH) {
      warning = `เบอร์โทร "${cleaned}" มีความยาว ${cleaned.length} หลัก (ค่าปกติ ${PHONE_LENGTH} หลัก)`;
    }

    return { phone: cleaned, warning };
  }

  /**
   * Parse Numbers with Comma & Text Quotes (Pitfall 6)
   */
  function parseCleanNumber(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const str = String(val).replace(/,/g, '').trim();
    if (!str) return null;
    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Check if participant value is a non-numeric status (Pitfall 7)
   */
  function isNonNumericParticipant(val) {
    if (val === null || val === undefined) return false;
    const str = String(val).trim();
    if (!str) return false;
    // Common non-numeric reservation notes: VIP, เชิญ, ไม่ว่าง, ติดงาน, สละสิทธิ์, ฯลฯ
    if (/^(vip|เชิญ|ไม่ว่าง|ติดงาน|สละสิทธิ์|ยกเลิก|ไม่สะดวก|ไม่ไป|รอยืนยัน|รอคอนเฟิร์ม|cancel)$/i.test(str)) {
      return true;
    }
    // Any string without any digits at all
    return !/\d/.test(str);
  }

  /**
   * Extract participant count from text or number
   */
  function extractParticipantCount(rawVal, detailText = '') {
    if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
      const directNum = parseCleanNumber(rawVal);
      if (directNum !== null && directNum > 0) {
        return { count: directNum, isExplicit: true };
      }

      // Check regex in rawVal e.g. "(โควตา 2 ใบ) 2 ท่านค่ะ"
      const match = String(rawVal).match(/\b(\d+)\b/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > 0) return { count: num, isExplicit: true };
      }
    }

    // Fallback: search in detailText
    if (detailText) {
      const dqm = detailText.match(/(?:จำนวนผู้เข้าชม|จำนวน|โควต้า|โควตา|ที่นั่ง|ใบ|คน|ท่าน)\s*[:.•\-–—]?\s*.*?(\d+)/i);
      if (dqm) {
        const num = parseInt(dqm[1], 10);
        if (num > 0) return { count: num, isExplicit: false };
      }
    }

    return { count: 1, isExplicit: false };
  }

  /**
   * Scan first 10 rows to detect the most probable header row
   */
  function detectHeaderRow(rawRows) {
    if (!rawRows || rawRows.length === 0) return 0;
    const maxScan = Math.min(10, rawRows.length);
    let bestRowIdx = 0;
    let highestScore = -1;

    for (let r = 0; r < maxScan; r++) {
      const row = rawRows[r];
      if (!row || !row.cells || row.cells.length === 0) continue;

      let matchCount = 0;
      row.cells.forEach(cell => {
        const txt = normalizeText(cell.text || cell.val).toLowerCase();
        if (!txt) return;

        for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
          if (aliases.some(a => txt === a || txt.includes(a))) {
            matchCount++;
            break;
          }
        }
      });

      if (matchCount > highestScore) {
        highestScore = matchCount;
        bestRowIdx = r;
      }
    }

    return bestRowIdx;
  }

  /**
   * Auto-map columns in header row using alias table
   */
  function mapColumns(headerCells) {
    const mapping = {};
    if (!headerCells || !Array.isArray(headerCells)) return mapping;

    const usedKeys = new Set();

    headerCells.forEach((cell, colIdx) => {
      const text = normalizeText(cell.text || cell.val).toLowerCase();
      if (!text) {
        mapping[colIdx] = COLUMN_KEYS.IGNORE;
        return;
      }

      let matchedKey = COLUMN_KEYS.IGNORE;

      // Priority check: exact match first, then includes match
      for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (aliases.includes(text)) {
          matchedKey = key;
          break;
        }
      }

      if (matchedKey === COLUMN_KEYS.IGNORE) {
        for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
          if (aliases.some(a => text.includes(a))) {
            matchedKey = key;
            break;
          }
        }
      }

      mapping[colIdx] = matchedKey;
      if (matchedKey !== COLUMN_KEYS.IGNORE) {
        usedKeys.add(matchedKey);
      }
    });

    return mapping;
  }

  /**
   * Extract Recipient Name from Detail with fallback to Organization (Pitfall 4)
   */
  function extractRecipientName(detailText, orgName = '') {
    if (typeof window.extractAttendeeNameFromDetail === 'function') {
      const extracted = window.extractAttendeeNameFromDetail(detailText, orgName);
      if (extracted && extracted.trim()) {
        return { name: extracted.trim(), isFallback: false };
      }
    }

    // Custom fallback regex extraction
    if (detailText) {
      const match = detailText.match(/(?:ชื่อผู้รับบัตร|ผู้รับบัตร|ชื่อผู้รับ|ผู้ติดต่อ|คุณ)\s*[:.•\-–—\s]?\s*([^\r\n•·()]+)/i);
      if (match && match[1]) {
        const clean = normalizeText(match[1]).replace(/\(.*\)/, '').trim();
        if (clean.length >= 2 && !/^(?:\d+|ไม่มี|ไม่ระบุ)$/.test(clean)) {
          return { name: clean, isFallback: false };
        }
      }
    }

    // Fallback to organization if unable to isolate individual recipient
    const fallback = orgName || 'ไม่ระบุชื่อผู้รับ';
    return { name: fallback, isFallback: true };
  }

  /**
   * Expand seat ranges using standard seat range rules
   */
  function expandSeats(seatStr) {
    if (!seatStr || typeof seatStr !== 'string') return [];
    if (typeof window.expandSeatRanges === 'function') {
      const res = window.expandSeatRanges(seatStr);
      if (typeof res === 'string') {
        return res.split(/[,;/+]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      }
      if (Array.isArray(res)) return res;
    }

    // Fallback parser if window.expandSeatRanges not available
    const clean = seatStr.trim();
    if (!clean) return [];
    const tokens = clean.split(/[,;/+]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
    const result = [];

    for (const token of tokens) {
      const m1 = token.match(/^([A-Z]{1,2})\s*(\d+)\s*[-–—]\s*([A-Z]{1,2})?\s*(\d+)$/);
      if (m1) {
        const r1 = m1[1];
        const n1 = parseInt(m1[2], 10);
        const r2 = m1[3] || r1;
        const n2 = parseInt(m1[4], 10);
        if (r1 === r2 && !isNaN(n1) && !isNaN(n2)) {
          const start = Math.min(n1, n2);
          const end = Math.max(n1, n2);
          for (let n = start; n <= end; n++) {
            result.push(`${r1}${n}`);
          }
          continue;
        }
      }
      result.push(token);
    }
    return result;
  }

  /**
   * Generate Standard Downloadable Excel Template (.xlsx)
   */
  async function generateTemplateExcel(customXlsx = null) {
    const XLSXLib = customXlsx || (typeof XLSX !== 'undefined' ? XLSX : await loadSheetJs());
    const wb = XLSXLib.utils.book_new();

    const headers = [
      'ชื่อสื่อ / เพจ',
      'ชื่อผู้รับบัตร',
      'เบอร์โทร',
      'ยอดผู้ติดตาม',
      'ผู้ดูแล (PIC)',
      'จำนวน (Pax)',
      'รายละเอียด',
      'ที่นั่ง (ถ้ามี)'
    ];

    const sampleRows = [
      [
        'โกดังหนัง',
        'คุณเอ็ม',
        '081-234-5678',
        '1,200,000',
        'Ani Network',
        2,
        '• โควต้า 2 ใบ\n• รับบัตรหน้างาน',
        'I16-17'
      ],
      [
        'ผู้ชายคนนั้นจากหนังเรื่องนี้',
        'ฐิติมน มงคลสวัสดิ์',
        '089-876-5432',
        '170,000',
        'Ani Network',
        2,
        'ติดต่อรับบัตร 18:00 น.',
        'N27-28'
      ],
      [
        'Akibatan',
        'คุณบดีศร',
        '082-345-6789',
        '85,000',
        'Idol',
        2,
        'โควตาพิเศษ',
        'E7, E8'
      ],
      [
        'VIP Guest',
        'คุณสมยศ',
        '086-111-2222',
        '',
        'VIP',
        1,
        'แขกผู้มีเกียรติ',
        'AA1'
      ]
    ];

    const data = [headers, ...sampleRows];
    const ws = XLSXLib.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 30 }, // Name
      { wch: 22 }, // Recipient
      { wch: 18 }, // Tel
      { wch: 20 }, // Follower
      { wch: 18 }, // PIC
      { wch: 16 }, // Pax
      { wch: 45 }, // Detail
      { wch: 18 }  // Seat
    ];

    XLSXLib.utils.book_append_sheet(wb, ws, 'Guest List');

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && XLSXLib.writeFile) {
      try {
        XLSXLib.writeFile(wb, 'cinema_guest_template.xlsx');
      } catch (e) {
        // Environment fallback
      }
    }

    return XLSXLib.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Export Skipped/Problematic Rows as Excel file (.xlsx)
   */
  async function exportSkippedRowsExcel(skippedItems, customHeaders = null, customXlsx = null) {
    if (!skippedItems || skippedItems.length === 0) return null;
    const XLSXLib = customXlsx || (typeof XLSX !== 'undefined' ? XLSX : await loadSheetJs());
    const wb = XLSXLib.utils.book_new();

    const headers = [
      'แถวในไฟล์เดิม',
      'เหตุผลที่ไม่สามารถนำเข้าได้',
      ...(customHeaders && customHeaders.length > 0 ? customHeaders : ['ชื่อสื่อ/เพจ', 'จำนวน', 'ที่นั่ง', 'รายละเอียด', 'เบอร์โทร'])
    ];

    const dataRows = skippedItems.map(item => {
      if (item.originalCells && Array.isArray(item.originalCells)) {
        return [
          item.row || item.rowIndex || '-',
          item.reason || item.message || 'ข้อมูลไม่สมบูรณ์',
          ...item.originalCells.map(c => (c && (c.text !== undefined ? c.text : c.val)) || '')
        ];
      }
      return [
        item.row || item.rowIndex || '-',
        item.reason || item.message || 'ข้อมูลไม่สมบูรณ์',
        item.organization || item.name || '',
        item.participant !== undefined ? item.participant : '',
        item.seat || '',
        item.detail || '',
        item.phone || ''
      ];
    });

    const ws = XLSXLib.utils.aoa_to_sheet([headers, ...dataRows]);
    ws['!cols'] = [
      { wch: 14 },
      { wch: 45 },
      { wch: 28 },
      { wch: 12 },
      { wch: 16 },
      { wch: 40 },
      { wch: 18 }
    ];

    XLSXLib.utils.book_append_sheet(wb, ws, 'Skipped Rows');

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && XLSXLib.writeFile) {
      try {
        XLSXLib.writeFile(wb, 'cinema_guests_skipped_review.xlsx');
      } catch (e) {
        // Environment fallback
      }
    }

    return XLSXLib.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Main Unified Ingestion & Validation Pipeline
   * Takes raw structured rows, column mapping, existing screening guests, and layout set
   */
  function processImportRows(rawRowsOrOptions, columnMappingParam, headerRowIdxParam, optionsParam = {}) {
    let rawRows = rawRowsOrOptions;
    let columnMapping = columnMappingParam;
    let headerRowIdx = headerRowIdxParam;
    let options = optionsParam;

    if (rawRowsOrOptions && !Array.isArray(rawRowsOrOptions) && typeof rawRowsOrOptions === 'object') {
      rawRows = rawRowsOrOptions.rawRows;
      columnMapping = rawRowsOrOptions.columnMapping;
      headerRowIdx = rawRowsOrOptions.headerRowIdx !== undefined ? rawRowsOrOptions.headerRowIdx : 0;
      options = rawRowsOrOptions;
    }

    const {
      screeningId = '',
      existingGuests = [],
      replaceExisting = false,
      validSeatsSet = null,
      validSeats: validSeatsFromOpt = null
    } = options;

    const validSeats = validSeatsSet || validSeatsFromOpt || ((typeof window !== 'undefined' && window._pavalaiValidSeatsSet) ? window._pavalaiValidSeatsSet : null);

    const importableGuests = [];
    const skippedRows = [];
    const allWarnings = [];

    // Track seats within the current batch to detect internal collisions
    const batchSeatUsage = new Map(); // seatCode -> { row, guestName }

    // Map existing guests' seats if appending (not replacing)
    const existingSeatUsage = new Map();
    if (!replaceExisting && Array.isArray(existingGuests)) {
      existingGuests.forEach(g => {
        if (!g.seat) return;
        const seats = expandSeats(g.seat);
        seats.forEach(s => existingSeatUsage.set(s, g));
      });
    }

    const startIndex = headerRowIdx + 1;

    for (let r = startIndex; r < rawRows.length; r++) {
      const rowItem = rawRows[r];
      if (!rowItem || !rowItem.cells || rowItem.cells.length === 0) continue;

      const cells = rowItem.cells;
      const fileRowNumber = rowItem.rowIndex !== undefined ? rowItem.rowIndex + 1 : (r + 1);

      // Collect mapped values
      let rawOrg = '';
      let rawName = '';
      let rawFollower = '';
      let rawPic = '';
      let rawPart = '';
      let rawDetail = '';
      let rawSeat = '';
      let rawPhone = '';
      let cellLink = null;

      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c] || { val: '', text: '' };
        const key = columnMapping[c] || COLUMN_KEYS.IGNORE;
        const txt = cell.text !== undefined ? String(cell.text) : (cell.val !== undefined ? String(cell.val) : '');

        if (cell.link && !cellLink) {
          cellLink = cell.link;
        }

        switch (key) {
          case COLUMN_KEYS.ORGANIZATION:
            rawOrg = txt;
            break;
          case COLUMN_KEYS.NAME:
            rawName = txt;
            break;
          case COLUMN_KEYS.FOLLOWER:
            rawFollower = txt;
            break;
          case COLUMN_KEYS.PIC:
            rawPic = txt;
            break;
          case COLUMN_KEYS.PARTICIPANT:
            rawPart = txt;
            break;
          case COLUMN_KEYS.DETAIL:
            rawDetail = txt;
            break;
          case COLUMN_KEYS.SEAT:
            rawSeat = txt;
            break;
          case COLUMN_KEYS.PHONE:
            rawPhone = txt;
            break;
        }
      }

      // Check Pitfall 8: Blank row without any identifiable content -> skip silently
      const orgNormalized = normalizeText(rawOrg);
      const detailNormalized = rawDetail.trim();
      const seatNormalized = rawSeat.trim();

      if (!orgNormalized && !detailNormalized && !seatNormalized) {
        continue; // Silent skip, not counted as error
      }

      // Check Pitfall 7: Non-numeric participant (e.g. VIP, เชิญ, ไม่ว่าง) -> Skip & Flag
      if (isNonNumericParticipant(rawPart)) {
        skippedRows.push({
          row: fileRowNumber,
          organization: orgNormalized || 'ไม่ระบุ',
          participant: rawPart,
          seat: seatNormalized,
          detail: detailNormalized,
          phone: rawPhone,
          reason: `จำนวนระบุเป็นข้อความที่ไม่ใช่ตัวเลข ("${rawPart}") ต้องระบุจำนวนคนเป็นตัวเลข`
        });
        continue;
      }

      // Determine organization and recipient name (Pitfall 2 & 4)
      const orgVal = orgNormalized || 'ไม่ระบุสังกัด';
      let nameVal = normalizeText(rawName);
      let isRecipientFallback = false;

      if (!nameVal) {
        const extracted = extractRecipientName(detailNormalized, orgVal);
        nameVal = extracted.name;
        isRecipientFallback = extracted.isFallback;
      }

      // Participant count
      const partObj = extractParticipantCount(rawPart, detailNormalized);
      const participantCount = partObj.count;

      // Phone formatting (Pitfall 1)
      const phoneResult = normalizePhoneNumber(rawPhone);
      const phoneVal = phoneResult.phone;

      // Follower parsing
      const followerVal = parseCleanNumber(rawFollower);

      // PIC normalization
      const picVal = rawPic ? normalizeText(rawPic) : null;

      // Seat range expansion & validation
      const expandedSeats = seatNormalized ? expandSeats(seatNormalized) : [];
      const rowErrors = [];
      const rowWarnings = [];

      if (phoneResult.warning) {
        rowWarnings.push(phoneResult.warning);
      }

      if (isRecipientFallback && !rawName) {
        rowWarnings.push(`ไม่พบชื่อผู้รับบัตรในรายละเอียด จึงใช้ชื่อสื่อ "${orgVal}" แทน`);
      }

      if (expandedSeats.length > 0 && participantCount > 0 && expandedSeats.length !== participantCount) {
        rowWarnings.push(`จำนวนที่นั่ง (${expandedSeats.length} ที่) ไม่ตรงกับจำนวนผู้เข้าร่วม (${participantCount} คน)`);
      }

      // Validate each seat
      expandedSeats.forEach(s => {
        // Topology check
        if (validSeats && validSeats.size > 0 && !validSeats.has(s)) {
          rowErrors.push(`ที่นั่ง "${s}" ไม่มีในผังโรงภาพยนตร์`);
        }

        // Internal duplicate check within file
        if (batchSeatUsage.has(s)) {
          const prev = batchSeatUsage.get(s);
          rowErrors.push(`ที่นั่ง "${s}" ซ้ำกับแถวที่ ${prev.row} (${prev.name})`);
        } else {
          batchSeatUsage.set(s, { row: fileRowNumber, name: nameVal });
        }

        // External collision check with existing screening guests
        if (!replaceExisting && existingSeatUsage.has(s)) {
          const occupant = existingSeatUsage.get(s);
          const occName = occupant.name || occupant.organization || 'แขกอื่น';
          rowErrors.push(`ที่นั่ง "${s}" ชนกับคุณ ${occName} ในระบบ`);
        }
      });

      const guestRecord = {
        row: fileRowNumber,
        name: nameVal,
        organization: orgVal,
        detail: detailNormalized,
        follower: followerVal,
        pic: picVal,
        participant: participantCount,
        phone: phoneVal,
        seat: expandedSeats.length > 0 ? expandedSeats.join(', ') : '',
        seats: expandedSeats.map(code => ({ code, checkedIn: false })),
        link: cellLink,
        status: rowErrors.length > 0 ? 'error' : (rowWarnings.length > 0 ? 'warning' : 'ok'),
        errors: rowErrors,
        warnings: rowWarnings
      };

      if (rowWarnings.length > 0) {
        allWarnings.push({ row: fileRowNumber, warnings: rowWarnings });
      }

      importableGuests.push(guestRecord);
    }

    // Summary calculation
    const totalProcessed = importableGuests.length;
    const okCount = importableGuests.filter(g => g.status === 'ok').length;
    const warningCount = importableGuests.filter(g => g.status === 'warning').length;
    const errorCount = importableGuests.filter(g => g.status === 'error').length;
    const totalParticipants = importableGuests.reduce((sum, g) => sum + (g.status !== 'error' ? g.participant : 0), 0);
    const totalSeats = importableGuests.reduce((sum, g) => sum + (g.status !== 'error' ? g.seats.length : 0), 0);

    return {
      totalRows: totalProcessed + skippedRows.length,
      importableGuests,
      skippedRows,
      summary: {
        totalProcessed,
        okCount,
        warningCount,
        errorCount,
        skippedCount: skippedRows.length,
        totalParticipants,
        totalSeats,
        canConfirm: errorCount === 0 && totalProcessed > 0
      }
    };
  }

  // Export to window
  const api = {
    validateFileSignature,
    loadSheetJs,
    detectHeaderRow,
    mapColumns,
    normalizeText,
    escapeHtml,
    normalizePhoneNumber,
    extractParticipantCount,
    isNonNumericParticipant,
    extractRecipientName,
    expandSeats,
    generateTemplateExcel,
    exportSkippedRowsExcel,
    processImportRows,
    COLUMN_KEYS,
    COLUMN_ALIASES
  };

  window.ExcelImporter = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})(typeof window !== 'undefined' ? window : global);
