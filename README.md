# 🎬 ระบบบริหารจัดการรอบสื่อมวลชนและผังที่นั่งโรงภาพยนตร์
### (Press Screening Event Operations & Unified Seat Management Dashboard)

ระบบแดชบอร์ดบริหารจัดการรอบฉายภาพยนตร์สำหรับสื่อมวลชน (Press Screening), ครีเอเตอร์ และแขกรับเชิญพิเศษ ออกแบบมาสำหรับการปฏิบัติการหน้างานจริง (On-site Event Operations) ด้วยสถาปัตยกรรม **Full-Stack Production Grade** สไตล์ **Dark Cinema Luxury & Futuristic Glow**

รองรับผังที่นั่งขนาดจริงของ **โรงภาพยนตร์สยามภาวลัย รอยัล แกรนด์ เธียเตอร์ (Siam Pavalai Royal Grand Theatre) พารากอน ซีนีเพล็กซ์ จำนวน 1,164 ที่นั่ง** พร้อมระบบคำนวณและจัดสรรที่นั่งอัจฉริยะสำหรับกลุ่มคณะ

---

## 🌟 จุดเด่นและฟีเจอร์สำคัญ (Core Highlights)

### 🪑 1. ผังโรงภาพยนตร์สยามภาวลัยขนาดจริง 1,164 ที่นั่ง (Siam Pavalai Real Topology)
- โครงสร้างสมบูรณ์ตามผังโรงภาพยนตร์ขนาดใหญ่ที่สุดในเอเชียตะวันออกเฉียงใต้:
  - **Grand Stalls (ชั้นล่าง)**: 919 ที่นั่ง (แถว A – S รวม 19 แถว มีทางเดินกลางและทางเดินข้าง)
  - **Royal Balcony (ชั้นบน)**: 245 ที่นั่ง (แถว AA – EE รวม 5 แถว พร้อมเก้าอี้ Royal Suite คู่)
- **Interactive Tier Tabs**: สลับดูมุมมอง *ทั้งหมด*, *เฉพาะชั้น 1 (Stalls)*, หรือ *เฉพาะชั้น 2 (Balcony)*
- **Real-time Seat Highlighting & Quick Drawer**: คลิกเก้าอี้เพื่อดูรายละเอียดผู้ครองที่นั่ง หรือมอบหมายที่นั่งให้แขกได้ทันที

---

### 🎯 2. Unified `SeatPicker` Engine (คอมโพเนนต์เลือกที่นั่งรวมศูนย์ 3 โหมด)
รวบรวม Logic การจัดที่นั่งทั้งหมดไว้ในคอมโพเนนต์เดียว (`public/js/seat-picker.js`) ตอบโจทย์การทำงานหน้างานในทุกสถานการณ์:
1. **Mode A: Auto Recommend (แนะนำกลุ่มที่นั่งติดกันอัตโนมัติ)**
   - ขับเคลื่อนด้วย **Heuristic Scoring Algorithm**: ให้คะแนนตามความติดกันของแถว (Adjacency Bonus), เว้นช่องว่าง (Aisle Proximity), และระยะห่าง
   - แสดงตัวเลือกที่ดีที่สุด Top 5 ทันที (เช่น `E10 - E13 (4 ที่นั่งติดกัน)`) คลิกปุ่มเดียวเลือกครบกลุ่มใน 1 วินาที
2. **Mode B: Interactive Seat Map (เลือกจากผังโรง Multi-select)**
   - สลับผังโรงภาพยนตร์เข้าสู่โหมดเลือกเก้าอี้ พร้อมเอฟเฟกต์ไฟนีออนพัลส์สีเขียวมิ้นต์ (`.seat-staged-picker`)
   - แถบ **Floating Live Parity Bar** ด้านล่าง แสดงจำนวนที่เลือกและตัวนับสถานะเรียลไทม์: `กำลังเลือก 2 / 4 ที่ (ขาดอีก 2 ที่)`
   - รองรับ **Parent Modal Restore**: ซ่อนหน้าต่างเดิมชั่วคราวขณะเลือกบนผัง และคืนค่าหน้าต่างหลักกลับมาพร้อมเก้าอี้ที่เลือกให้อัตโนมัติ
