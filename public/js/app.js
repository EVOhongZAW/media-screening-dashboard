/**
 * รอบสื่อ - Guest & Seat Manager
 * Core Application Script with Screening Management
 */

const state = {
  currentView: 'overview',
  branches: [],
  screenings: [],
  activeScreeningId: null,
  guests: [],
  overview: null,
  selectedSeat: null,
  selectedGuestId: null,
  filters: {
    search: '',
    status: 'all',
    platform: 'all'
  }
};

// Seat layout definition: 60 seats (6 rows A-F, 10 cols)
const SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SEAT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function getSeatZone(row) {
  if (row === 'A' || row === 'B') return 'vip';
  if (row === 'C' || row === 'D') return 'press';
  return 'creator';
}

function getSeatZoneLabel(zone) {
  if (zone === 'vip') return 'VIP';
  if (zone === 'press') return 'สื่อ';
  return 'ครีเอเตอร์';
}

// Toast notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupEventListeners();
  setupScreeningManagement();
  await initializeScreeningsAndData();
});

// Setup navigation between the 3 views
function setupNavigation() {
  const navButtons = document.querySelectorAll('.nav-item');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
    });
  });
}

function switchView(viewName) {
  state.currentView = viewName;

  // Update nav buttons
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  // Update view sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const activeSection = document.getElementById(`view-${viewName}`);
  if (activeSection) {
    activeSection.classList.add('active');
  }

  // Render view-specific elements
  if (viewName === 'overview') {
    renderOverview();
  } else if (viewName === 'seats') {
    renderSeatsGrid();
  } else if (viewName === 'guests') {
    renderGuestTable();
  }
}

// ================= SCREENING MANAGEMENT =================
async function initializeScreeningsAndData() {
  try {
    const [branchesRes, screeningsRes] = await Promise.all([
      API.getBranches(),
      API.getScreenings()
    ]);

    if (branchesRes.success) {
      state.branches = branchesRes.data;
      populateBranchDropdowns();
    }

    if (screeningsRes.success && screeningsRes.data.length > 0) {
      state.screenings = screeningsRes.data;
      // Default to scr-premiere if present, else first
      const defaultSc = state.screenings.find(s => s.id === 'scr-premiere') || state.screenings[0];
      state.activeScreeningId = defaultSc.id;
      renderScreeningSelector();
      updateScreeningSubtitles();
    }

    await refreshData();
  } catch (err) {
    console.error('Initialization error:', err);
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลรอบฉาย: ' + err.message, 'error');
  }
}

function populateBranchDropdowns() {
  const addBranchSelect = document.getElementById('addScreeningBranch');
  const editBranchSelect = document.getElementById('editScreeningBranch');

  const optionsHtml = state.branches.map(b => `
    <option value="${b.id}">${b.name} (${b.group})</option>
  `).join('');

  if (addBranchSelect) addBranchSelect.innerHTML = optionsHtml;
  if (editBranchSelect) editBranchSelect.innerHTML = optionsHtml;
}

function renderScreeningSelector() {
  const select = document.getElementById('activeScreeningSelect');
  if (!select) return;

  select.innerHTML = state.screenings.map(s => {
    const branch = state.branches.find(b => b.id === s.branchId);
    const branchName = branch ? branch.name : (s.branchName || 'ไม่ระบุสาขา');
    const theater = s.theater || 'โรงภาพยนตร์ 1';
    const dateStr = s.date ? ` · ${s.date}` : '';
    const timeStr = s.time ? ` ${s.time}` : '';
    return `<option value="${s.id}">${s.title} (${branchName} · ${theater}${dateStr}${timeStr})</option>`;
  }).join('');

  if (state.activeScreeningId) {
    select.value = state.activeScreeningId;
  }
}

function updateScreeningSubtitles() {
  const currentScreening = state.screenings.find(s => s.id === state.activeScreeningId);
  if (!currentScreening) return;

  const branch = state.branches.find(b => b.id === currentScreening.branchId);
  const branchName = branch ? branch.name : (currentScreening.branchName || 'ไม่ระบุสาขา');
  const theater = currentScreening.theater || 'โรงภาพยนตร์ 1';
  const capacity = currentScreening.capacity || 60;
  const dateStr = currentScreening.date ? ` · วันที่ ${currentScreening.date}` : '';
  const timeStr = currentScreening.time ? ` ${currentScreening.time} น.` : '';

  const subtitleText = `${currentScreening.title} · ${branchName} · ${theater}${dateStr}${timeStr} · ${capacity} ที่นั่ง`;

  const overviewSub = document.getElementById('overviewSubtitle');
  const seatsSub = document.getElementById('seatsSubtitle');
  const guestsSub = document.getElementById('guestsSubtitle');

  if (overviewSub) overviewSub.textContent = subtitleText;
  if (seatsSub) seatsSub.textContent = `คลิกที่นั่งเพื่อดูรายละเอียดหรือมอบหมายแขก · ${theater} (${capacity} ที่นั่ง)`;
  if (guestsSub) guestsSub.textContent = `ค้นหาและกรองแขกสำหรับรอบ: ${currentScreening.title}`;
}

