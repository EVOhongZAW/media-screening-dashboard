# 🎬 ระบบบริหารจัดการรอบสื่อมวลชนและผังที่นั่งโรงภาพยนตร์
### (Cinema Media Screening & Unified Seat Management Dashboard)

ระบบเว็บแอปพลิเคชันบริหารจัดการรอบฉายภาพยนตร์สำหรับสื่อมวลชน (Press Screening), ครีเอเตอร์, เพจรีวิว, และแขกรับเชิญพิเศษ ออกแบบมาสำหรับการปฏิบัติการหน้างานจริง (On-site Event Operations) บนแท็บเล็ต/iPad และคอมพิวเตอร์ ด้วยสถาปัตยกรรม **Vanilla JS High-Performance Engine** สไตล์ **Dark Cinema Glassmorphism**

รองรับผังที่นั่งขนาดจริงของ **โรงภาพยนตร์สยามภาวลัย รอยัล แกรนด์ เธียเตอร์ (Siam Pavalai Royal Grand Theatre) พารากอน ซีนีเพล็กซ์ จำนวน 1,164 ที่นั่ง** พร้อมระบบนำเข้าข้อมูล 6 คอลัมน์จาก Google Sheet, ระบบสีที่นั่งแยกหมวดหมู่โควตา (PIC Quota Colors), ระบบเช็คอินรายที่นั่ง (Per-Seat Partial Check-in), และ Smart Tooltip คำนวณขอบจออัตโนมัติ

---

## 🌟 จุดเด่นและฟีเจอร์สำคัญ (Core Highlights)

### 🪑 1. ผังโรงภาพยนตร์สยามภาวลัยขนาดจริง 1,164 ที่นั่ง (Siam Pavalai Real Topology)
- โครงสร้างผังจำลองเสมือนจริงของโรงภาพยนตร์ขนาดใหญ่ที่สุดในเอเชียตะวันออกเฉียงใต้:
  - **Grand Stalls (ชั้นล่าง)**: 919 ที่นั่ง (แถว A – S รวม 19 แถว มีทางเดินกลางและทางเดินข้าง)
  - **Royal Balcony (ชั้นบน)**: 245 ที่นั่ง (แถว AA – EE รวม 5 แถว พร้อมเก้าอี้คู่ Royal Suite)
- **Ultra-light DOM Architecture**: โครงสร้างปุ่มเก้าอี้แบบ `button.cinema-seat > span.seat-num` เพียง 1 ชั้น ไม่ใช้ virtual DOM หรือ library ภายนอก ทำให้เรนเดอร์ 1,164 ที่นั่งได้อย่างลื่นไหล 60 FPS
- **Interactive Tier Tabs**: สลับมุมมองระหว่าง *ทั้งหมด (1,164 ที่นั่ง)*, *เฉพาะชั้นล่าง Stalls (919 ที่นั่ง)*, หรือ *เฉพาะชั้นลอย Balcony (245 ที่นั่ง)*
- **Smart Filter Chips**: กรองเก้าอี้ตามประเภท (*Paragon VIP*, *Privilege*, *Standard*, *เช็คอินแล้ว*, *ที่นั่งว่าง*)

---

