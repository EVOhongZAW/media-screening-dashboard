// scripts/measure_baseline.js
// Measures Chrome DevTools Performance, DOM nodes, Long Tasks, Layouts/Paints, and Network metrics

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CDP_PORT = 9223;
const TARGET_URL = 'http://localhost:3000/media-screening-dashboard';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchHttp(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(new Error(data.error.message));
          else cb.resolve(data.result);
        } else if (data.method) {
          this.events.push(data);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
    }
  }
}

async function run() {
  console.log('===============================================================');
  console.log('  CHROME DEVTOOLS BASELINE PERFORMANCE MEASUREMENT             ');
  console.log('===============================================================\n');

  // 1. Measure Static File & API Network baseline directly from Node first
  console.log('--- 1. Network & Asset Baseline (Transfer Size & Response Time) ---');
  const assetsToTest = [
    { name: 'HTML (Dashboard)', path: '/media-screening-dashboard' },
    { name: 'CSS tokens.css', path: '/css/tokens.css' },
    { name: 'CSS style.css', path: '/css/style.css' },
    { name: 'JS app.js', path: '/js/app.js' },
    { name: 'JS seatCategoryColors.js', path: '/js/seatCategoryColors.js' },
    { name: 'JSON pavalai_layout.json', path: '/data/pavalai_layout.json' },
    { name: 'API /api/screenings', path: '/api/screenings' },
    { name: 'API /api/branches', path: '/api/branches' },
    { name: 'API /api/guests', path: '/api/guests?screeningId=scr-01' },
    { name: 'API /api/stats/overview-cinema', path: '/api/stats/overview-cinema?screeningId=scr-01' },
  ];

  const networkResults = [];
  for (const asset of assetsToTest) {
    const start = performance.now();
    const data = await new Promise((resolve, reject) => {
      const req = http.get({
        hostname: 'localhost',
        port: 3000,
        path: asset.path,
        headers: { 'Accept-Encoding': 'gzip, deflate' }
      }, res => {
        let size = 0;
        let contentEncoding = res.headers['content-encoding'] || 'none';
        let cacheControl = res.headers['cache-control'] || 'none';
        res.on('data', chunk => size += chunk.length);
        res.on('end', () => resolve({ size, contentEncoding, cacheControl, status: res.statusCode }));
      });
      req.on('error', reject);
    });
    const duration = performance.now() - start;
    networkResults.push({
      name: asset.name,
      sizeBytes: data.size,
      sizeKB: (data.size / 1024).toFixed(1) + ' KB',
      durationMs: duration.toFixed(1) + ' ms',
      encoding: data.contentEncoding,
      cache: data.cacheControl
    });
    console.log(`[NET] ${asset.name.padEnd(30)} ${((data.size/1024).toFixed(1) + ' KB').padStart(10)} | ${duration.toFixed(1)} ms | Encoding: ${data.contentEncoding} | Cache: ${data.cacheControl}`);
  }

  // 2. Launch Chrome
  console.log('\n--- 2. Spawning Headless Chrome for Runtime & DevTools Profiling ---');
  const userDataDir = path.join(__dirname, '../.chrome_perf_profile');
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--no-first-run',
    '--window-size=1366,768'
  ], { stdio: 'ignore' });

  let cdp = null;
  try {
    // Wait for Chrome CDP ready
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await sleep(300);
      try {
        targets = await fetchHttp(`http://localhost:${CDP_PORT}/json/list`);
        if (targets && targets.length > 0) break;
      } catch (_) {}
    }

    if (!targets || targets.length === 0) {
      throw new Error('Chrome failed to respond on CDP port ' + CDP_PORT);
    }

    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    console.log('Connected to Chrome DevTools Protocol successfully.');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Performance.enable');

    // Navigate to dashboard
    console.log(`Navigating to ${TARGET_URL}...`);
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2500); // Wait for initial render, pavalai layout, guests to load

    // 3. Measure DOM nodes per view
    console.log('\n--- 3. DOM Node Counts Per View ---');
    const domOverview = await cdp.evaluate(`document.querySelectorAll('*').length`);
    console.log(`[DOM] Overview View total DOM nodes: ${domOverview}`);

    // Switch to Seats View
    await cdp.evaluate(`switchView('seats')`);
    await sleep(800);
    const domSeats = await cdp.evaluate(`document.querySelectorAll('*').length`);
    const seatBtnCount = await cdp.evaluate(`document.querySelectorAll('.cinema-seat').length`);
    const willChangeSeats = await cdp.evaluate(`document.querySelectorAll('.cinema-seat[style*="will-change"], .cinema-seat').length`);
    console.log(`[DOM] Seats View total DOM nodes: ${domSeats} (Seats: ${seatBtnCount})`);

    // Switch to Guests View
    await cdp.evaluate(`switchView('guests')`);
    await sleep(800);
    const domGuests = await cdp.evaluate(`document.querySelectorAll('*').length`);
    const guestRows = await cdp.evaluate(`document.querySelectorAll('#guestTableBody tr').length`);
    console.log(`[DOM] Guests View total DOM nodes: ${domGuests} (Table Rows: ${guestRows})`);

    // 4. Scenario 1: Seats View - Scroll & Rapid Hover Performance
    console.log('\n--- 4. Scenario 1: Seats View (Scroll + Rapid Seat Hover) ---');
    await cdp.evaluate(`switchView('seats')`);
    await sleep(500);

    // Setup PerformanceObserver in page context for Long Tasks and measure Layout/Paint
    await cdp.evaluate(`
      window.__perfMetrics = {
        longTasks: [],
        layoutCount: 0,
        paintCount: 0
      };
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfMetrics.longTasks.push({
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
    `);

    // Simulate rapid hover over 40 seats + scroll
    const hoverStart = performance.now();
    const hoverResult = await cdp.evaluate(`
      new Promise((resolve) => {
        const seats = Array.from(document.querySelectorAll('.cinema-seat')).slice(0, 40);
        let idx = 0;
        let hoverEvents = 0;
        const interval = setInterval(() => {
          if (idx >= seats.length) {
            clearInterval(interval);
            resolve({ hoverEvents, totalSeats: seats.length });
            return;
          }
          const seat = seats[idx];
          const rect = seat.getBoundingClientRect();
          const evt = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2
          });
          seat.dispatchEvent(evt);
          hoverEvents++;
          idx++;
        }, 16); // ~60fps hover rate
      })
    `);
    const hoverTime = performance.now() - hoverStart;
    await sleep(300);

    const scenario1Metrics = await cdp.evaluate(`
      ({
        longTasks: window.__perfMetrics.longTasks,
        longTaskCount: window.__perfMetrics.longTasks.length,
        maxLongTaskDuration: window.__perfMetrics.longTasks.reduce((max, t) => Math.max(max, t.duration), 0)
      })
    `);
    console.log(`[SCENARIO 1] Hovered ${hoverResult.hoverEvents} seats over ${hoverTime.toFixed(1)}ms`);
    console.log(`[SCENARIO 1] Long Tasks (>50ms): ${scenario1Metrics.longTaskCount}`);
    if (scenario1Metrics.longTaskCount > 0) {
      console.log(`[SCENARIO 1] Long Task Durations: ${scenario1Metrics.longTasks.map(t => t.duration.toFixed(1) + 'ms').join(', ')}`);
    }

    // 5. Scenario 2: Check-in 1 Person Timing
    console.log('\n--- 5. Scenario 2: Check-In 1 Person Timing (Seat Map & Guest Table) ---');
    await cdp.evaluate(`switchView('guests')`);
    await sleep(400);

    // Measure time from button click until API responds and DOM updates
    const checkInTiming = await cdp.evaluate(`
      (async () => {
        const firstRow = document.querySelector('#guestTableBody tr');
        if (!firstRow) return { error: 'No guest row found' };
        const checkinBtn = firstRow.querySelector('.btn-checkin-toggle');
        if (!checkinBtn) return { error: 'No checkin button found' };

        const start = performance.now();
        // Trigger check-in
        checkinBtn.click();

        // Wait until button state changes or table updates
        let waitTime = 0;
        while (waitTime < 5000) {
          await new Promise(r => setTimeout(r, 20));
          waitTime += 20;
          const currentBtn = document.querySelector('#guestTableBody tr .btn-checkin-toggle');
          if (currentBtn && (currentBtn.classList.contains('checked-in') || currentBtn.classList.contains('not-checked'))) {
            // check if state stabilized
            break;
          }
        }
        const domUpdatedTime = performance.now() - start;
        return { durationMs: domUpdatedTime };
      })()
    `);
    console.log(`[SCENARIO 2] Check-In roundtrip update time: ${checkInTiming.durationMs ? checkInTiming.durationMs.toFixed(1) + ' ms' : checkInTiming.error}`);

    // 6. Scenario 3: Guest Search & Filter Switch Latency
    console.log('\n--- 6. Scenario 3: Guest Search & Filter Switch Latency ---');
    const searchTiming = await cdp.evaluate(`
      (async () => {
        const input = document.getElementById('guestSearchInput');
        if (!input) return { error: 'No search input' };

        const query = 'โกดัง';
        const start = performance.now();

        // Simulate typing character by character
        for (let i = 0; i < query.length; i++) {
          input.value = query.slice(0, i + 1);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 10)); // rapid typing
        }

        const afterTyping = performance.now() - start;

        // Tab filter switch
        const tabStart = performance.now();
        const unassignedTab = document.querySelector('.guest-tab-chip[data-tab-filter="unassigned"]');
        if (unassignedTab) unassignedTab.click();
        const afterTab = performance.now() - tabStart;

        // Reset
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const allTab = document.querySelector('.guest-tab-chip[data-tab-filter="all"]');
        if (allTab) allTab.click();

        return {
          typingDurationMs: afterTyping,
          tabSwitchDurationMs: afterTab,
          totalDurationMs: afterTyping + afterTab
        };
      })()
    `);
    console.log(`[SCENARIO 3] Typing search query ("โกดัง"): ${searchTiming.typingDurationMs.toFixed(1)} ms`);
    console.log(`[SCENARIO 3] Filter tab switch: ${searchTiming.tabSwitchDurationMs.toFixed(1)} ms`);

    // Output Summary
    console.log('\n===============================================================');
    console.log('  BASELINE MEASUREMENT SUMMARY                                ');
    console.log('===============================================================');
    console.log(JSON.stringify({
      network: networkResults,
      domNodes: { overview: domOverview, seats: domSeats, guests: domGuests },
      scenario1_hover: scenario1Metrics,
      scenario2_checkin: checkInTiming,
      scenario3_search: searchTiming
    }, null, 2));

  } finally {
    if (cdp) cdp.close();
    chromeProc.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

run().catch(err => {
  console.error('Measurement failed:', err);
  process.exit(1);
});