function setupScreeningManagement() {
  // Selector change
  const select = document.getElementById('activeScreeningSelect');
  if (select) {
    select.addEventListener('change', async (e) => {
      state.activeScreeningId = e.target.value;
      state.selectedSeat = null;
      state.selectedGuestId = null;
      updateScreeningSubtitles();
      await refreshData();
      showToast('สลับไปยังรอบฉายเรียบร้อยแล้ว');
    });
  }

  // Add Screening Modal
  const btnAdd = document.getElementById('btnAddScreening');
  const modalAdd = document.getElementById('modalAddScreening');
  const btnCloseAdd = document.getElementById('btnCloseAddScreeningModal');
  const btnCancelAdd = document.getElementById('btnCancelAddScreening');
  const formAdd = document.getElementById('formAddScreening');

  if (btnAdd && modalAdd) {
    btnAdd.addEventListener('click', () => {
      formAdd.reset();
      // default today
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('addScreeningDate').value = today;
      document.getElementById('addScreeningCapacity').value = '60';
      modalAdd.classList.remove('hidden');
    });

    const closeModal = () => modalAdd.classList.add('hidden');
    if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeModal);
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeModal);
    modalAdd.addEventListener('click', (e) => { if (e.target === modalAdd) closeModal(); });
  }

  if (formAdd) {
    formAdd.addEventListener('submit', handleAddScreeningSubmit);
  }

  // Edit Screening Modal
  const btnEdit = document.getElementById('btnEditScreening');
  const modalEdit = document.getElementById('modalEditScreening');
  const btnCloseEdit = document.getElementById('btnCloseEditScreeningModal');
  const btnCancelEdit = document.getElementById('btnCancelEditScreening');
  const formEdit = document.getElementById('formEditScreening');
  const btnDelete = document.getElementById('btnDeleteScreening');

  if (btnEdit && modalEdit) {
    btnEdit.addEventListener('click', () => {
      const current = state.screenings.find(s => s.id === state.activeScreeningId);
      if (!current) {
        showToast('ไม่พบข้อมูลรอบฉายปัจจุบัน', 'error');
        return;
      }

      document.getElementById('editScreeningId').value = current.id;
      document.getElementById('editScreeningTitle').value = current.title || '';
      document.getElementById('editScreeningBranch').value = current.branchId || '';
      document.getElementById('editScreeningTheater').value = current.theater || '';
      document.getElementById('editScreeningDate').value = current.date || '';
      document.getElementById('editScreeningTime').value = current.time || '';
      document.getElementById('editScreeningMediaType').value = current.mediaType || 'movie';
      document.getElementById('editScreeningCapacity').value = current.capacity || 60;
      document.getElementById('editScreeningStatus').value = current.status || 'scheduled';
      document.getElementById('editScreeningNotes').value = current.notes || '';

      modalEdit.classList.remove('hidden');
    });

    const closeModal = () => modalEdit.classList.add('hidden');
    if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeModal);
    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeModal);
    modalEdit.addEventListener('click', (e) => { if (e.target === modalEdit) closeModal(); });
  }

  if (formEdit) {
    formEdit.addEventListener('submit', handleEditScreeningSubmit);
  }

  if (btnDelete) {
    btnDelete.addEventListener('click', handleDeleteScreening);
  }
}

async function handleAddScreeningSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('addScreeningTitle').value.trim();
  const branchId = document.getElementById('addScreeningBranch').value;
  const theater = document.getElementById('addScreeningTheater').value.trim();
  const date = document.getElementById('addScreeningDate').value;
  const time = document.getElementById('addScreeningTime').value;
  const mediaType = document.getElementById('addScreeningMediaType').value;
  const capacity = parseInt(document.getElementById('addScreeningCapacity').value, 10) || 60;
  const status = document.getElementById('addScreeningStatus').value;
  const notes = document.getElementById('addScreeningNotes').value.trim();

  const newScreeningData = {
    title,
    branchId,
    theater,
    date,
    time,
    mediaType,
    capacity,
    status,
    notes
  };

  try {
    const res = await API.createScreening(newScreeningData);
    if (res.success) {
      showToast('เพิ่มรอบภาพยนตร์ใหม่เรียบร้อยแล้ว');
      document.getElementById('modalAddScreening').classList.add('hidden');

      // Reload screenings list
      const screeningsRes = await API.getScreenings();
      if (screeningsRes.success) {
        state.screenings = screeningsRes.data;
        state.activeScreeningId = res.data.id;
        renderScreeningSelector();
        updateScreeningSubtitles();
        await refreshData();
      }
    }
  } catch (err) {
    showToast('สร้างรอบฉายล้มเหลว: ' + err.message, 'error');
  }
}

