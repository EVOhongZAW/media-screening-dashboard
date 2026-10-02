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

### ⚡ 8. การเพิ่มประสิทธิภาพระดับระบบเพื่ออุปกรณ์หน้างานจริง (System-Wide Performance Overhaul)
ระบบได้รับการปรับปรุงประสิทธิภาพขั้นสูงเพื่อการใช้งานที่ลื่นไหลบน iPad และโน้ตบุ๊กสเปกกลางหน้างาน โดยปราศจากภาระของ Dependency ภายนอก:
- **85.3% Payload Reduction (Zero-dependency zlib HTTP Compression)**: บีบอัดไฟล์ HTML, CSS, JS, JSON ผ่าน Node.js Built-in `zlib` ลดขนาดการดาวน์โหลดหน้าเว็บแรกลงจาก **576.7 KB เหลือเพียง 84.7 KB**
- **Smart Static Asset Caching**: กำหนด `Cache-Control: public, max-age=86400, stale-while-revalidate=3600` และ ETag ให้กับไฟล์ผังที่นั่ง (`pavalai_layout.json` 9.8 KB), CSS, JS ทำให้การเปิดหน้าซ้ำได้ข้อมูลจาก Browser Cache ทันที (0 KB / Instant 304)
- **Eliminate 1,164 GPU Compositing Layers**: ถอด `will-change: opacity` บนเก้าอี้ 1,164 ตัว คืน VRAM ให้กับระบบ และลบ `backdrop-filter: blur(14px)` จากพื้นที่เลื่อนอ่านรายชื่อแขก (`.table-container`) เพื่อการ Scroll ที่เนียนตา 60 FPS
- **Optimistic UI Check-in (< 10ms)**: เมื่อแตะปุ่มเช็คอิน สถานะเก้าอี้และแถวตารางจะเปลี่ยนเป็น "เช็คอินแล้ว ✓" ทันทีแบบเรียลไทม์ พร้อมระบบ Auto-rollback แจ้งเตือนหากฝั่งเครือข่ายมีปัญหา
- **O(1) Targeted Seat Updates (`_seatElementMap`)**: ค้นหาและกลายพันธุ์เฉพาะปุ่มเก้าอี้ที่ต้องการอัปเดตสถานะโดยตรง ไม่ทำลายและสร้างเก้าอี้ 1,164 ตัวใหม่
- **CSS Compositor-driven Filter (1.4 ms)**: สลับฟิลเตอร์เก้าอี้ด้วย `data-cat-filter` และ `data-seat-filter` ที่ระดับ Container ให้ CSS Engine จัดการ Dimming ในเฟรมเดียว (เร็วกว่าเดิม ~99%)
- **Debounced Search & Token Indexing**: ค้นหารายชื่อแขกด้วย Debounce 180ms พร้อม Pre-indexed lowercase search tokens ลบอาการพิมพ์กระตุกโดยสิ้นเชิง
- **In-Memory Backend Store & Atomic Queues**: อ่านข้อมูลแขกและรอบฉายจากหน่วยความจำได้ทันที 0ms Disk I/O และเขียนเซฟลง Disk ผ่าน Atomic Sequential Promise Queue รับประกันความปลอดภัยของไฟล์ JSON