3. **Mode C: Manual Search Dropdown (ค้นหาและเลือกด้วย Dropdown)**
   - ช่องค้นหาเลขที่นั่งหรือแถว (เช่น พิมพ์ `U` กรองเฉพาะแถว U)
   - ฟิลเตอร์แยกตามชั้น (Grand Stalls / Royal Balcony) และสถานะ (ว่าง / จัดแล้ว / เช็คอินแล้ว)
   - **Full Context Badges**: แสดงบริบทครบถ้วนว่าเก้าอี้ตัวใดว่างหรือถูกจัดสรรให้ใคร

---

### ⚡ 3. ระบบช่วยค้นหาที่นั่งที่เหลือ (Seat Helper in Add Guest)
ในหน้าต่าง **"เพิ่มแขกใหม่"** (`modalAddGuest`):
- **ปุ่มลัด `[ เลือกที่นั่งว่าง (SeatPicker) ]`**: ดึงจำนวนโควตาจากช่อง `Participant` ไปเป็นเป้าหมายการจัดแบบอัตโนมัติ
- **Live Autocomplete Dropdown**: พิมพ์ค้นหาเลขที่นั่งในช่อง Seat แล้วระบบจะแสดงเฉพาะที่นั่งที่ยังว่างอยู่จริงในโรง (พร้อมระบุแถวและชั้น) คลิกเลือกใส่ช่องได้ทันที
- **Quick Contiguous Chips**: ชิปแนะนำกลุ่มที่นั่งว่างติดกัน (เช่น `[ U27-U28 (2 ที่) ]`, `[ B16-B17 (2 ที่) ]`) ที่อัปเดตตามตัวเลขในช่อง `Participant` แบบเรียลไทม์

---

### 👥 4. ระบบ Walk-in คณะสื่อมวลชน & กฎเหล็ก Group Parity Lock
ในหน้าต่าง **"เพิ่มแขก Walk-in จากผังที่นั่ง"** (`modalWalkInSeat`):
- **Group Parity Law**: บังคับใช้กฎ `จำนวนที่นั่ง = จำนวนแขก` ป้องกันการบันทึกข้อมูลที่ไม่ตรงกับโควตา พร้อมแถบเตือนสถานะ
- **Direct Seat Addition**: ช่องพิมพ์เลขที่นั่งโดยตรง `[ พิมพ์เลขที่นั่ง เช่น U28 ]` พร้อมปุ่ม `[ + เพิ่ม ]` (รองรับการพิมพ์ช่วง เช่น `U28-U30`)
- **Adjacent Available Seat Chips**: เมื่อเลือกที่นั่งแรกแล้ว ระบบจะหาเก้าอี้ว่างข้างเคียงในแถวเดียวกันทันที และแสดงปุ่มลัด `[ + เพิ่ม U26 ]`, `[ + เพิ่ม U28 ]` ให้กดเลือกเพิ่มได้ใน 1 วินาที
- **Duplicate Detection**: ตรวจจับรายชื่อหรือเบอร์โทรศัพท์ที่ซ้ำซ้อนในรอบฉายเดียวกันแบบเรียลไทม์ขณะพิมพ์

---

### 🛡️ 5. Non-Destructive 409 Conflict Recovery (แก้ปัญหาที่นั่งชนกันอย่างปลอดภัย)
- กรณี Staff หลายเครื่องเลือกที่นั่งตัวเดียวกันในเวลาไล่เลี่ยกัน (Concurrent Race Condition)
- ระบบส่งสัญญาณ HTTP 409 `SEAT_CONFLICT` โดย**ไม่ล้างฟอร์มทิ้ง**
- ระบบจะคงเก้าอี้ตัวที่ไม่ชนไว้ และเปิด `SeatPicker` ให้เลือกเฉพาะเก้าอี้ทดแทนตัวที่ชนได้ทันที

---