async function handleEditScreeningSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('editScreeningId').value;
  const title = document.getElementById('editScreeningTitle').value.trim();
  const branchId = document.getElementById('editScreeningBranch').value;
  const theater = document.getElementById('editScreeningTheater').value.trim();
  const date = document.getElementById('editScreeningDate').value;
  const time = document.getElementById('editScreeningTime').value;
  const mediaType = document.getElementById('editScreeningMediaType').value;
  const capacity = parseInt(document.getElementById('editScreeningCapacity').value, 10) || 60;
  const status = document.getElementById('editScreeningStatus').value;
  const notes = document.getElementById('editScreeningNotes').value.trim();

  const updateData = {
    title,
    branchId,
    theater,
    date,
    time,
    mediaType,
    capacity,
    status,
    notes
  };

  try {
    const res = await API.updateScreening(id, updateData);
    if (res.success) {
      showToast('บันทึกการตั้งค่ารอบหนังเรียบร้อยแล้ว');
      document.getElementById('modalEditScreening').classList.add('hidden');

      const screeningsRes = await API.getScreenings();
      if (screeningsRes.success) {
        state.screenings = screeningsRes.data;
        renderScreeningSelector();
        updateScreeningSubtitles();
        await refreshData();
      }
    }
  } catch (err) {
    showToast('บันทึกล้มเหลว: ' + err.message, 'error');
  }
}

async function handleDeleteScreening() {
  const id = document.getElementById('editScreeningId').value;
  const current = state.screenings.find(s => s.id === id);
  const title = current ? current.title : 'รอบนี้';

  if (!confirm(`ยืนยันการลบ "${title}" หรือไม่? ข้อมูลแขกในรอบนี้จะถูกลบด้วย`)) return;

  try {
    const res = await API.deleteScreening(id);
    if (res.success) {
      showToast('ลบรอบภาพยนตร์สำเร็จ');
      document.getElementById('modalEditScreening').classList.add('hidden');

      const screeningsRes = await API.getScreenings();
      if (screeningsRes.success && screeningsRes.data.length > 0) {
        state.screenings = screeningsRes.data;
        state.activeScreeningId = state.screenings[0].id;
      } else {
        state.screenings = [];
        state.activeScreeningId = null;
      }
      renderScreeningSelector();
      updateScreeningSubtitles();
      await refreshData();
    }
  } catch (err) {
    showToast('ลบล้มเหลว: ' + err.message, 'error');
  }
}

// Setup event listeners for filtering, modals, search
function setupEventListeners() {
  // Search input
  const searchInput = document.getElementById('guestSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value;
      renderGuestTable();
    });
  }

  // Filter Status
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      renderGuestTable();
    });
  }

  // Filter Platform
  const filterPlatform = document.getElementById('filterPlatform');
  if (filterPlatform) {
    filterPlatform.addEventListener('change', (e) => {
      state.filters.platform = e.target.value;
      renderGuestTable();
    });
  }

  // Modal: Add Guest
  const btnOpenAdd = document.getElementById('btnOpenAddGuestModal');
  const modalAdd = document.getElementById('modalAddGuest');
  const btnCloseAdd = document.getElementById('btnCloseAddGuestModal');
  const btnCancelAdd = document.getElementById('btnCancelAddGuest');
  const formAdd = document.getElementById('formAddGuest');

  if (btnOpenAdd && modalAdd) {
    btnOpenAdd.addEventListener('click', () => {
      populateAvailableSeatsSelect();
      modalAdd.classList.remove('hidden');
    });

    const closeModal = () => modalAdd.classList.add('hidden');
    if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeModal);
    if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeModal);

    modalAdd.addEventListener('click', (e) => {
      if (e.target === modalAdd) closeModal();
    });
  }

  if (formAdd) {
    formAdd.addEventListener('submit', handleAddGuestSubmit);
  }
}