#### 📊 ตารางวัดผลประสิทธิภาพเปรียบเทียบ (Chrome DevTools Benchmark):
| ดัชนีวัดผล | ก่อนปรับแต่ง (Baseline) | หลังปรับแต่ง (Optimized) | ผลลัพธ์ |
|---|---|---|---|
| **ขนาด Payload โหลดหน้าเว็บแรก** | 576.7 KB (Raw text) | **84.7 KB (Gzip)** | **ลดลง 85.3% (-492 KB)** ⚡ |
| `pavalai_layout.json` | 215.5 KB | **9.8 KB (Gzip)** | **ลดลง 95.5%** 🚀 |
| `app.js` | 191.7 KB | **42.4 KB (Gzip)** | **ลดลง 77.9%** ⚡ |
| `style.css` | 76.3 KB | **13.9 KB (Gzip)** | **ลดลง 81.8%** ⚡ |
| **GPU Compositing Layers** | 1,164 layers | **0 layers (VRAM Free)** | **100% layer bloat eliminated** |
| **Seat Map Hover Long Tasks (>50ms)** | มีอาการกระตุกสะสม | **0 Long Tasks (0ms)** | **60 FPS ลื่นไหลบน iPad** 🎯 |
| **ความรู้สึกตอนกดเช็คอิน (Check-in)** | 21ms local / 300–800ms remote | **< 10ms (Optimistic UI)** | **เปลี่ยนสถานะทันที** ⚡ |
| **สลับฟิลเตอร์เก้าอี้ (Filter Switch)** | ~150 ms (re-render) | **1.4 ms (CSS Dataset)** | **เร็วขึ้น 99%** 🚀 |

---

### 📑 9. ระบบนำเข้าไฟล์ Excel (.xlsx / .xls) และ CSV อัจฉริยะ (Enterprise Excel Ingestion Pipeline)
ระบบนำเข้าข้อมูลแขกที่ได้รับการอัปเกรดให้รองรับไฟล์สเปรดชีตทุกรูปแบบแบบ All-in-One ไม่ว่าจะเป็นไฟล์ Excel รุ่นใหม่ (`.xlsx`), Excel รุ่นเดิม (`.xls`), ไฟล์ข้อความ (`.csv`, `.tsv`, `.txt`), หรือการ Copy & Paste จาก Clipboard เข้าสู่ Pipeline เดียวกันอย่างสมบูรณ์:

- **Zero-overhead Lazy Loading**: โหลดไลบรารี **SheetJS (xlsx v0.20.3)** ที่ Vendored เก็บไว้ในเครื่อง (`/public/vendor/xlsx/xlsx.full.min.js`) เฉพาะเมื่อผู้ใช้เปิดหน้าต่างนำเข้าข้อมูลเท่านั้น ไม่ส่งผลกระทบต่อขนาด Payload ตอนเปิดหน้าเว็บแรกแม้แต่ไบต์เดียว
- **Off-thread Web Worker (`excelWorker.js`)**: ประมวลผลและอ่านข้อมูล Excel ใน Worker Thread แยกส่วน ไม่แย่ง CPU ของ Main Thread หน้าเว็บยังคงตอบสนองลื่นไหล ไม่มีอาการค้างหรือกระตุก แม้เปิดไฟล์ที่มีข้อมูลหลายร้อยแถว
- **จัดการ 10 หลุมพรางคลาสสิกของ Excel ครบถ้วน (Excel Pitfalls Resolution)**:
  1. *เบอร์โทรศัพท์*: กู้คืนเลข `0` นำหน้าที่ Excel มักตัดทิ้งอัตโนมัติ (เช่น `891234567` $\rightarrow$ `0891234567`), แปลง Scientific Notation (`8.91E+08` $\rightarrow$ `0891234567`) พร้อมแจ้งเตือนหากเบอร์ไม่ครบ 10 หลัก
  2. *Hyperlinked Media Name*: หากชื่อสื่อฝังลิงก์ URL มา ระบบจะดึงชื่อสื่อมาแสดงในช่อง `organization` และสกัดลิงก์เป้าหมายไปเก็บในฟิลด์ `link` อย่างถูกต้อง ไม่นำ URL มาทับชื่อสื่อ
  3. *Merged Cells (`ws['!merges']`)*: ส่งต่อค่าจาก Master Cell ไปยังทุกเซลล์ย่อยที่ถูกควบรวม ป้องกันแถวถัดไปกลายเป็นค่าว่าง
  4. *Formula Cells*: อ่านค่าที่ประเมินผลไว้แล้ว (`cell.w` / `cell.v`) โดยไม่ประเมินสูตรใหม่
  5. *Multiline Detail & Recipient Extraction*: คงค่าบรรทัดใหม่ `\n` และ bullet `•` สกัดชื่อผู้รับบัตร (`name`) และสลับใช้ชื่อสื่อเป็น Fallback หากไม่พบ
  6. *ตัวเลขปนข้อความ*: แปลงคอมมาในยอดผู้ติดตาม `"1,200,000"` $\rightarrow$ `1200000`, สกัดตัวเลขโควตาจากข้อความ เช่น `"(โควตา 2 ใบ)"` $\rightarrow$ `2`
  7. *จำนวนที่ไม่ใช่ตัวเลข (VIP, เชิญ, ไม่ว่าง, ติดงาน)*: กรองแยกแถวเหล่านี้ไปยังรายการข้าม (Skipped Rows) พร้อมบันทึกสาเหตุชัดเจน ไม่เดาตัวเลขสุ่มสี่สุ่มห้า
  8. *แถวว่างเปล่า*: ข้ามแถวที่ไม่มีข้อมูลโดยไม่แสดง Error
  9. *ความปลอดภัยสูงสุด*: ปฏิเสธไฟล์ Macro (`.xlsm` / VBA) ทันทีผ่าน Magic Bytes ตรวจจับ และทำการ Sanitization ป้องกัน XSS ทุกเซลล์
  10. *ตรวจความถูกต้องของที่นั่ง 2 ชั้น*: ตรวจสอบรหัสที่นั่งกับผังโรงภาวลัย, ตรวจการซ้ำกันเองภายในไฟล์, และตรวจการชนกับแขกเดิมในระบบ พร้อมระบบแนะนำที่นั่งใกล้เคียง
