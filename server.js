require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

const branchRoutes = require('./routes/branchRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const guestRoutes = require('./routes/guestRoutes');
const statsRoutes = require('./routes/statsRoutes');
const seatRoutes = require('./routes/seatRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Redirect root to /media-screening-dashboard (preserving query params)
app.get('/', (req, res) => {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    res.redirect(302, `/media-screening-dashboard${query}`);
});

// Explicit route to serve dashboard at /media-screening-dashboard
app.get('/media-screening-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files both at /media-screening-dashboard and root
app.use('/media-screening-dashboard', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/branches', branchRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/seats', seatRoutes);

// Error Handler Middleware
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`เซิร์ฟเวอร์เริ่มต้นทำงานที่พอร์ต ${PORT}`);
});