// Refresh all data from backend (filtered by active screening)
async function refreshData() {
  try {
    const params = {};
    if (state.activeScreeningId) {
      params.screeningId = state.activeScreeningId;
    }

    const [overviewRes, guestsRes] = await Promise.all([
      API.fetchJSON(`/api/stats/overview-cinema${state.activeScreeningId ? '?screeningId=' + state.activeScreeningId : ''}`),
      API.getGuests(params)
    ]);

    if (overviewRes.success) {
      state.overview = overviewRes.data;
    }
    if (guestsRes.success) {
      state.guests = guestsRes.data;
    }

    renderOverview();
    renderSeatsGrid();
    renderGuestTable();
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('ไม่สามารถเชื่อมต่อข้อมูลได้: ' + err.message, 'error');
  }
}

// ================= 1. OVERVIEW VIEW =================
function renderOverview() {
  if (!state.overview) return;

  const { totalGuests, accepted, pending, bookedSeats, totalSeats, platforms } = state.overview;

  // KPI cards
  const elTotal = document.getElementById('statTotalGuests');
  const elAcc = document.getElementById('statAccepted');
  const elPen = document.getElementById('statPending');
  const elSeats = document.getElementById('statBookedSeats');

  if (elTotal) elTotal.textContent = totalGuests;
  if (elAcc) elAcc.textContent = accepted;
  if (elPen) elPen.textContent = pending;
  if (elSeats) elSeats.textContent = `${bookedSeats}/${totalSeats}`;

  // Platform Bars
  const maxVal = Math.max(platforms.youtube || 0, platforms.tiktok || 0, platforms.facebook || 0, platforms.instagram || 0, 1);

  const updateBar = (idVal, idBar, count) => {
    const valEl = document.getElementById(idVal);
    const barEl = document.getElementById(idBar);
    if (valEl) valEl.textContent = count;
    if (barEl) {
      const pct = Math.round((count / maxVal) * 100);
      barEl.style.width = `${pct}%`;
    }
  };

  updateBar('valYT', 'barYT', platforms.youtube || 0);
  updateBar('valTT', 'barTT', platforms.tiktok || 0);
  updateBar('valFB', 'barFB', platforms.facebook || 0);
  updateBar('valIG', 'barIG', platforms.instagram || 0);
}

// Helper: build map of seat ID -> guest
function getSeatsMap() {
  const map = {};
  state.guests.forEach(guest => {
    if (guest.seat) {
      const seatList = guest.seat.split(',').map(s => s.trim());
      seatList.forEach(s => {
        if (s) map[s] = guest;
      });
    }
  });
  return map;
}

// ================= 2. SEAT MAP VIEW =================
function renderSeatsGrid() {
  const container = document.getElementById('seatsGrid');
  if (!container) return;

  const seatsMap = getSeatsMap();
  container.innerHTML = '';

  SEAT_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'seat-row';

    // Row Label
    const labelEl = document.createElement('div');
    labelEl.className = 'row-label';
    labelEl.textContent = row;
    rowEl.appendChild(labelEl);

    // Left Block (Seats 1-5)
    const leftBlock = document.createElement('div');
    leftBlock.className = 'seat-block';
    for (let c = 1; c <= 5; c++) {
      leftBlock.appendChild(createSeatButton(row, c, seatsMap));
    }
    rowEl.appendChild(leftBlock);

    // Aisle Gap
    const gapEl = document.createElement('div');
    gapEl.className = 'seat-aisle-gap';
    rowEl.appendChild(gapEl);

    // Right Block (Seats 6-10)
    const rightBlock = document.createElement('div');
    rightBlock.className = 'seat-block';
    for (let c = 6; c <= 10; c++) {
      rightBlock.appendChild(createSeatButton(row, c, seatsMap));
    }
    rowEl.appendChild(rightBlock);

    container.appendChild(rowEl);
  });

  // Re-render seat side panel if a seat is currently selected
  if (state.selectedSeat) {
    showSeatDetails(state.selectedSeat);
  }
}

function createSeatButton(row, col, seatsMap) {
  const seatId = `${row}${col}`;
  const btn = document.createElement('button');
  btn.className = 'seat-btn';
  btn.textContent = col;
  btn.dataset.seatId = seatId;

  const guest = seatsMap[seatId];
  const zone = getSeatZone(row);

  if (guest) {
    // Booked seat
    if (guest.guestType === 'vip' || zone === 'vip') {
      btn.classList.add('seat-vip-booked');
    } else if (guest.guestType === 'press' || zone === 'press') {
      btn.classList.add('seat-press-booked');
    } else {
      btn.classList.add('seat-creator-booked');
    }
    btn.title = `ที่นั่ง ${seatId}: ${guest.name} (${guest.organization || 'ไม่มีสังกัด'})`;
  } else {
    // Available seat
    if (zone === 'vip') btn.classList.add('seat-vip-empty');
    else if (zone === 'press') btn.classList.add('seat-press-empty');
    else btn.classList.add('seat-creator-empty');
    btn.title = `ที่นั่ง ${seatId} (ว่าง - โซน ${getSeatZoneLabel(zone)})`;
  }

  if (state.selectedSeat === seatId) {
    btn.classList.add('selected');
  }

  btn.addEventListener('click', () => {
    state.selectedSeat = seatId;
    renderSeatsGrid();
    showSeatDetails(seatId);
  });

  return btn;
}