- **Interactive Virtualized Preview Table**: พรีวิวข้อมูลแบ่งหน้า (Pagination 50 แถวต่อหน้า) แก้ไขข้อมูลในตารางได้โดยตรงก่อนกดยืนยัน (Inline Editable Cells)
- **Status Filter Tabs**: กรองดูรายการ *ทั้งหมด (All)*, *รายการที่มีข้อควรระวัง (Issues)*, *รายการที่ผิดพลาด (Error)*, และ *รายการที่ถูกต้อง (OK)*
- **Excel Template & Skipped Rows Export**: มีปุ่มดาวน์โหลดไฟล์แม่แบบตัวอย่าง (`cinema_guest_template.xlsx`) และปุ่มดาวน์โหลดรายการแถวที่ถูกข้ามพร้อมสาเหตุเป็นไฟล์ Excel (`cinema_guests_skipped_review.xlsx`)

---

### 📐 10. ระบบจัดวางเลย์เอาต์และป้ายแถวคู่แม่นยำ (Precision Alignment Architecture)
- **แถว B และห้องฉาย (PROJECTION ROOM)**: วาง Element ห้องฉายตรงกลางระหว่างที่นั่ง B15 และ B16 ใน DOM Order พร้อมล็อก `grid-row: 1; align-items: center` ทำให้ป้าย B ทั้งสองฝั่งและเก้าอี้แถว B อยู่ระนาบเดียวกัน 100%
- **ป้ายแถวคู่ VP / AA (Twin Row Labels)**: รองรับคุณสมบัติ `leftLabel: "VP"` และ `rightLabel: "AA"` สำหรับแถวล่างสุด ทั้งในโครงสร้างไฟล์ JSON และฝั่งเรนเดอร์ UI
- **ขยายป้ายกำกับแถว 40px**: ขยายความกว้างคอลัมน์ป้ายแถวซ้าย-ขวาเป็น 40px ทำให้ชื่อแถว 2 ตัวอักษร (VP, AA, FH, FA) แสดงครบถ้วนไม่มีตัดขอบ
- **Text Normalization & Alignment ในตารางแขก**: กรองอักขระพิเศษ (BOM, Zero-width Space, Non-breaking Space, Bullets) อัตโนมัติ ทำให้ชื่อแขกทุกคนเริ่มตรงกันที่ขอบซ้าย คอลัมน์ Follower ชิดขวาแบบ Tabular Numbers และป้าย PIC แสดงผลครบถ้วนไม่ถูกบีบตัด