### 🎨 2. ระบบสีที่นั่งตามหมวดหมู่โควตา/ผู้ดูแล (Seat Category Colors v2)
ระบบกำหนดสีที่นั่งตามผู้ดูแลโควตา (PIC / Category) โดยอ้างอิงจากฐานข้อมูลกลางชุดเดียว ([`public/js/seatCategoryColors.js`](file:///c:/MOVIE%202/WEB%20moive/public/js/seatCategoryColors.js)):

| หมวดหมู่ (PIC / Category) | โทนสี | Hex Code | สีตัวอักษร |
|---|---|---|---|
| **Ani Network** | น้ำเงินเข้มสด | `#443BF6` | ขาว (`#ffffff`) |
| **Idol** | ชมพูสดใส | `#EC4899` | ขาว (`#ffffff`) |
| **Lucky Draw** | เหลืองสด | `#FFD500` | เข้ม (`#0f172a`) |
| **Phoenix Next** | ฟ้า cyan สว่าง | `#00DAFF` | เข้ม (`#0f172a`) |
| **Blessing Studio** | เขียวอ่อน lime | `#A4E629` | เข้ม (`#0f172a`) |
| **VIP** | ทองหรูหรา | `#CFA82B` | เข้ม (`#0f172a`) |
| **อื่นๆ / ไม่ระบุ** | สีเทาเข้ม (Default) | `#334155` | ขาว (`#ffffff`) |
| **ที่นั่งว่าง (ไม่มีแขกจอง)** | สีเดิมตามผังโรง | — | ตามโซนผัง |

- **Auto Contrast Calculation**: คำนวณความสว่าง (Relative Luminance) อัตโนมัติเพื่อให้สีตัวเลขบนเก้าอี้อ่านง่าย ได้มาตรฐาน WCAG AA
- **Checked-in Coexistence**: เมื่อแขกเช็คอินแล้ว เก้าอี้จะยังคงสีของหมวดหมู่โควตาไว้ แต่เพิ่มกรอบไฟนีออนสีเขียวมรกต (`#10b981`) พร้อมไอคอนเครื่องหมายถูก `✓`
- **Interactive Category Legend**: แถบปุ่มหมวดหมู่ด้านล่างผัง คลิกเพื่อไฮไลต์เฉพาะที่นั่งของหมวดหมู่นั้นๆ และลดความสว่าง (Dim) เก้าอี้หมวดอื่น

---

### 🪟 3. Smart Seat Tooltip & Collision Flip Engine
ระบบพรีวิวข้อมูลแขกเมื่อนำเมาส์ไปชี้ที่นั่งบนผังโรงภาพยนตร์:
- **Vertical Collision Flip**: ตรวจจับระยะขอบหน้าจอ (Viewport Collision) หากชี้แถวด้านบนสุด (เช่น แถว X, W, V) การ์ดจะสลับลงมาแสดงด้านล่างเก้าอี้ (`placement: bottom`) อัตโนมัติ เพื่อไม่ให้ข้อความโดนตัดพ้นขอบจอ
- **Horizontal Viewport Clamping**: ล็อกไม่ให้การ์ดหลุดขอบซ้ายหรือขวาของจอ แม้ชี้เก้าอี้ริมสุด
- **Dynamic Arrow Pointer**: เข็มชี้ (`--arrow-x`) คำนวณพิกัดให้ชี้ตรงกับกึ่งกลางของเก้าอี้เสมอ
- **Portal Pattern Architecture**: การ์ด Tooltip ถูกย้ายมาอยู่ที่ระดับ Root (`<body>`) โดยตรง เพื่อป้องกันปัญหา Coordinate Mismatch จาก CSS `transform` ใน ancestor containers
- **Internal Dark Scrollbar**: รองรับการเลื่อนอ่านรายชื่อแขกและที่นั่งยาวๆ ได้ในการ์ด (`max-height: min(60vh, 320px)`) โดยไม่ดัน Layout หน้าเว็บ
- **Passive Scroll Dismissal**: ซ่อนการ์ดทันทีที่มีการ Scroll หรือคลิกเลือกที่นั่ง

---

### 📊 4. โครงสร้างข้อมูล 6 คอลัมน์จาก Google Sheet & ตารางรายชื่อแขก
รองรับโครงสร้างข้อมูลที่ดึงมาจาก Google Sheet ต้นทางโดยตรง:
1. **Name (ชื่อแขก)**: ชื่อสื่อ, เพจรีวิว, หรือแคมเปญ พร้อมลิงก์ไปหน้าเพจจริง (Map เป็น `organization`)
2. **Follower**: จำนวนผู้ติดตาม (ตัวเลข) รองรับการคลิกหัวตารางเพื่อเรียงลำดับ (Sort Asc/Desc)
3. **PIC (ผู้ดูแล)**: ชื่อผู้ดูแลโควตา พร้อมป้ายแท็กและ Dropdown กรองข้อมูล (`#filterPic`)
4. **Detail (รายละเอียด)**: เนื้อหารายละเอียด, สังกัด, ผู้ติดต่อ ระบบตัดข้อความยาวด้วย Ellipsis พร้อม Tooltip อ่านฉบับเต็ม
5. **Participant**: จำนวนโควตาที่ได้รับ (คน)
6. **Seat (ที่นั่ง)**: ที่นั่งที่จัดสรร รองรับการระบุช่วงอัตโนมัติ เช่น `I16-17`, `B16-B18`, `AA1-AA3`
7. **Tel (เบอร์โทร)**: เบอร์โทรศัพท์ 10 หลักตามมาตรฐานมือถือไทย (`08x`, `09x`, `06x`) คลิกโทรออกได้ทันที
8. **Sign (เช็คอิน)**: ปุ่มสถานะการเซ็นชื่อ 3 ระดับ (`รอเซ็น`, `มาบางส่วน x/y`, `เซ็นครบ ✓`)

---

### 🎟️ 5. ระบบเช็คอินแยกรายที่นั่ง (Per-Seat Partial Check-in)
แก้ปัญหาคลาสสิกของระบบลงทะเบียน เมื่อสื่อ 1 รายได้โควตา 2 ที่นั่ง (`Participant: 2`) แต่ทีมงานเดินทางมาไม่พร้อมกัน:
- **Per-Seat Status Array**: จัดเก็บในรูปแบบ `seats: [{ code: "I16", checkedIn: true }, { code: "I17", checkedIn: false }]`
- **1-Click Seat Toggle**: ติ๊กเช็คอินหรือยกเลิกเช็คอินเฉพาะที่นั่งได้โดยตรงจาก Side Panel ของผังที่นั่ง
- **Partial Check-in Modal**: หน้าต่างติ๊กเลือกเฉพาะคนที่มาถึง พร้อมปุ่ม *เลือกทั้งหมด* / *ล้างทั้งหมด*
- **Real-time DOM Sync**: อัปเดตสีเก้าอี้เฉพาะตัวที่เช็คอินบนผังที่นั่งทันที โดยไม่ต้องโหลดหรือเรนเดอร์ผัง 1,164 ที่นั่งใหม่

---

### 🎯 6. ระบบจัดที่นั่งอัตโนมัติ & Walk-in คณะสื่อมวลชน
- **Auto-Assign Unseated Guests**: อัลกอริทึมจัดสรรที่นั่งว่างติดกันให้แขกที่ยังไม่มีที่นั่งแบบ 1 คลิก โดยคำนึงถึงขนาดกลุ่มและความต่อเนื่องของแถว
- **Walk-in Group Parity Lock**: ป้องกันความผิดพลาดหน้างาน บังคับให้จำนวนเก้าอี้ที่เลือกต้องตรงกับจำนวนโควตาของกลุ่ม
- **Non-Destructive 409 Conflict Recovery**: หากเจ้าหน้าที่หลายเครื่องแย่งเลือกเก้าอี้ตัวเดียวกัน ระบบจะแจ้งเตือนและคงเก้าอี้ตัวที่ไม่ชนไว้ ให้เลือกเฉพาะตัวที่ชนใหม่โดยไม่ต้องกรอกข้อมูลซ้ำ

---

### 💎 7. Design System กลาง (Dark Cinema Glassmorphism)
- รวมศูนย์การตั้งค่าที่ [`public/css/tokens.css`](file:///c:/MOVIE%202/WEB%20moive/public/css/tokens.css) ครบถ้วน: Palette, Spacing, Typography, Radii, Elevation
- **Mobile/Tablet Touch-friendly**: ทุกปุ่ม Action และ Input ช่องค้นหา ออกแบบให้มี Touch Target ขั้นต่ำ $\ge 40\text{--}44\text{px}$ เหมาะกับการถือ iPad ตรวจแขกหน้างาน
- **Visual Button Hierarchy**:
  - *Primary (ทอง)*: ปุ่มบันทึกและเพิ่มข้อมูลหลัก
  - *Walk-in (Teal)*: ปุ่มลงทะเบียนหน้างานด่วน
  - *Auto-Assign (ม่วง/ทอง)*: ปุ่มจัดที่นั่งอัตโนมัติ
  - *Secondary (กระจกใส)*: ปุ่มนำเข้าข้อมูลและตั้งค่า
  - *Danger Soft (แดงเตือน)*: ปุ่มล้างข้อมูลรอบฉาย แยกสัดส่วนเพื่อกันการกดพลาด
- **WCAG AA Compliance**: คอนทราสต์ตัวอักษรคมชัดบนพื้นหลังมืด พร้อม Focus Ring ชัดเจนเวลาแตะ

---

## 🏗️ Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (BROWSER / IPAD)                        │
│                                                                         │
│   ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────┐ │
│   │   หน้า 1: ภาพรวมงาน   │ │   หน้า 2: ผังที่นั่ง   │ │ หน้า 3: แขก   │ │
│   │   (Overview & KPIs)   │ │  (1,164-seat Engine)  │ │ (Guest List)  │ │
│   └───────────────────────┘ └───────────────────────┘ └───────────────┘ │
│                                                                         │
│   Design Tokens (tokens.css) │ Category Colors (seatCategoryColors.js) │
│   Vanilla JS Single Page App │ Zero Heavy Runtime Frameworks (60 FPS)   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST APIs
┌────────────────────────────────────▼────────────────────────────────────┐
│                        NODE.JS / EXPRESS.JS BACKEND                     │
│                                                                         │
│   Routes:       /api/screenings  │  /api/guests  │  /api/seats          │
│   Controllers:  screening, guest, seat, branch                          │
│   Services:     seatService (Heuristics), statsService, dataService     │
│   Storage:      Asynchronous Atomic JSON Store with In-memory Mutex     │
└─────────────────────────────────────────────────────────────────────────┘
```

| เลเยอร์ | เทคโนโลยี | รายละเอียด |
|---|---|---|
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 | Single Page Application (SPA) ความเร็วสูงพิเศษ ปราศจาก overhead ของ Framework |
| **Design System** | CSS Custom Properties (Tokens), Flexbox, CSS Grid | Dark Cinema Glassmorphism, 4px Spacing Scale, Touch Target $\ge 44\text{px}$ |
| **Backend** | Node.js, Express.js | RESTful APIs, Error Handling Middleware, Express Validator |
| **Algorithms** | Heuristic Adjacency & Viewport Collision | แนะนำกลุ่มที่นั่งติดกัน และคำนวณการหลบขอบจอของ Tooltip |
| **Storage** | Atomic JSON File Store | ปลอดภัยด้วย Mutex Lock ป้องกันการเขียนทับพร้อมกัน |
| **Testing** | Node.js Native Test Suites | 10 ชุดทดสอบ 343 ข้อ ครอบคลุมการทำงานทุกส่วน (100% Pass Rate) |

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
WEB moive/
├── controllers/
│   ├── branchController.js         # จัดการข้อมูลสาขาโรงภาพยนตร์
│   ├── guestController.js          # จัดการแขก, Follower, PIC, Check-in, Walk-in
│   ├── screeningController.js      # จัดการรอบฉายภาพยนตร์
│   └── seatController.js           # จัดการที่นั่ง, Heuristic Recs, Auto-assign
├── data/
│   ├── activity_logs.json          # ประวัติการทำงาน (Audit Trail)
│   ├── branches.json               # ข้อมูลสาขา
│   ├── guests.json                 # ข้อมูลแขกและสถานะที่นั่ง (seats schema v2)
│   ├── pavalai_layout.json         # ผังโรงภาพยนตร์สยามภาวลัย 1,164 ที่นั่ง
│   └── screenings.json             # ข้อมูลรอบฉาย
├── middleware/
│   ├── errorHandler.js             # กลไกจัดการข้อผิดพลาดและส่ง HTTP Status
│   └── validator.js                # ตรวจสอบ Input Request และเบอร์โทร 10 หลัก
├── public/
│   ├── css/
│   │   ├── tokens.css              # 🎨 Centralized Design System Tokens
│   │   └── style.css               # ธีม Dark Cinema Glassmorphism, ผังโรง, ตารางแขก
│   ├── data/
│   │   └── pavalai_layout.json     # ผังที่นั่งสำหรับ Client Cache
│   ├── js/
│   │   ├── api.js                  # Fetch Wrapper สำหรับสื่อสารกับ Backend API
│   │   ├── app.js                  # ตัวควบคุมหลักฝั่ง UI, Event Handlers, Tooltips
│   │   ├── seatCategoryColors.js   # 🎨 Single Source of Truth หมวดหมู่สีที่นั่ง
│   │   ├── seat-picker.js          # Unified Tri-modal SeatPicker Component
│   │   └── table.js                # โมดูลจัดการตารางแขก
│   └── index.html                  # หน้าแดชบอร์ดหลัก (Portal Pattern Tooltip)
├── routes/
│   ├── branchRoutes.js             # API Routes: /api/branches
│   ├── guestRoutes.js              # API Routes: /api/guests
│   ├── screeningRoutes.js          # API Routes: /api/screenings
│   └── seatRoutes.js               # API Routes: /api/seats
├── scripts/                        # 🧪 ชุดทดสอบอัตโนมัติ (Automated Verification)
│   ├── migrate_seats_schema.js     # สคริปต์ไมเกรต seats schema พร้อม Backup
│   ├── verify_group_seats.js       # Suite 1: Group seat engine (24 tests)
│   ├── verify_hardening.js         # Suite 2: Security & Concurrency (13 tests)
│   ├── verify_ui_matching.js       # Suite 3: UI Spec & Row labels (56 tests)
│   ├── verify_smart_import_and_guest_list.js # Suite 4: Smart Import (23 tests)
│   ├── verify_partial_checkin_schema.js      # Suite 5: Partial Check-in (31 tests)
│   ├── verify_walkin_buttons.js    # Suite 6: Walk-in Buttons (15 tests)
│   ├── verify_table_layout.js      # Suite 7: Table Layout & Truncation (20 tests)
│   ├── verify_sheet_import_and_schema.js     # Suite 8: Google Sheet 6-col (52 tests)
│   ├── verify_seat_category_colors.js        # Suite 9: Category Colors v2 (69 tests)
│   └── verify_tooltip_positioning.js         # Suite 10: Smart Tooltip Flip (40 tests)
├── nodemon.json
├── package.json
└── server.js                       # จุดเริ่มต้นระบบ Express Server
```

---

## 🚀 วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. โคลน Repository
```bash
git clone https://github.com/EVOhongZAW/media-screening-dashboard.git
cd "media-screening-dashboard"
```

### 2. ติดตั้ง Dependencies
```bash
npm install
```

### 3. เริ่มต้นรันเซิร์ฟเวอร์
- **โหมด Production**:
  ```bash
  npm start
  ```
- **โหมด Development** (รีโหลดอัตโนมัติเมื่อแก้ไขโค้ด):
  ```bash
  npm run dev
  ```

### 4. เปิดใช้งานผ่านเว็บเบราว์เซอร์
เปิดเบราว์เซอร์และเข้าไปที่:
```text
http://localhost:3000/media-screening-dashboard
```
*(หากเข้าผ่าน `http://localhost:3000/` ระบบจะพาไปยัง `/media-screening-dashboard` ให้อัตโนมัติ)*

---

## 🧪 การทดสอบระบบอัตโนมัติ (Automated Test Suites)

ระบบมีชุดทดสอบอัตโนมัติครอบคลุม 10 หมวดหมู่ รวม **343 รายการทดสอบ (100% Pass Rate)**:

```bash
npm test
```

### รายละเอียดผลการทดสอบ:
```text
===============================================================
  1.  verify_group_seats.js:                 24 / 24  PASSED (100%)
  2.  verify_hardening.js:                   13 / 13  PASSED (100%)
  3.  verify_ui_matching.js:                 56 / 56  PASSED (100%)
  4.  verify_smart_import_and_guest_list.js: 23 / 23  PASSED (100%)
  5.  verify_partial_checkin_schema.js:      31 / 31  PASSED (100%)
  6.  verify_walkin_buttons.js:              15 / 15  PASSED (100%)
  7.  verify_table_layout.js:                20 / 20  PASSED (100%)
  8.  verify_sheet_import_and_schema.js:     52 / 52  PASSED (100%)
  9.  verify_seat_category_colors.js:        69 / 69  PASSED (100%)
  10. verify_tooltip_positioning.js:         40 / 40  PASSED (100%)
===============================================================
  GRAND TOTAL: 343 / 343 Tests PASSED (100%)
===============================================================
```

---

## 📄 ข้อตกลงสิทธิ์การใช้งาน (License)
MIT License — พัฒนาขึ้นเพื่อการบริหารจัดการงานรอบสื่อมวลชนและผังที่นั่งโรงภาพยนตร์อย่างมืออาชีพ