function showSeatDetails(seatId) {
  const placeholder = document.getElementById('seatPanelPlaceholder');
  const content = document.getElementById('seatPanelContent');
  if (!placeholder || !content) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const seatsMap = getSeatsMap();
  const guest = seatsMap[seatId];
  const row = seatId.charAt(0);
  const zone = getSeatZone(row);
  const zoneLabel = getSeatZoneLabel(zone);

  if (guest) {
    // Occupied seat
    content.innerHTML = `
      <div class="panel-header">
        <span class="panel-seat-badge ${zone}">โซน ${zoneLabel} · ที่นั่ง ${seatId}</span>
        <div class="panel-guest-name">${escapeHtml(guest.name)}</div>
        <div class="panel-guest-org">${escapeHtml(guest.organization || 'อิสระ / ไม่ระบุสังกัด')}</div>
      </div>

      <div class="detail-section">
        <div class="section-label">สถานะการตอบรับ</div>
        <div>${renderStatusPill(guest.status)}</div>
      </div>

      <div class="detail-section">
        <div class="section-label">ข้อมูลติดต่อ</div>
        ${guest.phone ? `<div class="contact-item"><i class="fa-solid fa-phone"></i> ${escapeHtml(guest.phone)}</div>` : ''}
        ${guest.email ? `<div class="contact-item"><i class="fa-solid fa-envelope"></i> ${escapeHtml(guest.email)}</div>` : ''}
      </div>

      ${guest.platforms ? `
        <div class="detail-section">
          <div class="section-label">ช่องทางคอนเทนต์</div>
          <div class="panel-socials">
            ${renderPanelSocials(guest)}
          </div>
        </div>
      ` : ''}

      ${guest.notes ? `
        <div class="detail-section">
          <div class="section-label">หมายเหตุ</div>
          <div style="font-size: 13px; color: var(--text-muted);">${escapeHtml(guest.notes)}</div>
        </div>
      ` : ''}

      <div class="panel-actions">
        <button class="btn btn-secondary" onclick="viewGuestInList('${guest.id}')">
          <i class="fa-solid fa-user"></i> ดูข้อมูลในรายชื่อแขก
        </button>
        <button class="btn btn-danger" onclick="unassignSeat('${guest.id}', '${seatId}')">
          <i class="fa-solid fa-xmark"></i> ปลดที่นั่งนี้ (ทำให้ว่าง)
        </button>
      </div>
    `;
  } else {
    // Vacant seat
    const unassignedGuests = state.guests.filter(g => !g.seat);

    content.innerHTML = `
      <div class="panel-header">
        <span class="panel-seat-badge ${zone}">โซน ${zoneLabel} · ที่นั่ง ${seatId}</span>
        <div class="panel-guest-name" style="color: var(--text-muted);">ที่นั่งนี้ยังว่างอยู่</div>
        <div class="panel-guest-org">สามารถมอบหมายแขกที่ยังไม่มีที่นั่งเข้ามานั่งได้</div>
      </div>

      <div class="detail-section" style="margin-top: 10px;">
        <label class="section-label" for="selectAssignGuest">เลือกแขกเพื่อมอบหมายที่นั่ง</label>
        <select id="selectAssignGuest" class="select-dropdown" style="width: 100%; margin-top: 6px;">
          <option value="">-- เลือกแขก (${unassignedGuests.length} คนที่ยังไม่จัดที่นั่ง) --</option>
          ${unassignedGuests.map(g => `
            <option value="${g.id}">${escapeHtml(g.name)} (${escapeHtml(g.organization || g.guestType)})${g.status === 'accepted' ? ' - ตอบรับแล้ว' : ''}</option>
          `).join('')}
        </select>
      </div>

      <div class="panel-actions" style="margin-top: 16px;">
        <button class="btn btn-primary" onclick="assignSeatToGuest('${seatId}')">
          <i class="fa-solid fa-check"></i> ยืนยันมอบหมายที่นั่ง
        </button>
      </div>
    `;
  }
}