---

### 🏗️ Architecture & Tech Stack

```mermaid
flowchart TD
    subgraph Client ["Client (Browser / iPad)"]
        UI["SPA Interface (Dark Cinema Glassmorphism)"]
        Tokens["Design Tokens (tokens.css)"]
        CatConfig["Seat Category Colors (seatCategoryColors.js)"]
        Worker["Excel Web Worker (excelWorker.js)"]
        SheetJS["Vendored SheetJS (xlsx v0.20.3 - Lazy Loaded)"]
        
        UI --> Tokens
        UI --> CatConfig
        UI -.->|On Import Modal| SheetJS
        UI -->|Off-thread Parse| Worker
    end

    subgraph Backend ["Node.js / Express Backend"]
        Router["REST API Router (/api/*)"]
        Zlib["Zero-dependency zlib HTTP Compression"]
        MemCache["In-Memory Cache (0ms Disk I/O)"]
        WriteQueue["Atomic Promise Sequential Write Queue"]
        Controllers["Controllers: Guest, Screening, Seat, Branch"]
        Services["Services: seatService, statsService, snapshotService"]
        
        Router --> Zlib
        Router --> Controllers
        Controllers --> Services
        Services --> MemCache
        Services --> WriteQueue
    end

    subgraph Storage ["Persistent JSON File Store"]
        DBGuests["data/guests.json (seats v2 schema)"]
        DBScreenings["data/screenings.json"]
        DBLogs["data/activity_logs.json (Audit Trail)"]
        DBSnapshots["data/snapshots/*.json"]
        
        WriteQueue -->|Atomic Rename & Windows Lock Retry| DBGuests
        WriteQueue --> DBScreenings
        WriteQueue --> DBLogs
        WriteQueue --> DBSnapshots
    end

    Client -->|REST API Requests (Gzip / ETag)| Router
```

| เลเยอร์ | เทคโนโลยี | รายละเอียด |
|---|---|---|
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 | Single Page Application (SPA) ประสิทธิภาพสูงพิเศษ ไม่ใช้ Virtual DOM หรือ Heavy Framework (60 FPS) |
| **Design System** | CSS Custom Properties (Tokens), Flexbox, CSS Grid | Dark Cinema Glassmorphism, 4px Spacing Scale, Touch Target $\ge 44\text{px}$ ตามมาตรฐาน WCAG AA |
| **Excel Ingestion** | SheetJS (xlsx v0.20.3 Vendored) + Web Worker | บรรจุไลบรารีไว้ในเครื่อง ไม่พึ่ง CDN, โหลดแบบ Lazy-loading เมื่อเปิดหน้าต่างนำเข้า, ประมวลผลแบบ Off-thread |
| **Compression & Caching**| Built-in Node.js `zlib`, HTTP Headers | Gzip/Deflate zero-dependency, Cache-Control 1 วัน และ ETag สำหรับ static assets |
| **Backend** | Node.js, Express.js | RESTful APIs, Error Handling Middleware, Express Validator พร้อม Configurable Phone Validation |
| **Algorithms** | Heuristic Adjacency & Viewport Collision | แนะนำกลุ่มที่นั่งติดกัน (`findNearbyAvailableSeats`) และคำนวณการหลบขอบจอของ Tooltip |
| **Storage & Concurrency** | In-Memory Cache + Atomic JSON Disk Queue | อ่านเร็ว 0ms disk I/O ปลอดภัยด้วย Sequential Promise Queue + Atomic Temp-file Rename |
| **Testing & Benchmark** | Node.js Native Test Suites + Chrome CDP | 11 ชุดทดสอบ 383 ข้อ (100% Pass Rate) ครอบคลุมความปลอดภัย, ข้อมูล, ประสิทธิภาพ |