### 🔄 6. ระบบย้ายที่นั่งอัจฉริยะ (Entire Group vs Partial Move)
- **ย้ายทั้งกลุ่ม (Move Group)**: ย้ายคณะไปยังแถว/โซนใหม่
- **ย้ายเฉพาะบุคคล (Partial Move)**: มี Checklist ให้ติ๊กเลือกเฉพาะบางคนที่ต้องการย้ายที่นั่ง (เช่น ขอย้าย 1 ท่านไปริมทางเดิน) โดยเก้าอี้ตัวเดิมจะถูกปล่อยคืนเข้าระบบทันที (Atomic Release)

---

### 📋 7. โครงสร้างข้อมูล 6 คอลัมน์หลักมาตรฐาน (Core 6 Guest Fields)
ระบบถูกออกแบบให้กระชับ เหมาะกับทีมลงทะเบียนหน้างาน โดยตัดข้อมูลที่ไม่จำเป็นออก เหลือ 6 หัวข้อหลัก:
1. **Media**: สื่อ / สังกัด / เพจ / บริษัท
2. **Name**: ชื่อแขก / ผู้ติดต่อ
3. **Participant**: จำนวนโควตาที่ได้รับ (คน)
4. **Seat**: ที่นั่งที่จัดสรร (รองรับทั้งที่นั่งเดี่ยวและช่วง เช่น `B16-B17`, `E7-E8`)
5. **Sign**: สถานะการเซ็นชื่อ/เช็คอิน (`รอเซ็น`, `มาบางส่วน x/y`, `เซ็นครบ ✓`)
6. **Tel**: เบอร์โทรศัพท์ (คลิกเพื่อโทรออกได้ทันทีบนมือถือ/แท็บเล็ต)

---

### 🛠️ 8. ชุดเครื่องมือปฏิบัติการหน้างาน (Operations Suite)
- **Pre Check-in**: ลงทะเบียนคิวล่วงหน้าสำหรับกลุ่มที่มารอเข้าแถว
- **Partial Check-in**: ระบุจำนวนคนที่มาถึงแล้ว สำหรับคณะที่เดินทางมาไม่พร้อมกัน
- **Safe Bulk Delete with 10s Undo**: ลบรายการแขกจำนวนมากอย่างปลอดภัย ต้องพิมพ์คำว่า `DELETE` เพื่อยืนยัน พร้อมแถบปุ่มกู้คืนข้อมูล (Undo Banner) ภายใน 10 วินาที
- **Audit Logs**: บันทึกประวัติกิจกรรมสำคัญลงใน `data/activity_logs.json`
- **CSV / Excel Clipboard Import**: วางข้อมูลจาก Excel หรือ Google Sheets ได้ทันที พร้อมระบบตรวจจับหัวคอลัมน์อัตโนมัติ

---

## 🏗️ Architecture & Tech Stack

