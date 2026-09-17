require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const branchRoutes = require('./routes/branchRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const guestRoutes = require('./routes/guestRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files if needed
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/branches', branchRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/stats', statsRoutes);

// Error Handler Middleware
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`เซิร์ฟเวอร์เริ่มต้นทำงานที่พอร์ต ${PORT}`);
});