---

## 🗄️ โครงสร้างฐานข้อมูล (Data Models & Schema)

### 1. `data/guests.json` (Per-Seat Check-In Schema v2)
```json
{
  "id": "gst-4d7e42eb",
  "screeningId": "scr-84ce44cf",
  "name": "คุณเอ็ม",
  "organization": "Ani Network",
  "detail": "• คุณเอ็ม (ผู้รับบัตร)\n• โทร 081-234-5678",
  "follower": 1200000,
  "pic": "Ani Network",
  "phone": "0812345678",
  "email": "",
  "link": "https://facebook.com/page",
  "guestType": "press",
  "status": "accepted",
  "seat": "I16, I17",
  "seats": [
    { "code": "I16", "checkedIn": true },
    { "code": "I17", "checkedIn": false }
  ],
  "participant": 2,
  "attended": false,
  "attendedCount": 1,
  "attendedSeats": ["I16"],
  "checkInStatus": "partial",
  "source": "import",
  "createdAt": "2026-09-28T07:11:17.000Z"
}
```

- **`seats` (Array)**: อาเรย์ของที่นั่งที่เก็บสถานะการเช็คอินแยกรายที่นั่ง (`code` รหัสที่นั่ง, `checkedIn` สถานะเช็คอิน)
- **`checkInStatus` (Enum)**: สถานะการเข้าชม 3 ระดับ (`not-checked` ยังไม่มา, `partial` มาบางส่วน, `complete` มาครบ)
- **`follower` (Integer / null)**: จำนวนผู้ติดตามสำหรับสื่อ/ครีเอเตอร์ รองรับการจัดเรียง
- **`pic` (String / null)**: ฝ่ายหรือผู้ดูแลโควตา สำหรับจับคู่สี Seat Category
- **`link` (String / null)**: URL เว็บไซต์หรือเพจจริงที่สกัดได้จาก Excel Hyperlink
- **Backward-Compatible Accessors**: คงค่า `seat` (string), `attended` (boolean), `attendedCount` (number) เพื่อรองรับโค้ดและรายงานเดิม

---

## 🔌 ตาราง REST API Endpoints