| ส่วนประกอบ | เทคโนโลยี | รายละเอียด |
|---|---|---|
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 | Single Page Application (SPA) ความเร็วสูง ไม่มีภาระของ Framework |
| **Styling** | Custom CSS Variables, Flexbox, Grid | Dark Cinema Luxury Palette, Glassmorphism, Responsive UI |
| **Backend** | Node.js, Express.js | RESTful APIs, Error Handling, Input Validation |
| **Algorithms** | Heuristic Scoring & Manhattan Distance | แนะนำกลุ่มที่นั่งติดกันและจัดสรรที่นั่งใกล้เคียง |
| **Storage** | Asynchronous JSON File Store | ปลอดภัยด้วย Atomic File Writes ป้องกันข้อมูลเสียหาย |
| **Testing** | Node Native Assertion Test Suite | รันชุดทดสอบ 24 เคส ครอบคลุม Heuristic, Parity, Conflict และ Transaction |

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
WEB moive/
├── controllers/
│   ├── branchController.js     # จัดการข้อมูลสาขาโรงภาพยนตร์
│   ├── guestController.js      # จัดการข้อมูลแขก, Walk-in, Check-in, Bulk Delete
│   ├── screeningController.js  # จัดการรอบฉายภาพยนตร์
│   └── seatController.js       # จัดการระบบที่นั่ง, Heuristic Recs, Partial Move
├── data/
│   ├── activity_logs.json      # ประวัติการทำงาน (Audit Trail)
│   ├── branches.json           # ข้อมูลสาขา
│   ├── guests.json             # ข้อมูลแขกและสถานะที่นั่ง
│   ├── pavalai_layout.json     # โครงสร้างผังโรงภาพยนตร์สยามภาวลัย (1,164 ที่นั่ง)
│   └── screenings.json         # ข้อมูลรอบฉาย
├── middleware/
│   ├── errorHandler.js         # กลไกจัดการข้อผิดพลาดและส่ง HTTP Status
│   └── validator.js            # ตรวจสอบความถูกต้องของ Input Request
├── public/
│   ├── css/
│   │   └── style.css           # ธีม Dark Cinema, เอฟเฟกต์ไฟนีออน, ผังโรงภาพยนตร์
│   ├── data/
│   │   └── pavalai_layout.json # ผังที่นั่งสำหรับ Client Cache
│   ├── js/
│   │   ├── api.js              # Fetch Wrapper สำหรับสื่อสารกับ Backend API
│   │   ├── app.js              # ตัวควบคุมหลักฝั่ง UI, Event Handlers, Modals
│   │   └── seat-picker.js      # Unified Tri-modal SeatPicker Component
│   └── index.html              # หน้าหลักแดชบอร์ด
├── routes/
│   ├── branchRoutes.js         # API Routes: /api/branches
│   ├── guestRoutes.js          # API Routes: /api/guests
│   ├── screeningRoutes.js      # API Routes: /api/screenings
│   └── seatRoutes.js           # API Routes: /api/seats
├── scripts/
│   └── verify_group_seats.js   # Automated Test Suite (24 Test Cases)
├── services/
│   ├── auditService.js         # บันทึกกิจกรรมระบบ
│   ├── dataService.js          # จัดการอ่าน-เขียนไฟล์ JSON แบบปลอดภัย
│   ├── seatService.js          # เอนจินคำนวณ Heuristic และผังที่นั่ง
│   ├── snapshotService.js      # ระบบสำรองข้อมูลและกู้คืน (Undo Snapshot)
│   └── statsService.js         # คำนวณสรุปสถิติ KPI Dashboard
├── package.json
└── server.js                   # จุดเริ่มต้นระบบ Express Server
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

### 3. รันเซิร์ฟเวอร์
- **โหมด Production**:
  ```bash
  npm start
  ```
- **โหมด Development** (Auto-reload เมื่อแก้ไขโค้ด):
  ```bash
  npm run dev
  ```

### 4. เปิดใช้งานผ่านเบราว์เซอร์
เปิดเบราว์เซอร์และเข้าไปที่:
```text
http://localhost:3000
```

---

## 🧪 การทดสอบระบบอัตโนมัติ (Automated Testing)

โปรเจกต์มีชุดทดสอบอัตโนมัติระดับ Senior Full-Stack ครอบคลุม 24 รายการทดสอบ:
```bash
npm test
```

**ผลการทดสอบ (24/24 Test Cases Passed - 100%):**
- **Suite 1**: Full Inventory & Topology (ตรวจสอบความถูกต้องของผัง 1,164 ที่นั่ง)
- **Suite 2**: Heuristic Group Recommendations (ทดสอบอัลกอริทึมแนะนำที่นั่งติดกัน 4 ที่)
- **Suite 3**: Walk-in Group Parity Validation (ทดสอบการบล็อก Parity Mismatch และการสร้าง Walk-in)
- **Suite 4**: Non-Destructive 409 Conflict Recovery (ทดสอบการรักษาที่นั่งเดิมเมื่อเกิด Conflict)
- **Suite 5**: Partial Move within Group (ทดสอบการย้ายที่นั่งเฉพาะบุคคลและการ Release เก้าอี้เดิม)
- **Suite 6**: Full Group Move (ทดสอบการย้ายทั้งกลุ่ม)
- **Suite 7**: Clean-up & Data Integrity (ทดสอบการกู้คืนข้อมูล)

---

## 📄 ข้อตกลงสิทธิ์การใช้งาน (License)
MIT License — พัฒนาเพื่อการบริหารจัดการงานรอบสื่อมวลชนอย่างมืออาชีพ
