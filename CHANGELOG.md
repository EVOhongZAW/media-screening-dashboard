# Changelog

All notable changes to the **Cinema Media Screening & Unified Seat Management Dashboard** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-28

### Added
- **Enterprise Excel (.xlsx / .xls) & CSV Ingestion Pipeline**:
  - Vendored [SheetJS (xlsx v0.20.3)](public/vendor/xlsx/xlsx.full.min.js) with zero CDN dependency for reliable on-site offline operations.
  - Off-thread parsing via Web Worker (`public/js/excelWorker.js`) with automatic main thread fallback.
  - Zero-overhead lazy loading: SheetJS is dynamically imported only when the import modal is opened.
  - Comprehensive resolution of 10 classic spreadsheet pitfalls:
    1. Phone numbers: Restores dropped leading `0` and converts scientific notation (`8.91E+08` $\rightarrow$ `0891234567`).
    2. Hyperlinked Media Name: Extracts visible label as `organization` and target URL into dedicated `link` field.
    3. Merged Cells (`!merges`): Automatically propagates master cell values across all merged spans.
    4. Formula Cells: Reads evaluated cached values (`cell.w` / `cell.v`) without executing formulas.
    5. Multiline Detail & Recipient Extraction: Preserves line breaks and bullets, parses attendee name, and falls back to organization.
    6. Number Parsing: Handles comma-separated numbers (`"1,200,000"` $\rightarrow$ `1200000`) and embedded counts (`"(โควตา 2 ใบ)"` $\rightarrow$ `2`).
    7. Non-numeric Participant Filter: Detects status strings ("VIP", "เชิญ", "ไม่ว่าง", "ติดงาน") and moves them to reviewable skipped rows.
    8. Silent Blank Row Filtering: Discards empty rows without cluttering validation logs.
    9. Magic Byte Security: Rejects `.xlsm` and macro payloads via file header inspection (`validateFileSignature`).
    10. Two-level Seat Collision Check: Verifies topology against Siam Pavalai 1,164 seats, flags internal file duplicates, and identifies database collisions.
- **Nearby Seat Auto-Suggestion (`findNearbyAvailableSeats`)**:
  - Automatically identifies contiguous available seats in the same row/zone when collisions occur.
  - Interactive `.suggested-seats-badge` in preview table enables 1-click replacement.
- **Spreadsheet Tools**:
  - "ดาวน์โหลดเทมเพลต Excel" (`cinema_guest_template.xlsx`) with sample data and instructions.
  - "ส่งออกแถวที่ข้าม" (`cinema_guests_skipped_review.xlsx`) with row numbers and exact reasons.
- **REST Bulk Delete Endpoint**:
  - `DELETE /api/guests?screeningId=` added to query-based guest removal with safety snapshot and audit logging.
- **Configurable Phone Length**:
  - `PHONE_LENGTH` environment variable support in `.env.example`, `middleware/validator.js`, and `controllers/guestController.js`.

### Changed
- **Backend Import API (`POST /api/guests/import`)**:
  - Added support for `link` field persistence and structured reports (`{ inserted, count, skipped, warnings }`).
  - Enforced atomic snapshot creation before replacing screening guests.
- **Test Suite Expansion**:
  - Added `scripts/verify_excel_import.js` (40 comprehensive automated test cases).
  - Total automated test suite expanded to 383 tests (100% pass rate).

---

## [1.1.0] - 2026-09-28

### Added
- **Performance Overhaul for On-Site Devices (iPad / Mid-spec Laptops)**:
  - Zero-dependency HTTP Gzip/Deflate compression via Node.js built-in `zlib` middleware (payload reduced by 85.3% from 576.7 KB to 84.7 KB).
  - Static asset caching (`Cache-Control: public, max-age=86400`) and ETag validation for instant 304 reloads.
  - Elimination of 1,164 GPU compositing layers by removing `will-change: opacity` and scoped glassmorphism blur removal.
  - Targeted $O(1)$ seat DOM mutations via `_seatElementMap` avoiding full 1,164-seat re-rendering.
  - Container-level CSS attribute filter switching (`data-cat-filter`, `data-seat-filter`) in 1.4 ms.
  - Debounced search (180ms) with lowercase token indexing.
- **Precision Seat Map Alignment**:
  - Embedded projection room element within Row B between B15 and B16 inside the CSS grid to ensure identical row height and alignment.
  - Twin row labels for Row VP / AA with left (`VP`) and right (`AA`) badge rendering.