| Method | Endpoint | คำอธิบาย | พารามิเตอร์ / Body |
|---|---|---|---|
| `GET` | `/api/screenings` | ดึงรายการรอบฉายทั้งหมด | Query: `status`, `date` |
| `GET` | `/api/screenings/:id` | ดึงข้อมูลรอบฉายเดี่ยวพร้อมสถิติ | Param: `id` |
| `GET` | `/api/guests` | ดึงรายชื่อแขกทั้งหมด | Query: `screeningId`, `search`, `status` |
| `GET` | `/api/guests/:id` | ดึงข้อมูลแขกรายบุคคล | Param: `id` |
| `POST` | `/api/guests` | เพิ่มแขกใหม่ (ลงทะเบียนเดี่ยว) | Body: `{ screeningId, name, organization, seat, participant, phone, follower, pic }` |
| `PUT` | `/api/guests/:id` | แก้ไขข้อมูลแขก | Body: ข้อมูลแขกที่ต้องการอัปเดต |
| `DELETE` | `/api/guests/:id` | ลบแขกรายบุคคล | Param: `id` |
| `DELETE` | `/api/guests?screeningId=` | ลบแขกทั้งหมดในรอบฉาย (REST Query) | Query: `screeningId` |
| `POST` | `/api/guests/bulk-delete` | ลบแขกทั้งหมดในรอบฉาย (UI Safe Token) | Body: `{ screeningId, confirmation: "DELETE <count>" }` |
| `POST` | `/api/guests/restore-snapshot` | กู้คืนข้อมูลแขกจาก Snapshot (Undo) | Body: `{ screeningId, snapshotId }` |
| `POST` | `/api/guests/walk-in` | ลงทะเบียนแขก Walk-in หน้างานจากผัง | Body: `{ screeningId, name, seat, participant, attended, ... }` |
| `POST` | `/api/guests/import` | นำเข้าข้อมูลแขกแบบกลุ่ม (Unified Pipeline) | Body: `{ screeningId, replaceExisting, guests, skipped, warnings }` |
| `POST` | `/api/guests/:id/check-in` | เช็คอิน/เช็คเอาต์แขกทั้งกลุ่ม | Body: `{ attended: boolean, seatCodes?: string[] }` |
| `PUT` | `/api/guests/:id/seats/:seatCode/checkin` | Toggle เช็คอินเฉพาะที่นั่งเดี่ยว | Param: `id`, `seatCode`, Body: `{ checkedIn?: boolean }` |
| `GET` | `/api/guests/check-duplicates` | ตรวจสอบชื่อ/เบอร์โทรซ้ำในรอบฉาย | Query: `screeningId`, `phone`, `name` |
| `POST` | `/api/seats/move` | ย้ายที่นั่งแขกไปยังที่นั่งใหม่ | Body: `{ screeningId, guestId, moves: [{ from, to }] }` |
| `POST` | `/api/seats/release` | ปลดที่นั่งแขกคืนสู่ที่นั่งว่าง | Body: `{ screeningId, guestId, seatId }` |
| `GET` | `/api/stats/overview` | ดึงสถิติภาพรวมรอบฉายและที่นั่ง | Query: `screeningId` |

---

## 🛡️ จุดแข็งและการจัดการ Technical Debt (Strengths & Mitigations)

