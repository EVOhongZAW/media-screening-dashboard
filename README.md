# 🎬 รอบสื่อ - Guest & Seat Manager

ระบบแดชบอร์ดบริหารจัดการรอบฉายภาพยนตร์สำหรับสื่อมวลชน (Press Screening) และแขกรับเชิญพิเศษ พร้อมผังที่นั่งโรงภาพยนตร์แบบอินเทอร์แอคทีฟ (Interactive Seat Map) และการติดตามสถิติโซเชียลมีเดียของครีเอเตอร์ ออกแบบในสไตล์ **Dark Cinema Luxury** ระดับโปร

---

## ✨ ฟีเจอร์หลัก (Key Features)

### 1. 📊 ภาพรวมงาน (Overview)
- **4 Summary KPI Cards**: สรุปจำนวนแขกทั้งหมด, ตอบรับแล้ว, รอตอบรับ, และจำนวนที่นั่งที่ถูกจอง (เช่น 21/60 ที่นั่ง)
- **แขกแบ่งตามแพลตฟอร์ม**: แถบแสดงสถิติจำนวนแขกและครีเอเตอร์ที่ทำคอนเทนต์ในแต่ละช่องทาง (YouTube, TikTok, Facebook, Instagram)

### 2. 💺 ผังที่นั่งโรงภาพยนตร์ (Cinema Seat Map)
- **จอภาพโค้งเรืองแสง (Curved Screen with Golden Glow)** จำลองบรรยากาศโรงภาพยนตร์
- **ผังที่นั่ง 60 ที่นั่ง (6 แถว A-F, แถวละ 10 ที่นั่ง แบ่งฝั่ง 1-5 และ 6-10 เว้นทางเดินกลาง)**
- **แบ่งโซนสีตามประเภท**:
  - 🟨 **VIP** (แถว A, B) — สีทอง Amber
  - 🟩 **สื่อมวลชน** (แถว C, D) — สีเขียวอมฟ้า Teal
  - 🟪 **ครีเอเตอร์** (แถว E, F) — สีชมพู Magenta
  - ⬛ **ว่าง** — ขอบสีเข้มตามโซน
- **Interactive Side Panel**:
  - คลิกที่นั่งที่จองแล้ว เพื่อดูรายละเอียดแขก, สังกัด, ข้อมูลติดต่อ, ช่องทางคอนเทนต์ และปุ่มปลดที่นั่ง
  - คลิกที่นั่งว่าง เพื่อเลือกมอบหมายแขกที่ยังไม่มีที่นั่งได้ทันที

### 3. 👥 รายชื่อแขก (Guest List)
- ช่องค้นหาชื่อ, สังกัด, เบอร์โทร, อีเมล, หรือ handle โซเชียลมีเดีย
- ตัวกรองตามสถานะ (ตอบรับแล้ว, รอตอบรับ, ปฏิเสธ) และตามแพลตฟอร์ม
- แสดงแบดจ์ยอดผู้ติดตาม (Followers) ของแต่ละช่องทางโซเชียล
- แผงรายละเอียดด้านขวาสำหรับดูข้อมูลและแก้ไขสถานะ/ที่นั่งแบบรวดเร็ว
- ฟอร์ม **"+ เพิ่มแขก"** สำหรับลงทะเบียนแขกใหม่

### 4. 🎬 จัดการรอบภาพยนตร์ (Screening Management)
- **แถบสลับรอบภาพยนตร์ (Screening Switcher)** ด้านบน เลือกสลับดูข้อมูลรายรอบฉายได้ทันที
- **เพิ่มรอบหนังใหม่ (+ Add Screening)**: กำหนดชื่อเรื่อง, สาขา (SF / Major), โรงหนัง, วันที่, เวลา, ประเภท, ความจุที่นั่ง
- **ตั้งค่ารอบหนัง (Screening Settings)**: แก้ไขข้อมูลรอบฉาย หรือลบรอบฉายที่ไม่ต้องการ

---

## 🛠 Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Properties / Flexbox / Grid), JavaScript (Vanilla ES6+), Font Awesome 6, Google Font 'Prompt'
- **Backend**: Node.js, Express.js, CORS, dotenv, uuid
- **Storage**: JSON File Database (Async I/O Service)

---

## 🚀 วิธีติดตั้งและใช้งาน (Installation & Setup)

```bash
# 1. Clone repository นี้
git clone <URL_ของ_REPO>
cd "WEB moive"

# 2. ติดตั้ง Dependencies
npm install

# 3. เริ่มต้นรันเซิร์ฟเวอร์
npm start

# หรือรันในโหมด Development (Auto-reload ด้วย nodemon)
npm run dev
```

เปิดเบราว์เซอร์แล้วไปที่:
```
http://localhost:3000
```

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
├── controllers/          # Business logic (screenings, guests, branches)
├── data/                 # JSON Data storage (screenings.json, guests.json, branches.json)
├── middleware/           # Input validation & error handling
├── public/               # Static frontend files
│   ├── css/style.css     # Dark cinema theme stylesheet
│   ├── js/api.js         # REST API client
│   ├── js/app.js         # Core frontend interactive logic
│   └── index.html        # Main dashboard interface
├── routes/               # Express API endpoints
├── services/             # Data service & Stats aggregation
├── .gitignore            # Git ignored files (node_modules, etc.)
├── package.json          # Node package definition
└── server.js             # Express server entry point
```

---

## 📄 License
MIT License