// Action: Unassign a seat
window.unassignSeat = async function(guestId, seatId) {
  try {
    const guest = state.guests.find(g => g.id === guestId);
    if (!guest) return;

    let newSeatVal = null;
    if (guest.seat && guest.seat.includes(',')) {
      const seats = guest.seat.split(',').map(s => s.trim()).filter(s => s !== seatId);
      newSeatVal = seats.length > 0 ? seats.join(', ') : null;
    }

    const res = await API.updateGuest(guestId, { seat: newSeatVal });
    if (res.success) {
      showToast(`ปลดที่นั่ง ${seatId} สำเร็จ`);
      await refreshData();
      showSeatDetails(seatId);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
};

// Action: Assign seat to selected guest
window.assignSeatToGuest = async function(seatId) {
  const select = document.getElementById('selectAssignGuest');
  if (!select || !select.value) {
    showToast('กรุณาเลือกแขกที่ต้องการมอบหมาย', 'error');
    return;
  }

  const guestId = select.value;
  try {
    const res = await API.updateGuest(guestId, { seat: seatId });
    if (res.success) {
      showToast(`มอบหมายที่นั่ง ${seatId} สำเร็จ`);
      await refreshData();
      showSeatDetails(seatId);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
};

window.viewGuestInList = function(guestId) {
  state.selectedGuestId = guestId;
  switchView('guests');
  showGuestDetails(guestId);
};

// ================= 3. GUEST LIST VIEW =================
function renderGuestTable() {
  const tbody = document.getElementById('guestTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  let filtered = [...state.guests];
  const { search, status, platform } = state.filters;

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(g =>
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.organization && g.organization.toLowerCase().includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.email && g.email.toLowerCase().includes(q)) ||
      (g.seat && g.seat.toLowerCase().includes(q)) ||
      (g.handles && Object.values(g.handles).some(h => h.toLowerCase().includes(q)))
    );
  }

  if (status && status !== 'all') {
    filtered = filtered.filter(g => g.status === status);
  }

  if (platform && platform !== 'all') {
    filtered = filtered.filter(g => g.platforms && g.platforms[platform]);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: var(--text-dim);">
          ไม่พบข้อมูลแขกตามเงื่อนไขที่ค้นหาสำหรับรอบนี้
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(guest => {
    const tr = document.createElement('tr');
    if (state.selectedGuestId === guest.id) {
      tr.classList.add('selected');
    }

    tr.innerHTML = `
      <td>
        <div class="guest-name-cell">
          <span class="guest-name">${escapeHtml(guest.name)}</span>
          <span class="guest-org">${escapeHtml(guest.organization || 'อิสระ / คอนเทนต์ส่วนตัว')}</span>
        </div>
      </td>
      <td>
        <div class="platform-chips">
          ${renderPlatformChips(guest.platforms)}
        </div>
      </td>
      <td>
        ${renderStatusPill(guest.status)}
      </td>
      <td>
        <span class="seat-badge ${guest.seat ? 'assigned' : 'unassigned'}">
          ${guest.seat ? escapeHtml(guest.seat) : 'ยังไม่จัด'}
        </span>
      </td>
    `;

    tr.addEventListener('click', () => {
      state.selectedGuestId = guest.id;
      document.querySelectorAll('.guest-table tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      showGuestDetails(guest.id);
    });

    tbody.appendChild(tr);
  });

  if (state.selectedGuestId) {
    showGuestDetails(state.selectedGuestId);
  }
}

function renderPlatformChips(platforms) {
  if (!platforms) return '<span style="color: var(--text-dim);">-</span>';

  const chips = [];
  if (platforms.tiktok) {
    chips.push(`<span class="chip tt"><i class="fa-brands fa-tiktok"></i> ${platforms.tiktok}</span>`);
  }
  if (platforms.instagram) {
    chips.push(`<span class="chip ig"><i class="fa-brands fa-instagram"></i> ${platforms.instagram}</span>`);
  }
  if (platforms.facebook) {
    chips.push(`<span class="chip fb"><i class="fa-brands fa-facebook-f"></i> ${platforms.facebook}</span>`);
  }
  if (platforms.youtube) {
    chips.push(`<span class="chip yt"><i class="fa-brands fa-youtube"></i> ${platforms.youtube}</span>`);
  }

  return chips.join('') || '<span style="color: var(--text-dim);">-</span>';
}

function renderStatusPill(status) {
  if (status === 'accepted') {
    return `<span class="status-pill status-accepted"><span class="status-dot"></span> ตอบรับแล้ว</span>`;
  }
  if (status === 'pending') {
    return `<span class="status-pill status-pending"><span class="status-dot"></span> รอตอบรับ</span>`;
  }
  return `<span class="status-pill status-declined"><span class="status-dot"></span> ปฏิเสธ</span>`;
}

function renderPanelSocials(guest) {
  if (!guest.platforms) return '';
  const rows = [];
  const platforms = guest.platforms;
  const handles = guest.handles || {};

  if (platforms.tiktok) {
    rows.push(`
      <div class="social-row">
        <div class="social-handle" style="color: #2dd4bf;">
          <i class="fa-brands fa-tiktok"></i>
          <span>${escapeHtml(handles.tiktok || '@tiktok')}</span>
        </div>
        <div class="social-stat">${platforms.tiktok}</div>
      </div>
    `);
  }
  if (platforms.instagram) {
    rows.push(`
      <div class="social-row">
        <div class="social-handle" style="color: #f472b6;">
          <i class="fa-brands fa-instagram"></i>
          <span>${escapeHtml(handles.instagram || '@instagram')}</span>
        </div>
        <div class="social-stat">${platforms.instagram}</div>
      </div>
    `);
  }
  if (platforms.facebook) {
    rows.push(`
      <div class="social-row">
        <div class="social-handle" style="color: #60a5fa;">
          <i class="fa-brands fa-facebook-f"></i>
          <span>${escapeHtml(handles.facebook || 'Facebook')}</span>
        </div>
        <div class="social-stat">${platforms.facebook}</div>
      </div>
    `);
  }
  if (platforms.youtube) {
    rows.push(`
      <div class="social-row">
        <div class="social-handle" style="color: #f87171;">
          <i class="fa-brands fa-youtube"></i>
          <span>${escapeHtml(handles.youtube || 'YouTube Channel')}</span>
        </div>
        <div class="social-stat">${platforms.youtube}</div>
      </div>
    `);
  }

  return rows.join('');
}

function showGuestDetails(guestId) {
  const placeholder = document.getElementById('guestPanelPlaceholder');
  const content = document.getElementById('guestPanelContent');
  if (!placeholder || !content) return;

  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const seatsMap = getSeatsMap();
  const allSeats = [];
  SEAT_ROWS.forEach(r => {
    SEAT_COLS.forEach(c => {
      const sId = `${r}${c}`;
      const isOccupiedByOther = seatsMap[sId] && seatsMap[sId].id !== guest.id;
      if (!isOccupiedByOther) {
        allSeats.push(sId);
      }
    });
  });

  content.innerHTML = `
    <div class="panel-header">
      <span class="panel-seat-badge ${guest.guestType || 'vip'}">
        ${guest.guestType === 'vip' ? 'VIP' : guest.guestType === 'press' ? 'สื่อมวลชน' : 'ครีเอเตอร์'}
      </span>
      <div class="panel-guest-name">${escapeHtml(guest.name)}</div>
      <div class="panel-guest-org">${escapeHtml(guest.organization || 'อิสระ / คอนเทนต์ส่วนตัว')}</div>
    </div>

    <!-- Quick Status Change -->
    <div class="detail-section">
      <label class="section-label" for="guestDetailStatus">สถานะการตอบรับ</label>
      <select id="guestDetailStatus" class="select-dropdown" style="width: 100%;">
        <option value="accepted" ${guest.status === 'accepted' ? 'selected' : ''}>ตอบรับแล้ว</option>
        <option value="pending" ${guest.status === 'pending' ? 'selected' : ''}>รอตอบรับ</option>
        <option value="declined" ${guest.status === 'declined' ? 'selected' : ''}>ปฏิเสธ</option>
      </select>
    </div>

    <!-- Quick Seat Change -->
    <div class="detail-section">
      <label class="section-label" for="guestDetailSeat">ที่นั่งที่จัดไว้</label>
      <select id="guestDetailSeat" class="select-dropdown" style="width: 100%;">
        <option value="">-- ยังไม่จัดที่นั่ง --</option>
        ${allSeats.map(s => `
          <option value="${s}" ${guest.seat === s ? 'selected' : ''}>${s} (${getSeatZoneLabel(getSeatZone(s.charAt(0)))})</option>
        `).join('')}
        ${guest.seat && !allSeats.includes(guest.seat) ? `<option value="${guest.seat}" selected>${guest.seat}</option>` : ''}
      </select>
    </div>

    <!-- Contact Info -->
    <div class="detail-section">
      <div class="section-label">ข้อมูลติดต่อ</div>
      <div class="contact-item"><i class="fa-solid fa-phone"></i> ${escapeHtml(guest.phone || 'ไม่ระบุเบอร์โทร')}</div>
      <div class="contact-item"><i class="fa-solid fa-envelope"></i> ${escapeHtml(guest.email || 'ไม่ระบุอีเมล')}</div>
    </div>

    <!-- Social Channels -->
    <div class="detail-section">
      <div class="section-label">ช่องทางคอนเทนต์</div>
      <div class="panel-socials">
        ${renderPanelSocials(guest) || '<span style="color: var(--text-dim); font-size: 12px;">ไม่มีข้อมูลช่องทาง</span>'}
      </div>
    </div>

    ${guest.notes ? `
      <div class="detail-section">
        <div class="section-label">หมายเหตุ</div>
        <div style="font-size: 13px; color: var(--text-muted);">${escapeHtml(guest.notes)}</div>
      </div>
    ` : ''}

    <div class="panel-actions" style="margin-top: 10px;">
      <button class="btn btn-primary" onclick="saveGuestChanges('${guest.id}')">
        <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไข
      </button>
      <button class="btn btn-danger" onclick="deleteGuestConfirm('${guest.id}')">
        <i class="fa-solid fa-trash"></i> ลบแขกท่านนี้
      </button>
    </div>
  `;
}

window.saveGuestChanges = async function(guestId) {
  const statusSelect = document.getElementById('guestDetailStatus');
  const seatSelect = document.getElementById('guestDetailSeat');

  const updates = {
    status: statusSelect ? statusSelect.value : undefined,
    seat: seatSelect ? (seatSelect.value || null) : undefined
  };

  try {
    const res = await API.updateGuest(guestId, updates);
    if (res.success) {
      showToast('บันทึกข้อมูลเรียบร้อยแล้ว');
      await refreshData();
      showGuestDetails(guestId);
    }
  } catch (err) {
    showToast('บันทึกล้มเหลว: ' + err.message, 'error');
  }
};

window.deleteGuestConfirm = async function(guestId) {
  if (!confirm('ยืนยันการลบแขกท่านนี้?')) return;

  try {
    const res = await API.deleteGuest(guestId);
    if (res.success) {
      showToast('ลบข้อมูลแขกเรียบร้อย');
      state.selectedGuestId = null;
      document.getElementById('guestPanelPlaceholder').classList.remove('hidden');
      document.getElementById('guestPanelContent').classList.add('hidden');
      await refreshData();
    }
  } catch (err) {
    showToast('ลบล้มเหลว: ' + err.message, 'error');
  }
};

// ================= MODAL: ADD GUEST =================
function populateAvailableSeatsSelect() {
  const seatSelect = document.getElementById('addGuestSeat');
  if (!seatSelect) return;

  const seatsMap = getSeatsMap();
  seatSelect.innerHTML = '<option value="">-- ยังไม่จัดที่นั่ง --</option>';

  SEAT_ROWS.forEach(r => {
    SEAT_COLS.forEach(c => {
      const sId = `${r}${c}`;
      if (!seatsMap[sId]) {
        const zone = getSeatZoneLabel(getSeatZone(r));
        const opt = document.createElement('option');
        opt.value = sId;
        opt.textContent = `${sId} (โซน ${zone})`;
        seatSelect.appendChild(opt);
      }
    });
  });
}

async function handleAddGuestSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('addGuestName').value.trim();
  const organization = document.getElementById('addGuestOrg').value.trim();
  const guestType = document.getElementById('addGuestType').value;
  const status = document.getElementById('addGuestStatus').value;
  const phone = document.getElementById('addGuestPhone').value.trim();
  const email = document.getElementById('addGuestEmail').value.trim();
  const seat = document.getElementById('addGuestSeat').value || null;
  const notes = document.getElementById('addGuestNotes').value.trim();

  const tt = document.getElementById('addFollowerTT').value.trim();
  const ig = document.getElementById('addFollowerIG').value.trim();
  const fb = document.getElementById('addFollowerFB').value.trim();
  const yt = document.getElementById('addFollowerYT').value.trim();

  const platforms = {};
  if (tt) platforms.tiktok = tt;
  if (ig) platforms.instagram = ig;
  if (fb) platforms.facebook = fb;
  if (yt) platforms.youtube = yt;

  const handles = {};
  if (tt) handles.tiktok = '@' + name.replace(/\s+/g, '').toLowerCase();
  if (ig) handles.instagram = '@' + name.replace(/\s+/g, '_').toLowerCase();
  if (fb) handles.facebook = name;
  if (yt) handles.youtube = name + ' Channel';

  const newGuestData = {
    screeningId: state.activeScreeningId,
    name,
    organization,
    guestType,
    status,
    phone,
    email,
    seat,
    notes,
    platforms,
    handles
  };

  try {
    const res = await API.createGuest(newGuestData);
    if (res.success) {
      showToast('เพิ่มแขกใหม่เรียบร้อยแล้ว');
      document.getElementById('modalAddGuest').classList.add('hidden');
      document.getElementById('formAddGuest').reset();
      await refreshData();
      state.selectedGuestId = res.data.id;
      switchView('guests');
    }
  } catch (err) {
    showToast('เพิ่มแขกล้มเหลว: ' + err.message, 'error');
  }
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