1. **File-based Concurrency & Race Conditions**:
   - *เดิม*: เสี่ยงต่อไฟล์ JSON เสียหายหากมีการเขียนพร้อมกันจากหลายแท็บ
   - *การแก้ไข*: ใช้ **Sequential Promise Queue per File** ใน [`services/dataService.js`](file:///c:/MOVIE%202/WEB%20moive/services/dataService.js) ร่วมกับการเขียนลง Temp File และทำ Atomic Rename พร้อม Retry Mechanism บน Windows ป้องกันการสูญหายของข้อมูล 100%
2. **Disk I/O Bottleneck**:
   - *เดิม*: อ่านไฟล์ `guests.json` ขนาดใหญ่ซ้ำๆ ทุกครั้งที่มี Request
   - *การแก้ไข*: นำ **In-Memory Store (`memoryCache`)** มาเก็บข้อมูล และอัปเดตแคชทันทีที่มีการเขียน ทำให้ Response Time การอ่านข้อมูลเป็น **0ms Disk I/O**
3. **Data Loss Prevention (Safety Snapshots & Audit Trail)**:
   - ทุกการลบแบบกลุ่ม (Bulk Delete) หรือการนำเข้าแบบ Replace จะสร้าง Snapshot อัตโนมัติใน `data/snapshots/` และมีปุ่ม Undo กู้คืนได้ภายใน 10 วินาที พร้อมบันทึกประวัติทุกการกระทำลง `data/activity_logs.json`

---

## 🗺️ แผนการพัฒนาต่อ (Roadmap)

- [ ] **UI Setting สำหรับ Phone Length**: หน้าต่างตั้งค่าในหน้าจอระบบ เพื่อสลับรูปแบบเบอร์โทรระหว่าง 10 หลัก (ไทย) และสากล (E.164)
- [ ] **Export Audit Log**: ปุ่มส่งออกรายงานประวัติการปฏิบัติงานหน้างาน (Activity Logs) เป็นไฟล์ Excel สรุปยอดหลังจบงาน
- [ ] **Database Migration (Future Scale)**: สำหรับงานที่มีสเกลระดับหลายหมื่นที่นั่งพร้อมกัน พิจารณารองรับ SQLite / PostgreSQL สำหรับคลัสเตอร์ขนาดใหญ่

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
WEB moive/
├── controllers/
│   ├── branchController.js         # จัดการข้อมูลสาขาโรงภาพยนตร์
│   ├── guestController.js          # จัดการแขก, Follower, PIC, Check-in, Walk-in, Bulk Delete
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
│   └── validator.js                # ตรวจสอบ Input Request และเบอร์โทร 10 หลัก (Configurable)
├── public/
│   ├── css/
│   │   ├── tokens.css              # 🎨 Centralized Design System Tokens
│   │   └── style.css               # ธีม Dark Cinema Glassmorphism, ผังโรง, ตารางแขก
│   ├── data/
│   │   └── pavalai_layout.json     # ผังที่นั่งสำหรับ Client Cache
│   ├── js/
│   │   ├── api.js                  # Fetch Wrapper สำหรับสื่อสารกับ Backend API
│   │   ├── app.js                  # ตัวควบคุมหลักฝั่ง UI, Event Handlers, Tooltips
│   │   ├── excelImporter.js        # 📑 Core Excel/CSV Ingestion & Validation Pipeline
│   │   ├── excelWorker.js          # ⚙️ Web Worker อ่านไฟล์ Excel แบบ Off-thread
│   │   ├── seatCategoryColors.js   # 🎨 Single Source of Truth หมวดหมู่สีที่นั่ง
│   │   ├── seat-picker.js          # Unified Tri-modal SeatPicker Component
│   │   └── table.js                # โมดูลจัดการตารางแขก
│   ├── vendor/
│   │   └── xlsx/
│   │       └── xlsx.full.min.js    # 📦 Vendored SheetJS v0.20.3 (Lazy-loaded)
│   └── index.html                  # หน้าแดชบอร์ดหลัก (Portal Pattern Tooltip & Excel Import Modal)
├── routes/
│   ├── branchRoutes.js             # API Routes: /api/branches
│   ├── guestRoutes.js              # API Routes: /api/guests
│   ├── screeningRoutes.js          # API Routes: /api/screenings
│   └── seatRoutes.js               # API Routes: /api/seats
├── services/
│   ├── auditService.js             # บริการบันทึกประวัติการกระทำ (Audit Trail)
│   ├── dataService.js              # In-Memory Cache + Sequential Promise Write Queue
│   ├── seatService.js              # อัลกอริทึมที่นั่ง, ตรวจสอบความจุ, Topology
│   ├── snapshotService.js          # ระบบ Snapshot และ Undo สำรองข้อมูลก่อนลบ
│   └── statsService.js             # ระบบคำนวณสถิติและ Per-seat Attendance Tally
├── scripts/                        # 🧪 ชุดทดสอบอัตโนมัติ (Automated Verification)
│   ├── measure_baseline.js         # เครื่องมือวัด DevTools Performance & Payload Benchmark
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
│   ├── verify_tooltip_positioning.js         # Suite 10: Smart Tooltip Flip (40 tests)
│   └── verify_excel_import.js                # Suite 11: Enterprise Excel Pipeline (40 tests)
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

ระบบมีชุดทดสอบอัตโนมัติครอบคลุม 11 หมวดหมู่ รวม **383 รายการทดสอบ (100% Pass Rate)**:

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
  11. verify_excel_import.js:                40 / 40  PASSED (100%)
===============================================================
  GRAND TOTAL: 383 / 383 Tests PASSED (100%)
===============================================================
```
```

---

## 📄 ข้อตกลงสิทธิ์การใช้งาน (License)
MIT License — พัฒนาขึ้นเพื่อการบริหารจัดการงานรอบสื่อมวลชนและผังที่นั่งโรงภาพยนตร์อย่างมืออาชีพ
