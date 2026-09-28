require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const zlib = require('zlib');
const errorHandler = require('./middleware/errorHandler');

const branchRoutes = require('./routes/branchRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const guestRoutes = require('./routes/guestRoutes');
const statsRoutes = require('./routes/statsRoutes');
const seatRoutes = require('./routes/seatRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Zero-dependency zlib HTTP Compression Middleware
app.use((req, res, next) => {
    if (req.method === 'HEAD') return next();

    const acceptEncoding = req.headers['accept-encoding'] || '';
    let method = null;
    if (/\bgzip\b/.test(acceptEncoding)) {
        method = 'gzip';
    } else if (/\bdeflate\b/.test(acceptEncoding)) {
        method = 'deflate';
    }
    if (!method) return next();

    const oldWrite = res.write;
    const oldEnd = res.end;
    let stream = null;
    let shouldCompress = null;

    function initStream() {
        if (shouldCompress !== null) return;
        const contentType = res.getHeader('content-type') || '';
        const contentEncoding = res.getHeader('content-encoding');
        const statusCode = res.statusCode || 200;
        const contentLength = res.getHeader('content-length');

        if (contentEncoding || statusCode === 304 || statusCode === 204 ||
            (contentLength && parseInt(contentLength, 10) < 512) ||
            !/text|javascript|json|xml|svg/i.test(contentType)) {
            shouldCompress = false;
            return;
        }

        shouldCompress = true;
        res.removeHeader('content-length');
        res.setHeader('content-encoding', method);
        res.setHeader('vary', 'Accept-Encoding');

        stream = method === 'gzip' ? zlib.createGzip() : zlib.createDeflate();
        stream.on('data', chunk => {
            if (!oldWrite.call(res, chunk)) {
                stream.pause();
            }
        });
        res.on('drain', () => {
            if (stream) stream.resume();
        });
        stream.on('drain', () => {
            res.emit('drain');
        });
        stream.on('end', () => oldEnd.call(res));
        stream.on('error', err => {
            console.error('Compression stream error:', err);
            oldEnd.call(res);
        });
    }

    res.write = function (chunk, ...args) {
        initStream();
        if (shouldCompress) {
            return stream.write(chunk, ...args);
        }
        return oldWrite.call(res, chunk, ...args);
    };

    res.end = function (chunk, ...args) {
        initStream();
        if (shouldCompress) {
            return stream.end(chunk, ...args);
        }
        return oldEnd.call(res, chunk, ...args);
    };

    next();
});

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
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Static assets caching options (1 day for css/js/json with ETag, no-cache for html)
const staticOptions = {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.json') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600');
        }
    }
};

// Serve static files both at /media-screening-dashboard and root
app.use('/media-screening-dashboard', express.static(path.join(__dirname, 'public'), staticOptions));
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

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
