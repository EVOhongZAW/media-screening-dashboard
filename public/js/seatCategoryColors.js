/**
 * Seat Category Color Coding Config (Single Source of Truth) — Latest Version
 * Maps quota category / PIC to designated colors and dynamic contrast text colors.
 * Compatible with browser (window.SeatCategoryColors) and Node.js (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SeatCategoryColors = factory();
  }
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /**
   * Calculates optimal text color (#ffffff or #0f172a) based on background color luminance.
   * Uses ITU-R BT.709 relative luminance formula with gamma expansion:
   * Y = 0.2126 * R + 0.7152 * G + 0.0722 * B
   */
  function getContrastTextColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
    let clean = hexColor.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return '#ffffff';

    const r = parseInt(clean.substring(0, 2), 16) / 255;
    const g = parseInt(clean.substring(2, 4), 16) / 255;
    const b = parseInt(clean.substring(4, 6), 16) / 255;

    // Linearize RGB components (sRGB gamma expansion)
    const toLinear = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

    // WCAG contrast threshold: colors with L > 0.35 require dark text for readability
    return L > 0.35 ? '#0f172a' : '#ffffff';
  }

  // 6 Primary Quota / PIC Categories (Ordered: Ani Network -> Idol -> Lucky Draw -> Phoenix Next -> Blessing Studio -> VIP)
  const CATEGORIES = [
    {
      key: 'aninetwork',
      name: 'Ani Network',
      color: '#443BF6', // น้ำเงินเข้มสด
      textColor: getContrastTextColor('#443BF6'), // #ffffff
      aliases: ['aninetwork', 'ani network', 'ani-network', 'ani_network', 'ani']
    },
    {
      key: 'idol',
      name: 'Idol',
      color: '#EC4899', // ชมพู
      textColor: getContrastTextColor('#EC4899'), // #ffffff
      aliases: ['idol', 'idols', 'idol group', 'ไอดอล']
    },
    {
      key: 'luckydraw',
      name: 'Lucky Draw',
      color: '#FFD500', // เหลืองสด
      textColor: getContrastTextColor('#FFD500'), // #0f172a (dark text for high contrast)
      aliases: ['luckydraw', 'lucky draw', 'lucky-draw', 'lucky', 'draw', 'ลักกี้ดรอว์', 'จับฉลาก', 'กิจกรรม']
    },
    {
      key: 'phoenixnext',
      name: 'Phoenix Next',
      color: '#00DAFF', // ฟ้า (Cyan สด)
      textColor: getContrastTextColor('#00DAFF'), // #0f172a (dark text for high contrast)
      aliases: ['phoenixnext', 'phoenix next', 'phoenix-next', 'phoenix', 'ฟีนิกซ์']
    },
    {
      key: 'blessingstudio',
      name: 'Blessing Studio',
      color: '#A4E629', // เขียวอ่อน (Lime สด)
      textColor: getContrastTextColor('#A4E629'), // #0f172a (dark text for high contrast)
      aliases: ['blessingstudio', 'blessing studio', 'blessing-studio', 'blessing_studio', 'blessing', 'เบลสซิ่ง']
    },
    {
      key: 'vip',
      name: 'VIP',
      color: '#CFA82B', // ทอง
      textColor: getContrastTextColor('#CFA82B'), // #0f172a (dark text for high contrast)
      aliases: ['vip', 'v.i.p.', 'v.i.p', 'วีไอพี', 'แขก vip']
    }
  ];

  // Default / Unmatched Category
  const DEFAULT_CATEGORY = {
    key: 'other',
    name: 'อื่นๆ / ไม่ระบุ',
    color: '#475569',
    textColor: '#ffffff',
    isDefault: true
  };

  /**
   * Normalizes input: trims, lowercases, strips spaces, hyphens, underscores, dots.
   * e.g. "Blessing Studio" -> "blessingstudio", "V.I.P." -> "vip"
   */
  function normalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.trim().toLowerCase().replace(/[\s\-_.]/g, '');
  }

  /**
   * Matches PIC string against the 6 known categories.
   * Returns category object if matched, or null.
   */
  function matchCategory(picValue) {
    if (!picValue || typeof picValue !== 'string') return null;
    const clean = picValue.trim().toLowerCase();
    const norm = normalize(picValue);
    if (!norm) return null;

    // 1. Direct exact or normalized match
    for (const cat of CATEGORIES) {
      if (cat.key === norm) return cat;
      for (const alias of cat.aliases) {
        if (clean === alias || normalize(alias) === norm) {
          return cat;
        }
      }
    }

    // 2. Substring containment match (e.g. "Ani Network (สื่อ)" -> contains "aninetwork")
    for (const cat of CATEGORIES) {
      for (const alias of cat.aliases) {
        const normAlias = normalize(alias);
        if (normAlias.length >= 3 && norm.includes(normAlias)) {
          return cat;
        }
      }
    }

    return null;
  }

  /**
   * Single Source of Truth helper as requested:
   * function getSeatCategoryColor(picValue) -> returns hex string (e.g. '#443BF6') or 'default'
   */
  function getSeatCategoryColor(picValue) {
    const cat = matchCategory(picValue);
    return cat ? cat.color : 'default';
  }

  /**
   * Detailed info helper:
   * returns { key, name, color, textColor, isDefault }
   */
  function getSeatCategoryInfo(picValue) {
    const cat = matchCategory(picValue);
    if (cat) {
      return {
        key: cat.key,
        name: cat.name,
        color: cat.color,
        textColor: cat.textColor || getContrastTextColor(cat.color),
        isDefault: false
      };
    }
    return {
      ...DEFAULT_CATEGORY,
      rawPic: picValue || null
    };
  }

  return {
    CATEGORIES,
    DEFAULT_CATEGORY,
    normalize,
    getContrastTextColor,
    matchCategory,
    getSeatCategoryColor,
    getSeatCategoryInfo
  };
});
