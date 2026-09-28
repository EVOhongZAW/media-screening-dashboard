// public/js/excelWorker.js
// Web Worker for off-thread Excel (.xlsx / .xls) parsing using vendored SheetJS

/* global XLSX, importScripts */

let xlsxLoaded = false;

function ensureXlsx() {
  if (xlsxLoaded && typeof XLSX !== 'undefined') return true;
  try {
    importScripts('/vendor/xlsx/xlsx.full.min.js');
    xlsxLoaded = typeof XLSX !== 'undefined';
    return xlsxLoaded;
  } catch (err) {
    try {
      importScripts('../vendor/xlsx/xlsx.full.min.js');
      xlsxLoaded = typeof XLSX !== 'undefined';
      return xlsxLoaded;
    } catch (err2) {
      throw new Error('ไม่สามารถโหลดไลบรารี SheetJS ภายใน Web Worker: ' + err2.message);
    }
  }
}

/**
 * Check if workbook has macros (VBA)
 */
function hasMacros(wb) {
  if (!wb) return false;
  if (wb.vbaraw) return true;
  if (wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.CodeName) return true;
  return false;
}

/**
 * Propagate merged cell values so all covered cells inherit the master value
 */
function propagateMergedCells(ws) {
  if (!ws || !ws['!merges'] || !Array.isArray(ws['!merges'])) return;
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
          l: masterCell.l ? { ...masterCell.l } : undefined,
          _fromMerge: true
        };
      }
    }
  });
}

/**
 * Extract sheet rows as structured 2D array of cell objects:
 * { val: String/Number, text: String, link: String|null, raw: any }
 */
function extractSheetData(ws) {
  if (!ws || !ws['!ref']) return [];
  propagateMergedCells(ws);

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

        if (text || val || link) {
          hasContent = true;
        }

        row.push({
          val,
          text,
          link,
          type: cell.t || 's',
          isFormula: !!cell.f
        });
      }
    }

    if (hasContent) {
      rows.push({ rowIndex: R, cells: row });
    }
  }

  return rows;
}

self.onmessage = function (e) {
  const { action, fileData, sheetName, fileName } = e.data;

  try {
    ensureXlsx();

    if (action === 'parse') {
      const wb = XLSX.read(fileData, {
        type: 'array',
        cellFormula: false,
        cellHTML: false,
        cellText: true,
        cellStyles: false
      });

      // Check macro
      if (hasMacros(wb)) {
        self.postMessage({
          success: false,
          code: 'MACRO_DETECTED',
          message: 'ไฟล์นี้มี Macro (.xlsm / VBA) ซึ่งระบบไม่อนุญาตให้นำเข้าเพื่อความปลอดภัย กรุณาบันทึกเป็นไฟล์ .xlsx ทั่วไป'
        });
        return;
      }

      const sheetNames = wb.SheetNames || [];
      if (sheetNames.length === 0) {
        self.postMessage({
          success: false,
          code: 'EMPTY_WORKBOOK',
          message: 'ไฟล์ไม่มีแผ่นงาน (Sheet) ใดๆ อยู่เลย'
        });
        return;
      }

      // Gather sheet info with row counts
      const sheetsInfo = sheetNames.map(name => {
        const ws = wb.Sheets[name];
        let rowCount = 0;
        if (ws && ws['!ref']) {
          const r = XLSX.utils.decode_range(ws['!ref']);
          rowCount = Math.max(0, r.e.r - r.s.r + 1);
        }
        return { name, rowCount };
      });

      // Pick target sheet: specified, or first sheet with rows > 0, or first sheet
      const targetName = sheetName || (sheetsInfo.find(s => s.rowCount > 0) || sheetsInfo[0]).name;
      const targetWs = wb.Sheets[targetName];
      const extractedRows = extractSheetData(targetWs);

      self.postMessage({
        success: true,
        fileName,
        sheets: sheetsInfo,
        selectedSheet: targetName,
        rows: extractedRows
      });
    } else {
      self.postMessage({ success: false, message: 'Unknown action: ' + action });
    }
  } catch (err) {
    self.postMessage({
      success: false,
      code: 'PARSE_ERROR',
      message: 'เกิดข้อผิดพลาดในการเปิดไฟล์ Excel: ' + (err.message || String(err))
    });
  }
};