### Fixed
- Fixed vertical alignment discrepancy between left/right row labels and seats in Row B and Balcony tier.
- Fixed layout shift caused by multiline text in guest list table via fixed column proportions and CSS ellipsis truncation.

---

## [1.0.0] - 2026-09-24

### Added
- **Dark Cinema Glassmorphism UI/UX Overhaul**:
  - Centralized design tokens in `public/css/tokens.css`.
  - WCAG AA compliant contrast ratios and touch-friendly targets ($\ge 44\text{px}$).
- **Smart Seat Tooltip & Collision Flip Engine**:
  - Viewport boundary collision detection with vertical flip (`placement: bottom` for top rows).
  - Horizontal viewport clamping and dynamic pointer arrow alignment (`--arrow-x`).
  - Portal Pattern implementation attaching `#seatHoverCard` directly to `document.body`.
- **Seat Category Colors v2**:
  - Single source of truth configuration in `public/js/seatCategoryColors.js`.
  - 6 quota categories: Ani Network (`#443BF6`), Idol (`#EC4899`), Lucky Draw (`#FFD500`), Phoenix Next (`#00DAFF`), Blessing Studio (`#A4E629`), VIP (`#CFA82B`).
  - Auto-contrast calculation for text readability based on relative luminance.
  - Interactive legend filter with live quota counts.
- **Per-Seat Partial Check-In System**:
  - Schema migration to per-seat tracking (`seats: [{ code, checkedIn }]`).
  - 3-tier status badges (`not-checked`, `partial`, `complete`).
  - Dedicated partial check-in modal with individual seat checkboxes.
  - Endpoint `PUT /api/guests/:id/seats/:seatCode/checkin` for atomic per-seat toggle.
- **Google Sheets 6-Column Import & Table Improvements**:
  - Mapping for Name, Follower, PIC, Detail, Participant, Seat, Tel, and Sign.
  - Sorting by Follower count.

### Breaking Changes
- **Guest Seat Schema**:
  - Changed `guest.seat` string and `guest.attended` boolean to `guest.seats: [{ code: string, checkedIn: boolean }]`.
  - **Migration Path**: Run `node scripts/migrate_seats_schema.js --apply` to automatically migrate legacy data with a timestamped backup. Backward-compatible accessors (`guest.seat`, `guest.attended`, `guest.attendedCount`, `guest.attendedSeats`) are maintained by `computeGuestStatus`.

---

## [0.9.0] - 2026-09-18

### Added
- **Siam Pavalai 1,164-Seat Engine**:
  - Grand Stalls (919 seats) and Royal Balcony (245 seats) topology based on `data/pavalai_layout.json`.
- **Unified Tri-Modal SeatPicker**:
  - Auto-recommendation, interactive map, and manual dropdown.
- **On-site Operations Suite**:
  - Walk-in registration with parity lock.
  - Seat move engine with 409 conflict detection and adjacent suggestions.
  - Safety snapshots and audit trail (`data/activity_logs.json`).

---

## Known Issues / Pending Decisions (ยังไม่ได้ทำ / รอการตัดสินใจ)

1. **Configurable Phone Length via UI Setting**:
   - ปัจจุบันรองรับตัวแปรสภาพแวดล้อม `PHONE_LENGTH=10` ใน `.env` และโค้ด Backend/Validator แต่ยังไม่มีหน้าตั้งค่าใน UI เพื่อให้ผู้ดูแลระบบปรับเปลี่ยนความยาวเบอร์โทรสำหรับงานอีเวนต์ต่างประเทศได้โดยไม่ต้องแก้ไฟล์ Configuration.
2. **Audit Log Export to Excel/CSV**:
   - ประวัติกิจกรรม (`data/activity_logs.json`) ถูกบันทึกครบถ้วนในฐานข้อมูล แต่ยังไม่มีปุ่มส่งออกรายงาน Audit Log ออกมาเป็นไฟล์ Excel หลังจบงาน.
3. **Database Migration to SQLite / PostgreSQL for Ultra-High Concurrency**:
   - ปัจจุบันแก้ปัญหา Concurrency ในระดับ Node.js ด้วย Sequential Promise Queue และ In-Memory Cache ได้อย่างมีประสิทธิภาพ แต่สำหรับระบบที่ขยายเป็น Multi-instance หรือ Cluster ในอนาคต จะต้องพิจารณาเปลี่ยน File DB เป็น Client-Server Database.
