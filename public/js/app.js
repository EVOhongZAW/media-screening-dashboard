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
  activeSeatFilter: 'all',
  activeTier: 'all',
  pavalaiLayout: null,
  filters: {
    search: '',
    checkIn: 'all',
    seatStatus: 'all',
    pic: 'all',
    tab: 'all'
  },
  sortFollower: null,
  guestPage: 1,
  guestPageSize: 25,
  seatColors: {},
  activeCategoryFilter: 'all'
};

// Seat layout definition: Fallback rows up to L
const ALL_SEAT_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const SEAT_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function getSeatZone(row, category) {
  if (category === 'vip' || ['VP', 'AA', 'FH', 'FG'].includes(row)) return 'vip';
  if (category === 'privilege' || ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'].includes(row)) return 'press';
  if (category === 'balcony' || ['FA', 'FB', 'FC', 'FD', 'FE', 'FF'].includes(row)) return 'balcony';
  return 'creator';
}

function getSeatZoneLabel(zone) {
  if (zone === 'vip') return 'Paragon VIP';
  if (zone === 'press' || zone === 'privilege') return 'Privilege Chair';
  if (zone === 'balcony') return 'Royal Balcony';
  return 'Standard Hall';
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

  const urlParams = new URLSearchParams(window.location.search);
  const requestedView = urlParams.get('view') || (window.location.hash ? window.location.hash.replace('#', '') : null);
  if (requestedView && ['overview', 'seats', 'guests'].includes(requestedView)) {
    switchView(requestedView);
  }
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

// ================= PAVALAI LAYOUT LOADER =================
async function loadPavalaiLayout() {
  try {
    const res = await fetch('/api/branches/pavalai-layout');
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        state.pavalaiLayout = json.data;
        return;
      }
    }
  } catch (err) {
    console.warn('API pavalai-layout failed, fallback to static json', err);
  }
  try {
    const staticRes = await fetch('/data/pavalai_layout.json');
    if (staticRes.ok) {
      state.pavalaiLayout = await staticRes.json();
    }
  } catch (err) {
    console.error('Failed to load static pavalai layout', err);
  }
}

// ================= SCREENING MANAGEMENT =================
async function initializeScreeningsAndData() {
  try {
    await loadPavalaiLayout();

    const [branchesRes, screeningsRes] = await Promise.all([
      API.getBranches(),
      API.getScreenings()
    ]);

    if (branchesRes.success) {
      state.branches = branchesRes.data;
      populateVenueDropdowns();
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


function populateVenueDropdowns() {
  const addVenueSelect = document.getElementById('addScreeningVenue');
  const editVenueSelect = document.getElementById('editScreeningVenue');

  const groupsHtml = state.branches.map(b => {
    const theaters = b.theaters && b.theaters.length > 0 ? b.theaters : ['โรงภาพยนตร์ 1', 'โรงภาพยนตร์ 2'];
    const options = theaters.map(th => {
      return `<option value="${b.id}|||${th}">${b.name} - ${th}</option>`;
    }).join('');
    return `<optgroup label="${b.name} (${b.group})">${options}</optgroup>`;
  }).join('');

  const fullHtml = groupsHtml + `
    <optgroup label="กำหนดเอง">
      <option value="custom|||custom">+ ระบุสาขาและชื่อโรงภาพยนตร์เอง...</option>
    </optgroup>
  `;

  if (addVenueSelect) addVenueSelect.innerHTML = fullHtml;
  if (editVenueSelect) editVenueSelect.innerHTML = fullHtml;
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
  const addVenueSelect = document.getElementById('addScreeningVenue');
  const addCustomRow = document.getElementById('addCustomVenueRow');

  if (addVenueSelect && addCustomRow) {
    addVenueSelect.addEventListener('change', () => {
      if (addVenueSelect.value.startsWith('custom')) {
        addCustomRow.classList.remove('hidden');
      } else {
        addCustomRow.classList.add('hidden');
      }
    });
  }

  if (btnAdd && modalAdd) {
    btnAdd.addEventListener('click', () => {
      formAdd.reset();
      // default today
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('addScreeningDate').value = today;
      document.getElementById('addScreeningCapacity').value = '60';

      // Default to Major Cineplex Paragon - Pavalai
      const defaultVenue = 'branch-04|||Pavalai (Pavalai Royal Grand Theatre)';
      if (addVenueSelect && addVenueSelect.querySelector(`option[value="${defaultVenue}"]`)) {
        addVenueSelect.value = defaultVenue;
      }
      if (addCustomRow) addCustomRow.classList.add('hidden');

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
  const editVenueSelect = document.getElementById('editScreeningVenue');
  const editCustomRow = document.getElementById('editCustomVenueRow');

  if (editVenueSelect && editCustomRow) {
    editVenueSelect.addEventListener('change', () => {
      if (editVenueSelect.value.startsWith('custom')) {
        editCustomRow.classList.remove('hidden');
      } else {
        editCustomRow.classList.add('hidden');
      }
    });
  }

  if (btnEdit && modalEdit) {
    btnEdit.addEventListener('click', () => {
      const current = state.screenings.find(s => s.id === state.activeScreeningId);
      if (!current) {
        showToast('ไม่พบข้อมูลรอบฉายปัจจุบัน', 'error');
        return;
      }

      document.getElementById('editScreeningId').value = current.id;
      document.getElementById('editScreeningTitle').value = current.title || '';

      // Match combined venue dropdown
      if (editVenueSelect) {
        const venueVal = `${current.branchId}|||${current.theater}`;
        let opt = editVenueSelect.querySelector(`option[value="${venueVal}"]`);
        if (!opt) {
          const branch = state.branches.find(b => b.id === current.branchId);
          const branchName = branch ? branch.name : (current.branchName || 'สาขา');
          opt = document.createElement('option');
          opt.value = venueVal;
          opt.textContent = `${branchName} - ${current.theater}`;
          editVenueSelect.insertBefore(opt, editVenueSelect.firstChild);
        }
        editVenueSelect.value = venueVal;
      }
      if (editCustomRow) editCustomRow.classList.add('hidden');

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
  const venueVal = document.getElementById('addScreeningVenue').value;

  let branchId = '';
  let theater = '';
  if (venueVal.startsWith('custom')) {
    branchId = document.getElementById('addCustomBranchName').value.trim() || 'branch-04';
    theater = document.getElementById('addCustomTheaterName').value.trim() || 'โรงภาพยนตร์ 1';
  } else {
    const parts = venueVal.split('|||');
    branchId = parts[0];
    theater = parts[1];
  }

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
  const venueVal = document.getElementById('editScreeningVenue').value;

  let branchId = '';
  let theater = '';
  if (venueVal.startsWith('custom')) {
    branchId = document.getElementById('editCustomBranchName').value.trim() || 'branch-04';
    theater = document.getElementById('editCustomTheaterName').value.trim() || 'โรงภาพยนตร์ 1';
  } else {
    const parts = venueVal.split('|||');
    branchId = parts[0];
    theater = parts[1];
  }

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
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Filter Check-In (Sign)
  const filterCheckIn = document.getElementById('filterCheckIn');
  if (filterCheckIn) {
    filterCheckIn.addEventListener('change', (e) => {
      state.filters.checkIn = e.target.value;
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Filter Seat Status
  const filterSeatStatus = document.getElementById('filterSeatStatus');
  if (filterSeatStatus) {
    filterSeatStatus.addEventListener('change', (e) => {
      state.filters.seatStatus = e.target.value;
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Filter PIC
  const filterPic = document.getElementById('filterPic');
  if (filterPic) {
    filterPic.addEventListener('change', (e) => {
      state.filters.pic = e.target.value;
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Guest Quick Stat Tabs
  const statTabs = document.getElementById('guestStatTabs');
  if (statTabs) {
    statTabs.addEventListener('click', (e) => {
      const chip = e.target.closest('.guest-tab-chip');
      if (!chip) return;
      statTabs.querySelectorAll('.guest-tab-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filters.tab = chip.dataset.tabFilter || 'all';
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Guest Page Size Select
  const pageSizeSelect = document.getElementById('guestPageSizeSelect');
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
      state.guestPageSize = e.target.value === 'all' ? 'all' : (parseInt(e.target.value, 10) || 25);
      state.guestPage = 1;
      renderGuestTable();
    });
  }

  // Auto Assign Contiguous Seats to all unassigned guests
  const btnAutoAssign = document.getElementById('btnAutoAssignSeats');
  if (btnAutoAssign) {
    btnAutoAssign.addEventListener('click', async () => {
      const unseated = state.guests.filter(g => !g.seat || g.seat.trim() === '');
      if (unseated.length === 0) {
        showToast('ไม่มีแขกที่ยังไม่จัดที่นั่งในรอบนี้', 'info');
        return;
      }
      const totalSeatsNeeded = unseated.reduce((sum, g) => sum + (g.participant || 1), 0);
      if (!confirm(`ระบบจะค้นหาและจัดสรรที่นั่งว่างติดกันให้แขกที่ยังไม่มีที่นั่งทั้งหมด ${unseated.length} ท่าน (${totalSeatsNeeded} ที่นั่ง) โดยอัตโนมัติ\n\nต้องการดำเนินการต่อหรือไม่?`)) {
        return;
      }

      btnAutoAssign.disabled = true;
      const originalText = btnAutoAssign.innerHTML;
      btnAutoAssign.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังจัดที่นั่ง...';

      try {
        const res = await API.autoAssignSeats(state.activeScreeningId);
        if (res.success) {
          showToast(`⚡ ${res.message || 'จัดที่นั่งอัตโนมัติเรียบร้อยแล้ว'}`);
          await refreshData();
        } else {
          showToast(res.message || 'เกิดข้อผิดพลาดในการจัดที่นั่ง', 'error');
        }
      } catch (err) {
        showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
      } finally {
        btnAutoAssign.disabled = false;
        btnAutoAssign.innerHTML = originalText;
      }
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
      if (typeof updateAddGuestSeatSuggestions === 'function') {
        updateAddGuestSeatSuggestions();
      }
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

  setupAddGuestHelpers();

  // Walk-in Buttons (Header in Seating Map & Toolbar in Guest List)
  const openWalkInButtons = document.querySelectorAll(
    '#btnOpenGroupWalkInFromSeats, #btnOpenGroupWalkInFromGuests, .btn-open-walkin, .btn-header-walkin'
  );
  openWalkInButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openWalkInModal === 'function') {
        window.openWalkInModal();
      }
    });
  });

  // Seat View Filter Buttons
  document.querySelectorAll('.seat-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seat-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSeatFilter = btn.dataset.filter;
      renderSeatsGrid();
    });
  });

  // Pavalai Tier Switcher Tabs (Stalls vs Balcony vs All)
  document.querySelectorAll('.tier-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tier-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTier = btn.dataset.tier;
      renderSeatsGrid();
    });
  });

  // Setup Event Delegation for the seats grid
  setupSeatGridDelegation();

  // Setup CSV / Excel Import Modal
  setupCsvImportModal();

  // Setup Operations Suite Modals (Walk-in, Move Seat, Pre-checkin, Partial Check-in, Bulk Delete & Undo)
  setupOperationsModals();

  // Setup Follower Column Sort
  setupFollowerSort();

  // Setup Seat Category Color Coding Legend Filter
  setupCategoryLegend();
}

function setupSeatGridDelegation() {
  const container = document.getElementById('seatsGrid');
  if (!container) return;

  container.addEventListener('mouseover', (e) => {
    // 1. Check if hovering over a row label badge
    const rowLabel = e.target.closest('.row-label');
    if (rowLabel) {
      const parentRow = rowLabel.closest('.pavalai-row, .seat-row');
      if (parentRow) {
        parentRow.classList.add('row-hovered');
        parentRow.classList.remove('row-active');
      }
      return;
    }

    // 2. Check if hovering over a cinema seat
    const seatBtn = e.target.closest('.cinema-seat');
    if (!seatBtn) return;

    // Crosshair row highlighting: highlight parent row & twin left/right badges
    const parentRow = seatBtn.closest('.pavalai-row, .seat-row');
    if (parentRow) {
      parentRow.classList.add('row-active');
      parentRow.classList.remove('row-hovered');
    }
    
    const seatId = seatBtn.dataset.seatId;
    
    if (!window._cachedSeatsMap || window._cachedSeatsMapTime !== state.guests) {
      window._cachedSeatsMap = getSeatsMap();
      window._cachedSeatsMapTime = state.guests;
    }
    const seatsMap = window._cachedSeatsMap;
    const guest = seatsMap[seatId];
    
    let seatData = null;
    let zone = seatBtn.dataset.zone || '';
    
    if (state.pavalaiLayout && seatBtn.dataset.rowLabel) {
      seatData = {
        rowLabel: seatBtn.dataset.rowLabel,
        tier: seatBtn.dataset.tier,
        zone: seatBtn.dataset.zone
      };
      if (!zone) zone = getSeatZone(seatData.rowLabel, '');
    } else {
      const row = seatId.charAt(0);
      zone = getSeatZone(row);
    }
    
    showSeatHoverTooltip(e, seatId, guest, zone, seatData);
  });

  let hoverRaf = null;
  container.addEventListener('mousemove', (e) => {
    const seatBtn = e.target.closest('.cinema-seat');
    if (!seatBtn) return;
    const card = document.getElementById('seatHoverCard');
    // Performance: Skip recalculation on mousemove if already positioned for this seat
    if (card && card._currentSeatId === seatBtn.dataset.seatId) return;

    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = null;
      updateSeatHoverTooltipPosition(seatBtn);
    });
  });

  container.addEventListener('mouseout', (e) => {
    const relatedRow = e.relatedTarget ? e.relatedTarget.closest('.pavalai-row, .seat-row') : null;
    const parentRow = (e.target.closest('.cinema-seat') || e.target.closest('.row-label'))?.closest('.pavalai-row, .seat-row');
    if (parentRow && parentRow !== relatedRow) {
      parentRow.classList.remove('row-active', 'row-hovered');
    }

    const seatBtn = e.target.closest('.cinema-seat');
    if (!seatBtn) return;

    // Do not hide if moving cursor into the tooltip card itself
    const card = document.getElementById('seatHoverCard');
    if (e.relatedTarget && (e.relatedTarget === card || (card && card.contains(e.relatedTarget)))) {
      return;
    }

    hideSeatHoverTooltip();
  });

  container.addEventListener('click', (e) => {
    // 1. Handle clicking on row label to view row stats summary
    const rowLabel = e.target.closest('.row-label');
    if (rowLabel) {
      const rowName = rowLabel.dataset.row;
      if (rowName) {
        let totalInRow = 0;
        let assignedInRow = 0;
        const seatsMap = getSeatsMap();
        
        if (state.pavalaiLayout && state.pavalaiLayout.rows) {
          const rowObj = state.pavalaiLayout.rows.find(r => r.label === rowName);
          if (rowObj && rowObj.seats) {
            totalInRow = rowObj.seats.length;
            rowObj.seats.forEach(s => {
              if (seatsMap[s.id]) assignedInRow++;
            });
          }
        } else {
          for (let c = 1; c <= 10; c++) {
            totalInRow++;
            if (seatsMap[`${rowName}${c}`]) assignedInRow++;
          }
        }
        const availableInRow = totalInRow - assignedInRow;
        showToast(`📍 แถว ${rowName}: ทั้งหมด ${totalInRow} ที่นั่ง · ว่าง ${availableInRow} · จัดแล้ว ${assignedInRow} ที่`);
      }
      return;
    }

    // 2. Handle clicking on seat
    const seatBtn = e.target.closest('.cinema-seat');
    if (!seatBtn) return;

    const seatId = seatBtn.dataset.seatId;
    
    // Stateful DOM Update (No full re-render)
    if (state.selectedSeat && state.selectedSeat !== seatId) {
      const oldBtn = container.querySelector(`.cinema-seat[data-seat-id="${state.selectedSeat}"]`);
      if (oldBtn) oldBtn.classList.remove('selected');
    }
    
    state.selectedSeat = seatId;
    seatBtn.classList.add('selected');
    hideSeatHoverTooltip(true);
    
    showSeatDetails(seatId);
  });

  // Dismiss tooltip immediately when scrolling any container or window (optimal UX)
  const handleSeatScroll = () => {
    hideSeatHoverTooltip(true);
  };
  window.addEventListener('scroll', handleSeatScroll, { passive: true, capture: true });
  container.addEventListener('scroll', handleSeatScroll, { passive: true });
}

// ================= CSV / EXCEL IMPORT & SEAT RANGE EXPANSION =================
function expandSeatRanges(seatStr) {
  if (!seatStr || typeof seatStr !== 'string') return '';
  const clean = seatStr.trim();
  if (!clean) return '';

  // Split tokens by comma, semicolon, slash, or plus
  const tokens = clean.split(/[,;/+]+/).map(t => t.trim()).filter(Boolean);
  const resultSeats = [];

  for (const token of tokens) {
    // Pattern 1: AA11-AA12, B16-B17, B1-B3 (Letters+Num - Letters+Num)
    const matchFull = token.match(/^([A-Za-z]+)\s*(\d+)\s*[-–—]\s*([A-Za-z]+)\s*(\d+)$/);
    if (matchFull) {
      const row1 = matchFull[1].toUpperCase();
      const num1 = parseInt(matchFull[2], 10);
      const row2 = matchFull[3].toUpperCase();
      const num2 = parseInt(matchFull[4], 10);
      if (row1 === row2 && !isNaN(num1) && !isNaN(num2)) {
        const start = Math.min(num1, num2);
        const end = Math.max(num1, num2);
        for (let i = start; i <= end; i++) {
          resultSeats.push(`${row1}${i}`);
        }
        continue;
      }
    }

    // Pattern 2: E3-4, G11-15, I16-17, K4-5, R21-22 (Letters+Num - Num)
    const matchShort = token.match(/^([A-Za-z]+)\s*(\d+)\s*[-–—]\s*(\d+)$/);
    if (matchShort) {
      const row = matchShort[1].toUpperCase();
      const num1 = parseInt(matchShort[2], 10);
      const num2 = parseInt(matchShort[3], 10);
      if (!isNaN(num1) && !isNaN(num2)) {
        const start = Math.min(num1, num2);
        const end = Math.max(num1, num2);
        for (let i = start; i <= end; i++) {
          resultSeats.push(`${row}${i}`);
        }
        continue;
      }
    }

    // Pattern 3: Single seat e.g. F10, C16
    const singleMatch = token.match(/^([A-Za-z]+)\s*(\d+)$/);
    if (singleMatch) {
      resultSeats.push(`${singleMatch[1].toUpperCase()}${singleMatch[2]}`);
    } else {
      resultSeats.push(token.toUpperCase());
    }
  }

  // Deduplicate while preserving order
  return Array.from(new Set(resultSeats)).join(', ');
}

/**
 * Smart Attendee Name Extraction from Google Sheet Detail field
 * Levels: 1. Keyword match -> 2. Line-by-line inspection -> 3. Fallback to mediaName
 */
function extractAttendeeNameFromDetail(detailText, mediaName = '') {
  if (!detailText || typeof detailText !== 'string') return '';
  const text = detailText.trim();
  if (!text) return '';

  // 1. Keyword match
  const keywordRegex = /(?:ชื่อผู้รับบัตร|ผู้รับบัตร|รับบัตรในนาม|ชื่อผู้ติดต่อ|ผู้ติดต่อ|ชื่อคนรับบัตร|ชื่อผู้รับ|ผู้รับ)\s*[:.•\-–—\s]\s*([^\r\n•]+)/i;
  const match = text.match(keywordRegex);
  if (match && match[1]) {
    let extracted = match[1].trim();
    // Strip trailing phone numbers in parentheses e.g. "คุณโบว์ (089-999-8888)" -> "คุณโบว์"
    extracted = extracted.replace(/\s*\([0-9\-\s\+]{8,15}\)\s*$/, '').trim();
    // Strip bullet chars
    extracted = extracted.replace(/^[•\-*·\s]+/, '').trim();
    if (extracted.length >= 2 && !/^(?:\d+|ไม่สะดวก|สละสิทธิ์)$/.test(extracted)) {
      return extracted;
    }
  }

  // 2. Line-by-line inspection
  const lines = text.split(/\r?\n/).map(l => l.trim().replace(/^[•\-*·\s]+/, '').trim()).filter(Boolean);
  const mediaClean = (mediaName || '').toLowerCase().trim();

  for (const line of lines) {
    const lower = line.toLowerCase();
    // Skip if matches media/page name
    if (mediaClean && (lower === mediaClean || lower.includes(mediaClean))) continue;
    // Skip if line is URL, email, or telephone
    if (/https?:\/\/|www\.|facebook\.com|@/.test(lower)) continue;
    if (/^(?:0\d{8,9}|tel|phone|โทร)/i.test(lower)) continue;
    // Skip quota/ticket/seat lines
    if (/(?:ที่นั่ง|seat|โควตา|โควต้า|จำนวน|ใบ|คน|ตั๋ว|รอบ|วันที่|เวลา)/i.test(lower)) continue;
    // Skip greetings / notes
    if (/^(?:ขอบคุณ|ยืนยัน|ขอรับ|ไม่สะดวก|สละสิทธิ์|หมายเหตุ)/i.test(lower)) continue;

    // Check for Thai/English name patterns (e.g. "คุณเอ็ม", "(เฟิร์ส) ภัทราวุฒิ ใจสุทธิ", "เอกบุรุษ มีอิ่ม")
    if (/^คุณ\s+[ก-๙a-zA-Z]+/i.test(line)) {
      return line.replace(/\s*\([0-9\-\s\+]{8,15}\)\s*$/, '').trim();
    }
    if (/^(?:\([^\)]+\)\s*)?[ก-๙a-zA-Z]{2,}(?:\s+[ก-๙a-zA-Z]+)+$/.test(line)) {
      return line.replace(/\s*\([0-9\-\s\+]{8,15}\)\s*$/, '').trim();
    }
  }

  return '';
}

function parseCsvOrTsv(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const cleanText = rawText.replace(/^\ufeff/, '').trim();
  if (!cleanText) return [];

  // Determine delimiter (Tab, Semicolon, or Comma)
  let delimiter = '\t';
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';')) {
    delimiter = ';';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  }

  // Multiline RFC-4180 tokenizer
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(c => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return [];

  // Inspect header row
  const rawHeaders = rows[0].map(h => h.toLowerCase().trim());
  
  // Find column indexes based on keywords
  let colNo = rawHeaders.findIndex(h => h === 'no' || h === 'no.' || h === '#' || h.includes('ลำดับ'));
  let colName = rawHeaders.findIndex(h => h === 'name' || h === 'neme' || h === 'ชื่อ' || h === 'ชื่อแขก' || h === 'ชื่อสื่อ' || h === 'สื่อ' || h === 'แขก' || h === 'ผู้รับบัตร' || h === 'ผู้ติดต่อ' || h === 'guest');
  let colFollower = rawHeaders.findIndex(h => h === 'follower' || h === 'followers' || h === 'ผู้ติดตาม' || h.includes('follower') || h.includes('ผู้ติดตาม'));
  let colPic = rawHeaders.findIndex(h => h === 'pic' || h === 'ผู้ดูแล' || h === 'ผู้ประสานงาน' || h === 'coordinator' || h === 'contact person');
  let colDetail = rawHeaders.findIndex(h => h === 'detail' || h === 'details' || h === 'รายละเอียด' || h === 'สังกัด' || h === 'org' || h === 'organization' || h === 'เพจ');
  let colParticipant = rawHeaders.findIndex(h => h === 'participant' || h === 'จำนวน' || h === 'โควตา' || h === 'โควต้า' || h === 'ticket' || h === 'tickets' || h === 'qty' || h === 'count' || h.includes('จำนวน') || h.includes('โควตา'));
  let colSeat = rawHeaders.findIndex(h => h === 'seat' || h === 'seats' || h === 'seat value' || h === 'ที่นั่ง' || h.includes('ที่นั่ง'));
  let colSign = rawHeaders.findIndex(h => h === 'sign' || h === 'attended' || h.includes('เช็คอิน') || h.includes('เซ็น') || h.includes('ลายเซ็น'));
  let colTel = rawHeaders.findIndex(h => h === 'tel' || h === 'phone' || h === 'telephone' || h.includes('เบอร์') || h.includes('โทร'));

  const isGoogleSheet6Col = (colFollower >= 0 && colPic >= 0) ||
                           (rows[0].length === 6 && (rawHeaders.includes('follower') || rawHeaders.includes('pic') || rawHeaders.includes('seat value')));

  const isGoogleForm3Col = (colName >= 0 && colDetail >= 0 && colParticipant >= 0 && colSeat === -1 && colTel === -1 && colFollower === -1) ||
                           (rows[0].length === 3 && (rawHeaders.includes('name') || rawHeaders.includes('ชื่อ')) && (rawHeaders.includes('detail') || rawHeaders.includes('รายละเอียด')));

  let startIndex = 1;
  const hasKnownHeader = (colName !== -1 || colDetail !== -1 || colParticipant !== -1 || colSeat !== -1 || colTel !== -1 || colFollower !== -1 || colPic !== -1);
  if (!hasKnownHeader) {
    startIndex = 0;
    const colCount = rows[0].length;
    if (colCount === 3) {
      colName = 0;
      // Auto-detect whether col 1 or col 2 is numeric quantity
      const isCol1Numeric = /^\d+$/.test(rows[0][1]?.trim());
      const isCol2Numeric = /^\d+$/.test(rows[0][2]?.trim());
      if (isCol1Numeric && !isCol2Numeric) {
        colParticipant = 1;
        colDetail = 2;
      } else {
        colDetail = 1;
        colParticipant = 2;
      }
    } else if (colCount === 5) {
      colName = 0; colDetail = 1; colParticipant = 2; colSeat = 3; colTel = 4;
    } else if (colCount === 6) {
      const isCol1Follower = /^[\d,]+$/.test(rows[0][1]?.trim());
      const isCol3Part = /^\d{1,2}$/.test(rows[0][3]?.trim());
      const isCol5Seat = /^[A-Za-z]{1,2}\s*\d+/i.test(rows[0][5]?.trim());
      if (isCol1Follower && isCol3Part && isCol5Seat) {
        colName = 0; colFollower = 1; colPic = 2; colParticipant = 3; colDetail = 4; colSeat = 5;
      } else {
        colName = 0; colDetail = 1; colParticipant = 2; colSeat = 3; colTel = 4; colSign = 5;
      }
    } else if (colCount >= 7) {
      colNo = 0; colName = 1; colDetail = 2; colParticipant = 3; colSeat = 4; colTel = 5; colSign = 6;
    } else {
      colName = 0; colDetail = 1; colParticipant = 2;
    }
  } else if (isGoogleSheet6Col) {
    if (colName === -1) colName = 0;
    if (colFollower === -1) colFollower = 1;
    if (colPic === -1) colPic = 2;
    if (colParticipant === -1) colParticipant = 3;
    if (colDetail === -1) colDetail = 4;
    if (colSeat === -1) colSeat = 5;
  }

  function extractPhoneFromText(text) {
    if (!text) return '';
    const clean = String(text);
    // 1. In parentheses: (0812345678)
    const parenMatch = clean.match(/\((0[0-9\-\s]{8,11})\)/);
    if (parenMatch) return parenMatch[1].replace(/[\-\s]/g, '');

    // 2. Explicit label: เบอร์โทร / tel / phone
    const explicitMatch = clean.match(/(?:เบอร์โทร|เบอร์โทรศัพท์|เบอร์|โทร|tel|phone|contact)\s*[:.•\-–—]?\s*([0-9\-\+\s]{9,15})/i);
    if (explicitMatch) {
      const p = explicitMatch[1].replace(/[\-\s]/g, '');
      if (/^0[0-9]{8,9}$/.test(p)) return p;
    }

    // 3. Standalone phone: 08x-xxx-xxxx or 08xxxxxxxx
    const phoneMatch = clean.match(/(?:^|[^\d])(0[689]\d{1}[-\s]?\d{3}[-\s]?\d{4}|0[23457]\d{1}[-\s]?\d{3}[-\s]?\d{3,4})(?:$|[^\d])/);
    if (phoneMatch) {
      return phoneMatch[1].replace(/[\-\s]/g, '');
    }
    return '';
  }

  const parsedList = [];
  let confirmedCount = 0;
  let confirmedSeats = 0;
  let emptyCount = 0;
  let declinedCount = 0;

  for (let i = startIndex; i < rows.length; i++) {
    const cols = rows[i];
    if (!cols || cols.length === 0 || cols.every(c => !c)) continue;

    let noVal = colNo >= 0 && cols[colNo] !== undefined ? cols[colNo] : (parsedList.length + 1);
    
    let nameVal = colName >= 0 && cols[colName] !== undefined ? cols[colName].trim() : '';
    let detailVal = colDetail >= 0 && cols[colDetail] !== undefined ? cols[colDetail].trim() : '';
    let rawQty = colParticipant >= 0 && cols[colParticipant] !== undefined ? cols[colParticipant].trim() : '';
    let seatVal = colSeat >= 0 && cols[colSeat] !== undefined ? cols[colSeat].trim() : '';
    let signVal = colSign >= 0 && cols[colSign] !== undefined ? cols[colSign].trim() : '';
    let telVal = colTel >= 0 && cols[colTel] !== undefined ? cols[colTel].trim() : '';
    let followerVal = colFollower >= 0 && cols[colFollower] !== undefined ? cols[colFollower].trim() : '';
    let picVal = colPic >= 0 && cols[colPic] !== undefined ? cols[colPic].trim() : '';

    // If Tel is not in a dedicated column, extract telephone from Detail if available
    if (!telVal && detailVal) {
      telVal = extractPhoneFromText(detailVal);
    }

    // Determine organization and attendee name
    let orgVal = '';
    if (colFollower >= 0 || colPic >= 0 || isGoogleSheet6Col) {
      orgVal = nameVal || 'ไม่ระบุสังกัด'; // Col A is Media Name
      const extractedAttendee = extractAttendeeNameFromDetail(detailVal, orgVal);
      nameVal = extractedAttendee || orgVal || `แขกลำดับที่ ${parsedList.length + 1}`;
    } else {
      orgVal = detailVal || nameVal || 'ไม่ระบุสังกัด';
    }

    // Parse Follower number (removing commas)
    let parsedFollower = null;
    if (followerVal) {
      const parsedNum = parseInt(followerVal.replace(/,/g, ''), 10);
      if (!isNaN(parsedNum)) parsedFollower = parsedNum;
    }

    let parsedPic = (picVal && picVal.trim() !== '') ? picVal.trim() : null;

    // Decline detection
    let isDeclined = false;
    if (/ไม่เข้างาน|สละสิทธิ์|ไม่สะดวก|ไม่สามารถ|ยกเลิก|cancel|ไม่ไป/i.test(rawQty) ||
        /ไม่เข้างาน|สละสิทธิ์|ไม่สะดวก|ไม่สามารถ|ยกเลิก|cancel|ไม่ไป/i.test(detailVal)) {
      isDeclined = true;
    }

    // Empty unconfirmed row detection (Yellow rows in Google Form / Sheet)
    let isEmpty = false;
    if (!rawQty && !detailVal && !seatVal) {
      isEmpty = true;
    }

    // Participant count calculation
    let participantVal = parseInt(rawQty, 10);
    if (isNaN(participantVal) || participantVal <= 0) {
      if (rawQty) {
        const qm = rawQty.match(/\d+/);
        if (qm) participantVal = parseInt(qm[0], 10);
      }
      if ((isNaN(participantVal) || participantVal <= 0) && detailVal) {
        const dqm = detailVal.match(/(?:จำนวนผู้เข้าชม|จำนวน|โควต้า|ที่นั่ง|ใบ|คน)\s*[:.•\-–—]?\s*.*?(\d+)/i);
        if (dqm) participantVal = parseInt(dqm[1], 10);
      }
    }

    if (isEmpty) {
      participantVal = 0;
    } else if (isNaN(participantVal) || participantVal <= 0) {
      participantVal = 1;
    }

    if (!nameVal && !detailVal && !seatVal) continue;

    // Fallback if name is blank but detail exists
    if (!nameVal && detailVal) {
      nameVal = detailVal.split(/\r?\n/)[0].substring(0, 60);
    }

    if (isDeclined) {
      declinedCount++;
    } else if (isEmpty) {
      emptyCount++;
    } else {
      confirmedCount++;
      confirmedSeats += participantVal;
    }

    const expandedSeats = expandSeatRanges(seatVal);
    const attended = !!(signVal && signVal.trim() !== '' && signVal.trim() !== '-' && signVal.trim() !== '0');
    const seatArray = expandedSeats ? expandedSeats.split(',').map(s => s.trim()).filter(Boolean) : [];
    const participantCount = participantVal;

    let guestType = 'press';
    if (seatArray.some(s => s.startsWith('VP') || s.startsWith('AA') || s.startsWith('FA') || s.startsWith('FB') || s.startsWith('FC') || s.startsWith('FD') || s.startsWith('FE') || s.startsWith('FF'))) {
      guestType = 'vip';
    }

    parsedList.push({
      no: noVal,
      name: nameVal || `แขกลำดับที่ ${parsedList.length + 1}`,
      detail: detailVal,
      organization: orgVal,
      follower: parsedFollower,
      pic: parsedPic,
      participant: participantCount,
      seat: expandedSeats || null,
      seatRaw: seatVal,
      seatCount: seatArray.length,
      attended,
      phone: telVal,
      email: '',
      guestType,
      status: isDeclined ? 'declined' : (isEmpty ? 'pending' : 'accepted'),
      isDeclined,
      isEmpty,
      isConfirmed: !isDeclined && !isEmpty
    });
  }

  parsedList.fileStats = {
    totalRows: parsedList.length,
    confirmedCount,
    confirmedSeats,
    emptyCount,
    declinedCount
  };

  return parsedList;
}

let currentParsedGuests = [];

function setupCsvImportModal() {
  const modal = document.getElementById('modalImportCsv');
  const btnClose = document.getElementById('btnCloseImportCsvModal');
  const btnCancel = document.getElementById('btnCancelImportCsv');
  const btnConfirm = document.getElementById('btnConfirmImportCsv');
  const tabBtnPaste = document.getElementById('tabBtnPaste');
  const tabBtnFile = document.getElementById('tabBtnFile');
  const tabContentPaste = document.getElementById('tabContentPaste');
  const tabContentFile = document.getElementById('tabContentFile');
  const textarea = document.getElementById('importCsvTextarea');
  const fileInput = document.getElementById('csvFileInput');
  const btnBrowse = document.getElementById('btnBrowseCsvFile');
  const dropZone = document.getElementById('csvDropZone');
  const chosenFileName = document.getElementById('chosenFileName');
  const chkConfirmedOnly = document.getElementById('chkImportConfirmedOnly');

  if (!modal) return;

  const openModal = () => {
    modal.classList.remove('hidden');
    renderImportPreview();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  // Bind all buttons that open this modal
  const openButtons = document.querySelectorAll('.btn-open-import-csv, #btnOpenImportCsvModal, #btnOpenImportCsvFromSeats, #btnOpenImportCsvTop');
  openButtons.forEach(btn => {
    btn.addEventListener('click', openModal);
  });

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  if (tabBtnPaste && tabBtnFile) {
    tabBtnPaste.addEventListener('click', () => {
      tabBtnPaste.classList.add('active');
      tabBtnFile.classList.remove('active');
      tabContentPaste.classList.remove('hidden');
      tabContentFile.classList.add('hidden');
    });

    tabBtnFile.addEventListener('click', () => {
      tabBtnFile.classList.add('active');
      tabBtnPaste.classList.remove('active');
      tabContentFile.classList.remove('hidden');
      tabContentPaste.classList.add('hidden');
    });
  }

  if (textarea) {
    ['input', 'paste', 'keyup', 'change'].forEach(evt => {
      textarea.addEventListener(evt, () => {
        setTimeout(renderImportPreview, 20);
      });
    });
  }

  if (chkConfirmedOnly) {
    chkConfirmedOnly.addEventListener('change', () => {
      renderImportPreview();
    });
  }

  if (btnBrowse && fileInput) {
    btnBrowse.addEventListener('click', () => fileInput.click());
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleSelectedCsvFile(file);
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handleSelectedCsvFile(file);
    });
  }

  function handleSelectedCsvFile(file) {
    if (chosenFileName) chosenFileName.textContent = `ไฟล์ที่เลือก: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      if (textarea) textarea.value = text;
      renderImportPreview();
      showToast(`โหลดไฟล์ ${file.name} สำเร็จ กรุณาตรวจสอบตัวอย่างข้อมูล`);
    };
    reader.onerror = () => {
      showToast('ไม่สามารถอ่านไฟล์ได้', 'error');
    };
    reader.readAsText(file);
  }

  function renderImportPreview() {
    const text = textarea ? textarea.value : '';
    const parsed = parseCsvOrTsv(text);

    const previewWrapper = document.getElementById('importPreviewWrapper');
    const previewCount = document.getElementById('previewCount');
    const previewSeatCount = document.getElementById('previewSeatCount');
    const tbody = document.getElementById('previewTableBody');
    const summaryBar = document.getElementById('importSummaryBar');
    const chkOnly = document.getElementById('chkImportConfirmedOnly');

    if (!previewWrapper || !tbody) return;

    if (parsed.length === 0) {
      previewWrapper.classList.add('hidden');
      if (summaryBar) summaryBar.classList.add('hidden');
      if (btnConfirm) btnConfirm.disabled = true;
      currentParsedGuests = [];
      return;
    }

    // Update File Stats Pills
    if (summaryBar && parsed.fileStats) {
      summaryBar.classList.remove('hidden');
      const elConf = document.getElementById('sumConfirmedCount');
      if (elConf) elConf.textContent = parsed.fileStats.confirmedCount;
      const elSeats = document.getElementById('sumConfirmedSeats');
      if (elSeats) elSeats.textContent = parsed.fileStats.confirmedSeats;
      const elEmpty = document.getElementById('sumEmptyCount');
      if (elEmpty) elEmpty.textContent = parsed.fileStats.emptyCount;
      const elDec = document.getElementById('sumDeclinedCount');
      if (elDec) elDec.textContent = parsed.fileStats.declinedCount;
    }

    const filterConfirmedOnly = chkOnly ? chkOnly.checked : true;
    const finalGuests = filterConfirmedOnly 
      ? parsed.filter(p => p.isConfirmed)
      : parsed;

    currentParsedGuests = finalGuests;

    previewWrapper.classList.remove('hidden');
    if (btnConfirm) btnConfirm.disabled = finalGuests.length === 0;

    let totalSeats = 0;
    finalGuests.forEach(p => {
      totalSeats += (p.participant || 0);
    });

    if (previewCount) previewCount.textContent = finalGuests.length;

    // Check seat collisions with existing screening guests (unless replace mode)
    const replaceMode = document.querySelector('input[name="importMode"]:checked')?.value === 'replace';
    const occupiedSeatsMap = new Map();
    if (!replaceMode && Array.isArray(state.guests)) {
      state.guests.forEach(g => {
        if (!g.seat) return;
        const sList = g.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        sList.forEach(s => occupiedSeatsMap.set(s, g));
      });
    }

    const batchSeenSeats = new Map();
    let collisionCount = 0;

    const rowsHtml = finalGuests.slice(0, 50).map((item, idx) => {
      let seatDisplayHtml = '-';
      let rowHasCollision = false;

      if (item.seat) {
        const itemSeats = item.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const seatBadges = itemSeats.map(st => {
          if (!replaceMode && occupiedSeatsMap.has(st)) {
            rowHasCollision = true;
            collisionCount++;
            const occ = occupiedSeatsMap.get(st);
            return `<span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 4px; border-radius: 3px;" title="ที่นั่ง ${st} ชนกับคุณ ${escapeHtml(occ.name || '')}">${st} ⚠️ ชน</span>`;
          }
          if (batchSeenSeats.has(st)) {
            rowHasCollision = true;
            collisionCount++;
            return `<span class="badge" style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 4px; border-radius: 3px;" title="ที่นั่ง ${st} ซ้ำในไฟล์">${st} ⚠️ ซ้ำ</span>`;
          }
          batchSeenSeats.set(st, idx + 1);
          return `<span style="font-family: monospace; color: var(--color-gold); font-weight: 600;">${st}</span>`;
        });
        seatDisplayHtml = seatBadges.join(', ');
      }

      return `
      <tr style="${rowHasCollision ? 'background: rgba(239, 68, 68, 0.08);' : ''}">
        <td><strong>${escapeHtml(String(item.no || (idx + 1)))}</strong></td>
        <td><strong style="color: #fff;">${escapeHtml(item.name || '')}</strong></td>
        <td><span style="font-size: 12px; color: var(--text-muted);">${escapeHtml(item.detail || item.organization || '-')}</span></td>
        <td style="font-family: monospace; font-size: 12px;">${item.follower != null ? item.follower.toLocaleString() : '-'}</td>
        <td>${item.pic ? `<span class="pic-badge">${escapeHtml(item.pic)}</span>` : '<span style="color: var(--text-dim);">-</span>'}</td>
        <td style="text-align: center;"><strong>${item.participant}</strong></td>
        <td>${seatDisplayHtml}</td>
        <td>${escapeHtml(item.phone || '-')}</td>
        <td>
          ${rowHasCollision ? '<span class="stat-pill declined" style="padding: 2px 6px; font-size: 10.5px; margin-right: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> ที่นั่งชน</span>' : ''}
          ${item.isDeclined 
            ? '<span class="stat-pill declined" style="padding: 2px 7px; font-size: 11px;"><i class="fa-solid fa-circle-xmark"></i> สละสิทธิ์</span>' 
            : (item.isEmpty 
              ? '<span class="stat-pill empty" style="padding: 2px 7px; font-size: 11px;"><i class="fa-solid fa-clock"></i> รอข้อมูล</span>' 
              : `<span class="stat-pill confirmed" style="padding: 2px 7px; font-size: 11px;"><i class="fa-solid fa-circle-check"></i> ยืนยัน (${item.participant} ที่)</span>`)}
        </td>
      </tr>
    `;
    }).join('');

    if (previewSeatCount) {
      previewSeatCount.innerHTML = `ที่นั่งรวม: ${totalSeats} ที่${collisionCount > 0 ? `<span style="color: #f87171; font-weight: 600; margin-left: 8px;"><i class="fa-solid fa-triangle-exclamation"></i> พบที่นั่งชน ${collisionCount} ที่</span>` : ''}`;
    }

    const moreText = finalGuests.length > 50 ? `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 8px;">...และอีก ${finalGuests.length - 50} รายการ...</td></tr>` : '';

    tbody.innerHTML = rowsHtml + moreText;
  }

  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      if (!currentParsedGuests || currentParsedGuests.length === 0) {
        showToast('กรุณาระบุข้อมูลที่ต้องการนำเข้า', 'error');
        return;
      }

      if (!state.activeScreeningId) {
        showToast('ไม่พบรอบฉายปัจจุบัน กรุณาเลือกรอบฉายก่อน', 'error');
        return;
      }

      const replaceExisting = document.querySelector('input[name="importMode"]:checked')?.value === 'replace';

      btnConfirm.disabled = true;
      btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังนำเข้าข้อมูล...';

      try {
        const res = await API.importGuests({
          screeningId: state.activeScreeningId,
          guests: currentParsedGuests,
          replaceExisting
        });

        if (res.success) {
          showToast(`นำเข้าสำเร็จ ${currentParsedGuests.length} รายการ 🎬`);
          closeModal();
          if (textarea) textarea.value = '';
          currentParsedGuests = [];
          renderImportPreview();
          await refreshData();
        } else {
          showToast(res.message || 'นำเข้าข้อมูลไม่สำเร็จ', 'error');
        }
      } catch (err) {
        showToast('เกิดข้อผิดพลาดในการนำเข้า: ' + err.message, 'error');
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = '<i class="fa-solid fa-check"></i> ยืนยันการนำเข้าข้อมูล';
      }
    });
  }
}

// Refresh all data from backend (filtered by active screening)
// Targeted DOM helper: updates .is-checked-in on specific seat elements without full map re-render
function updateSeatsCheckInDom(seatIds, isCheckedIn) {
  if (!seatIds) return;
  const list = Array.isArray(seatIds) ? seatIds : [seatIds];
  const container = document.getElementById('seatsGrid');
  if (!container) return;

  list.forEach(id => {
    const cleanId = String(id).trim().toUpperCase();
    const btn = container.querySelector(`.cinema-seat[data-seat-id="${cleanId}"]`);
    if (btn) {
      if (isCheckedIn) {
        btn.classList.add('is-checked-in');
        btn.classList.add('seat-checked-in');
      } else {
        btn.classList.remove('is-checked-in');
        btn.classList.remove('seat-checked-in');
      }
    }
  });
}

async function refreshData(options = {}) {
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
      window._cachedSeatsMap = null;
      window._cachedSeatsMapTime = null;
    }

    renderOverview();

    // High performance optimization: skip full 1,164-seat DOM destruction if only updating status
    if (!options.skipSeatsGrid) {
      renderSeatsGrid();
    }

    populatePicFilter();
    renderGuestTable();
  } catch (err) {
    console.error('Failed to load data:', err);
    showToast('ไม่สามารถเชื่อมต่อข้อมูลได้: ' + err.message, 'error');
  }
}

function populatePicFilter() {
  const select = document.getElementById('filterPic');
  if (!select) return;

  const currentVal = state.filters.pic || 'all';
  const picCounts = {};
  if (Array.isArray(state.guests)) {
    state.guests.forEach(g => {
      if (g.pic && String(g.pic).trim() !== '') {
        const p = String(g.pic).trim();
        picCounts[p] = (picCounts[p] || 0) + 1;
      }
    });
  }

  const sortedPics = Object.keys(picCounts).sort((a, b) => a.localeCompare(b, 'th'));
  let optionsHtml = '<option value="all">PIC ทั้งหมด</option>';
  sortedPics.forEach(pic => {
    const isSelected = currentVal === pic ? ' selected' : '';
    optionsHtml += `<option value="${escapeHtml(pic)}"${isSelected}>${escapeHtml(pic)} (${picCounts[pic]})</option>`;
  });

  select.innerHTML = optionsHtml;
}

function setupFollowerSort() {
  const thFollower = document.getElementById('thColFollower');
  const icon = document.getElementById('iconSortFollower');
  if (!thFollower) return;

  thFollower.addEventListener('click', () => {
    if (state.sortFollower === null) {
      state.sortFollower = 'desc'; // มากไปน้อย
    } else if (state.sortFollower === 'desc') {
      state.sortFollower = 'asc'; // น้อยไปมาก
    } else {
      state.sortFollower = null; // คืนค่าปกติ
    }

    if (icon) {
      if (state.sortFollower === 'desc') {
        icon.className = 'fa-solid fa-sort-down';
        icon.style.color = 'var(--color-gold)';
        icon.style.opacity = '1';
        thFollower.title = 'เรียงลำดับ: มากไปน้อย (คลิกเพื่อเรียงน้อยไปมาก)';
      } else if (state.sortFollower === 'asc') {
        icon.className = 'fa-solid fa-sort-up';
        icon.style.color = 'var(--color-gold)';
        icon.style.opacity = '1';
        thFollower.title = 'เรียงลำดับ: น้อยไปมาก (คลิกเพื่อคืนค่าเดิม)';
      } else {
        icon.className = 'fa-solid fa-sort';
        icon.style.color = '';
        icon.style.opacity = '0.6';
        thFollower.title = 'คลิกเพื่อเรียงลำดับตาม Follower';
      }
    }

    state.guestPage = 1;
    renderGuestTable();
  });
}

// ================= 1. OVERVIEW VIEW =================
function renderOverview() {
  if (!state.overview) return;

  const {
    totalGuests = 0,
    totalParticipants = 0,
    checkedIn = 0,
    pendingSign = 0,
    bookedSeats = 0,
    totalSeats = 1164,
    checkInRate = 0,
    seatOccupancyRate = 0
  } = state.overview;

  // KPI cards
  const elTotal = document.getElementById('statTotalGuests');
  const elQuota = document.getElementById('statTotalParticipants');
  const elSeats = document.getElementById('statBookedSeats');
  const elChecked = document.getElementById('statCheckedIn');
  const elPending = document.getElementById('statPendingSign');

  if (elTotal) elTotal.textContent = totalGuests;
  if (elQuota) elQuota.textContent = totalParticipants;
  if (elSeats) elSeats.textContent = `${bookedSeats}/${totalSeats}`;
  if (elChecked) elChecked.textContent = checkedIn;
  if (elPending) elPending.textContent = pendingSign;

  // Progress Bars
  const barCheckIn = document.getElementById('barCheckIn');
  const valCheckIn = document.getElementById('valCheckIn');
  const barSeats = document.getElementById('barSeats');
  const valSeats = document.getElementById('valSeats');

  const cRate = checkInRate !== undefined ? checkInRate : (totalGuests > 0 ? Math.round((checkedIn / totalGuests) * 100) : 0);
  const sRate = seatOccupancyRate !== undefined ? seatOccupancyRate : (totalSeats > 0 ? Math.round((bookedSeats / totalSeats) * 100) : 0);

  if (barCheckIn) barCheckIn.style.width = `${cRate}%`;
  if (valCheckIn) valCheckIn.textContent = `${checkedIn}/${totalGuests} คน (${cRate}%)`;

  if (barSeats) barSeats.style.width = `${sRate}%`;
  if (valSeats) valSeats.textContent = `${bookedSeats}/${totalSeats} ที่ (${sRate}%)`;
}

// Helper: build map of seat ID -> guest (with per-seat checkedIn status)
function getSeatsMap() {
  const map = {};
  state.guests.forEach(guest => {
    if (Array.isArray(guest.seats) && guest.seats.length > 0) {
      guest.seats.forEach(sObj => {
        const code = (typeof sObj === 'object' ? sObj.code : sObj).trim().toUpperCase();
        if (code) {
          const isChecked = typeof sObj === 'object' ? !!sObj.checkedIn : !!guest.attended;
          map[code] = {
            ...guest,
            isSeatCheckedIn: isChecked,
            seatCheckedIn: isChecked,
            currentSeatCode: code
          };
        }
      });
    } else if (guest.seat) {
      const seatList = guest.seat.split(',').map(s => s.trim().toUpperCase());
      const attSet = new Set((Array.isArray(guest.attendedSeats) ? guest.attendedSeats : []).map(s => s.trim().toUpperCase()));
      seatList.forEach(s => {
        if (s) {
          const isChecked = attSet.size > 0 ? attSet.has(s) : !!guest.attended;
          map[s] = {
            ...guest,
            isSeatCheckedIn: isChecked,
            seatCheckedIn: isChecked,
            currentSeatCode: s
          };
        }
      });
    }
  });
  return map;
}

function isValidSeatId(seatId) {
  if (!seatId) return false;
  const target = seatId.trim().toUpperCase();
  if (state.pavalaiLayout && state.pavalaiLayout.rows) {
    for (const r of state.pavalaiLayout.rows) {
      for (const s of r.seats) {
        if (s.id.toUpperCase() === target) return true;
      }
    }
  }
  return false;
}

function getAllAvailableSeats() {
  const seatsMap = getSeatsMap();
  const available = [];
  if (state.pavalaiLayout && state.pavalaiLayout.rows) {
    state.pavalaiLayout.rows.forEach(r => {
      r.seats.forEach(s => {
        if (!seatsMap[s.id]) {
          const rowName = r.rowName || (s.id.match(/^([A-Za-z]+)/) ? s.id.match(/^([A-Za-z]+)/)[1] : '');
          available.push({
            id: s.id,
            row: rowName,
            tier: r.tier || 'stalls',
            zone: s.zone || ''
          });
        }
      });
    });
  }
  return available;
}

// Helper: get active rows based on screening capacity
function getActiveRows() {
  const current = state.screenings.find(s => s.id === state.activeScreeningId);
  const capacity = current?.capacity || 60;
  let numRows = 6;
  if (capacity > 60) {
    numRows = Math.min(Math.ceil(capacity / 10), ALL_SEAT_ROWS.length);
  }
  return ALL_SEAT_ROWS.slice(0, numRows);
}

// ================= SEAT CATEGORY COLOR CODING ENGINE & CACHE =================
function computeSeatColorsCache(seatsMap) {
  state.seatColors = {};
  if (typeof SeatCategoryColors === 'undefined') return;

  for (const [seatId, guest] of Object.entries(seatsMap)) {
    if (guest && guest.pic) {
      state.seatColors[seatId] = SeatCategoryColors.getSeatCategoryInfo(guest.pic);
    } else if (guest) {
      state.seatColors[seatId] = SeatCategoryColors.getSeatCategoryInfo(null);
    }
  }
}

function updateCategoryLegendCounts(seatsMap) {
  const counts = {
    all: 0,
    aninetwork: 0,
    idol: 0,
    luckydraw: 0,
    phoenixnext: 0,
    blessingstudio: 0,
    vip: 0,
    other: 0
  };

  for (const [seatId, guest] of Object.entries(seatsMap)) {
    if (!guest) continue;
    counts.all++;
    const info = (state.seatColors && state.seatColors[seatId]) ||
      (typeof SeatCategoryColors !== 'undefined' ? SeatCategoryColors.getSeatCategoryInfo(guest.pic) : null);
    const key = info ? info.key : 'other';
    if (counts[key] !== undefined) {
      counts[key]++;
    } else {
      counts.other++;
    }
  }

  const setBadge = (id, num) => {
    const el = document.getElementById(id);
    if (el) el.textContent = num > 0 ? `(${num})` : '';
  };

  setBadge('catCountAll', counts.all);
  setBadge('catCountAni', counts.aninetwork);
  setBadge('catCountIdol', counts.idol);
  setBadge('catCountLucky', counts.luckydraw);
  setBadge('catCountPhoenix', counts.phoenixnext);
  setBadge('catCountBlessing', counts.blessingstudio);
  setBadge('catCountVip', counts.vip);
  setBadge('catCountOther', counts.other);
}

function applyCategoryFilter(catKey) {
  state.activeCategoryFilter = catKey || 'all';

  // Update active state on legend buttons
  const buttons = document.querySelectorAll('.cat-legend-btn');
  buttons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === state.activeCategoryFilter);
  });

  // Apply dimming directly on DOM for 60fps instant response without rebuilding 1,164 seats
  const container = document.getElementById('seatsGrid');
  if (!container) return;

  const seats = container.querySelectorAll('.cinema-seat');
  seats.forEach(btn => {
    if (state.activeCategoryFilter === 'all') {
      btn.classList.remove('seat-cat-dimmed');
    } else {
      const match = btn.dataset.categoryKey === state.activeCategoryFilter;
      btn.classList.toggle('seat-cat-dimmed', !match);
    }
  });
}

function setupCategoryLegend() {
  const container = document.getElementById('catLegendButtons');
  if (!container) return;

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-legend-btn');
    if (!btn) return;
    const cat = btn.dataset.category;
    if (state.activeCategoryFilter === cat && cat !== 'all') {
      applyCategoryFilter('all');
    } else {
      applyCategoryFilter(cat);
    }
  });
}

// ================= 2. SEAT MAP VIEW (REALISTIC CINEMA AUDITORIUM - PAVALAI 1,164 SEATS) =================
function renderSeatsGrid() {
  const container = document.getElementById('seatsGrid');
  if (!container) return;

  const seatsMap = getSeatsMap();
  computeSeatColorsCache(seatsMap);
  updateCategoryLegendCounts(seatsMap);
  container.innerHTML = '';

  if (state.pavalaiLayout && state.pavalaiLayout.rows && state.pavalaiLayout.rows.length > 0) {
    let hasDrawnBalconyDivider = false;

    state.pavalaiLayout.rows.forEach(rowData => {
      // Filter by tier if selected
      if (state.activeTier === 'stalls' && rowData.tier !== 'stalls') return;
      if (state.activeTier === 'balcony' && rowData.tier !== 'balcony') return;

      // When viewing 'all' and entering balcony tier (Row FH), insert Balcony Divider
      if (state.activeTier === 'all' && rowData.tier === 'balcony' && !hasDrawnBalconyDivider) {
        hasDrawnBalconyDivider = true;
        const divider = document.createElement('div');
        divider.className = 'pavalai-balcony-divider';
        divider.innerHTML = `
          <span class="balcony-rail-line"></span>
          <span class="balcony-divider-title"><i class="fa-solid fa-crown"></i> ชั้นลอย ROYAL BALCONY (ชั้น 2 · 245 ที่นั่ง)</span>
          <span class="balcony-rail-line"></span>
        `;
        container.appendChild(divider);
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'pavalai-row';
      rowEl.dataset.tier = rowData.tier;
      rowEl.dataset.row = rowData.label;

      // Tier styling and descriptive metadata for row badges
      const isBalcony = rowData.tier === 'balcony';
      const labelStr = rowData.label;
      const isVipRow = ['A', 'B'].includes(labelStr);

      let tierClass = 'label-tier-standard';
      let tierDesc = 'Grand Stalls';
      if (isBalcony) {
        tierClass = 'label-tier-balcony';
        tierDesc = 'ชั้น 2 Royal Balcony';
      } else if (isVipRow) {
        tierClass = 'label-tier-vip';
        tierDesc = 'VIP Stalls';
      }

      const displayLabel = labelStr === 'VP / AA' ? 'AA' : labelStr;
      const rowTitle = `แถว ${labelStr} (${tierDesc}) · ${rowData.seats.length} ที่นั่ง (คลิกดูสรุปแถว)`;

      // Left Row Label Badge (ป้ายระบุแถวฝั่งซ้ายสุด)
      const labelLeft = document.createElement('div');
      labelLeft.className = `row-label label-left ${tierClass}`;
      labelLeft.textContent = displayLabel;
      labelLeft.dataset.row = labelStr;
      labelLeft.title = rowTitle;
      rowEl.appendChild(labelLeft);

      // Special Projection Room in Row B
      if (rowData.label === 'B') {
        const projRoom = document.createElement('div');
        projRoom.className = 'pavalai-projection-room';
        projRoom.innerHTML = '<i class="fa-solid fa-video"></i> PROJECTION ROOM ห้องฉาย';
        rowEl.appendChild(projRoom);
      }

      // Render Seats in this Row
      rowData.seats.forEach(s => {
        const seatBtn = createSeatButtonPavalai(s, rowData, seatsMap);
        seatBtn.style.gridColumn = (s.col - 4);
        rowEl.appendChild(seatBtn);
      });

      // Right Row Label Badge (ป้ายระบุแถวฝั่งขวาสุด)
      const labelRight = document.createElement('div');
      labelRight.className = `row-label label-right ${tierClass}`;
      labelRight.textContent = displayLabel;
      labelRight.dataset.row = labelStr;
      labelRight.title = rowTitle;
      rowEl.appendChild(labelRight);

      container.appendChild(rowEl);
    });
  } else {
    // Fallback legacy grid
    const activeRows = getActiveRows();
    activeRows.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';
      rowEl.dataset.row = row;

      const labelLeft = document.createElement('div');
      labelLeft.className = 'row-label label-left label-tier-standard';
      labelLeft.textContent = row;
      labelLeft.dataset.row = row;
      labelLeft.title = `แถว ${row} (คลิกดูสรุปแถว)`;
      rowEl.appendChild(labelLeft);

      const leftBlock = document.createElement('div');
      leftBlock.className = 'seat-block';
      for (let c = 1; c <= 5; c++) leftBlock.appendChild(createSeatButton(row, c, seatsMap));
      rowEl.appendChild(leftBlock);

      const gapEl = document.createElement('div');
      gapEl.className = 'seat-aisle-gap';
      rowEl.appendChild(gapEl);

      const rightBlock = document.createElement('div');
      rightBlock.className = 'seat-block';
      for (let c = 6; c <= 10; c++) rightBlock.appendChild(createSeatButton(row, c, seatsMap));
      rowEl.appendChild(rightBlock);

      const labelRight = document.createElement('div');
      labelRight.className = 'row-label label-right label-tier-standard';
      labelRight.textContent = row;
      labelRight.dataset.row = row;
      labelRight.title = `แถว ${row} (คลิกดูสรุปแถว)`;
      rowEl.appendChild(labelRight);
      container.appendChild(rowEl);
    });
  }

  // Re-render seat side panel if a seat is currently selected
  if (state.selectedSeat) {
    showSeatDetails(state.selectedSeat);
  }
}

function createSeatButtonPavalai(seatData, rowData, seatsMap) {
  const seatId = seatData.id;
  const btn = document.createElement('button');
  btn.className = `cinema-seat seat-cat-${seatData.category}`;
  btn.dataset.seatId = seatId;

  const guest = seatsMap[seatId];
  const zone = getSeatZone(seatData.row, seatData.category);
  const isCheckedIn = !!(guest && (guest.isSeatCheckedIn !== undefined ? guest.isSeatCheckedIn : guest.attended));
  const isVip = seatData.category === 'vip' || (guest && guest.guestType === 'vip');

  btn.dataset.zone = rowData.zone || '';
  btn.dataset.tier = rowData.tier || '';
  btn.dataset.rowLabel = rowData.label || '';

  if (isVip) {
    btn.classList.add('vip-recliner');
  }

  if (guest) {
    btn.classList.add('booked');
    if (isVip) {
      btn.classList.add('seat-vip-booked');
    } else if (guest.guestType === 'press' || seatData.category === 'privilege') {
      btn.classList.add('seat-press-booked');
    } else {
      btn.classList.add('seat-creator-booked');
    }

    // Apply Seat Category Color (Single source of truth via seatCategoryColors.js)
    const catInfo = (state.seatColors && state.seatColors[seatId]) ||
      (typeof SeatCategoryColors !== 'undefined' ? SeatCategoryColors.getSeatCategoryInfo(guest.pic) : null);
    if (catInfo && !catInfo.isDefault) {
      btn.style.setProperty('--seat-category-color', catInfo.color);
      btn.style.setProperty('--seat-category-text', catInfo.textColor || '#ffffff');
      btn.classList.add('has-category-color');
      btn.dataset.categoryKey = catInfo.key;
    } else {
      btn.dataset.categoryKey = 'other';
    }
  } else {
    btn.dataset.categoryKey = 'empty';
    if (seatData.category === 'vip') btn.classList.add('seat-vip-empty');
    else if (seatData.category === 'privilege') btn.classList.add('seat-press-empty');
    else if (seatData.category === 'balcony') btn.classList.add('seat-balcony-empty');
    else btn.classList.add('seat-creator-empty');
  }

  // Active seat filter dimming
  if (state.activeSeatFilter !== 'all') {
    let match = true;
    if (state.activeSeatFilter === 'vip') match = isVip;
    else if (state.activeSeatFilter === 'press') match = (seatData.category === 'privilege' || (guest && guest.guestType === 'press'));
    else if (state.activeSeatFilter === 'creator') match = (seatData.category === 'standard' || (guest && guest.guestType === 'creator'));
    else if (state.activeSeatFilter === 'checked-in') match = isCheckedIn;
    else if (state.activeSeatFilter === 'empty') match = !guest;

    if (!match) {
      btn.classList.add('seat-dimmed');
    }
  }

  // Active category filter dimming
  if (state.activeCategoryFilter && state.activeCategoryFilter !== 'all') {
    if (btn.dataset.categoryKey !== state.activeCategoryFilter) {
      btn.classList.add('seat-cat-dimmed');
    }
  }

  if (state.selectedSeat === seatId) {
    btn.classList.add('selected');
  }

  if (isCheckedIn) {
    btn.classList.add('is-checked-in');
    btn.classList.add('seat-checked-in');
  }

  btn.innerHTML = `<span class="seat-num">${seatData.num}</span>`;

  return btn;
}

function createSeatButton(row, col, seatsMap) {
  const seatId = `${row}${col}`;
  const btn = document.createElement('button');
  btn.className = 'cinema-seat';
  btn.dataset.seatId = seatId;

  const guest = seatsMap[seatId];
  const zone = getSeatZone(row);
  const isCheckedIn = !!(guest && (guest.isSeatCheckedIn !== undefined ? guest.isSeatCheckedIn : guest.attended));
  const isVip = zone === 'vip' || (guest && guest.guestType === 'vip');

  btn.dataset.zone = zone || '';
  btn.dataset.rowLabel = row;

  if (isVip) btn.classList.add('vip-recliner');

  if (guest) {
    if (isVip) btn.classList.add('seat-vip-booked');
    else if (guest.guestType === 'press' || zone === 'press') btn.classList.add('seat-press-booked');
    else btn.classList.add('seat-creator-booked');

    const catInfo = (state.seatColors && state.seatColors[seatId]) ||
      (typeof SeatCategoryColors !== 'undefined' ? SeatCategoryColors.getSeatCategoryInfo(guest.pic) : null);
    if (catInfo && !catInfo.isDefault) {
      btn.style.setProperty('--seat-category-color', catInfo.color);
      btn.style.setProperty('--seat-category-text', catInfo.textColor || '#ffffff');
      btn.classList.add('has-category-color');
      btn.dataset.categoryKey = catInfo.key;
    } else {
      btn.dataset.categoryKey = 'other';
    }
  } else {
    btn.dataset.categoryKey = 'empty';
    if (zone === 'vip') btn.classList.add('seat-vip-empty');
    else if (zone === 'press') btn.classList.add('seat-press-empty');
    else btn.classList.add('seat-creator-empty');
  }

  if (state.activeSeatFilter !== 'all') {
    let match = true;
    if (state.activeSeatFilter === 'vip') match = isVip;
    else if (state.activeSeatFilter === 'press') match = (zone === 'press' || (guest && guest.guestType === 'press'));
    else if (state.activeSeatFilter === 'creator') match = (zone === 'creator' || (guest && guest.guestType === 'creator'));
    else if (state.activeSeatFilter === 'checked-in') match = isCheckedIn;
    else if (state.activeSeatFilter === 'empty') match = !guest;

    if (!match) btn.classList.add('seat-dimmed');
  }

  if (state.activeCategoryFilter && state.activeCategoryFilter !== 'all') {
    if (btn.dataset.categoryKey !== state.activeCategoryFilter) {
      btn.classList.add('seat-cat-dimmed');
    }
  }

  if (isCheckedIn) {
    btn.classList.add('is-checked-in');
    btn.classList.add('seat-checked-in');
  }

  btn.innerHTML = `<span class="seat-num">${col}</span>`;

  return btn;
}

// Floating Tooltip Helpers
let hideTooltipTimer = null;

function computeTooltipPlacementAndCoords(seatRect, cardSize, viewportSize, offset = 8, padding = 10) {
  const cardW = (cardSize && cardSize.width) || 280;
  const cardH = (cardSize && cardSize.height) || 130;
  const vpWidth = (viewportSize && viewportSize.width) || (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const vpHeight = (viewportSize && viewportSize.height) || (typeof window !== 'undefined' ? window.innerHeight : 800);

  const seatCenterX = seatRect.left + (seatRect.width / 2);

  // Default placement: below the seat (+8px offset) as specified by user
  let placement = 'bottom';
  let top = seatRect.bottom + offset;

  // Collision detection: if overflowing bottom of viewport, flip above the seat
  if (top + cardH > vpHeight - padding) {
    top = seatRect.top - cardH - offset;
    placement = 'top';
  }

  // If top overflows top edge of viewport (e.g. small screen or high row)
  if (top < padding) {
    const spaceAbove = seatRect.top;
    const spaceBelow = vpHeight - seatRect.bottom;
    if (spaceBelow >= spaceAbove) {
      top = Math.max(padding, Math.min(seatRect.bottom + offset, vpHeight - cardH - padding));
      placement = 'bottom';
    } else {
      top = Math.max(padding, seatRect.top - cardH - offset);
      placement = 'top';
    }
  }

  // Horizontal placement: centered on seat
  let left = seatCenterX - (cardW / 2);

  // Clamp horizontal boundaries within viewport
  if (left < padding) {
    left = padding;
  } else if (left + cardW > vpWidth - padding) {
    left = vpWidth - cardW - padding;
  }

  // Pointer arrow aligns with seat center
  const arrowX = Math.max(14, Math.min(cardW - 14, seatCenterX - left));

  return {
    placement,
    top: Math.round(top),
    left: Math.round(left),
    arrowX: Math.round(arrowX)
  };
}

function showSeatHoverTooltip(e, seatId, guest, zone, seatData) {
  const card = document.getElementById('seatHoverCard');
  if (!card) return;

  // Portal Pattern: Ensure seatHoverCard is a direct child of document.body
  // to avoid containing block mismatch from any CSS transforms on ancestors
  if (card.parentElement !== document.body) {
    document.body.appendChild(card);
  }

  if (hideTooltipTimer) {
    clearTimeout(hideTooltipTimer);
    hideTooltipTimer = null;
  }

  const seatBtn = (e && e.nodeType === 1)
    ? (e.closest('.cinema-seat') || e)
    : (e && e.target && e.target.closest)
      ? e.target.closest('.cinema-seat')
      : null;

  const zoneLabel = seatData ? seatData.zone : getSeatZoneLabel(zone);
  const tierLabel = seatData ? (seatData.tier === 'balcony' ? 'ชั้นลอย Balcony' : 'ชั้นล่าง Stalls') : '';
  let html = '';

  if (guest) {
    const isCheckedIn = !!(guest && (guest.isSeatCheckedIn !== undefined ? guest.isSeatCheckedIn : guest.attended));
    const zoneBadgeColor = zone === 'vip' ? 'var(--color-gold)' : zone === 'press' ? 'var(--color-teal)' : 'var(--color-pink)';
    const zoneBadgeBg = zone === 'vip' ? 'var(--color-gold-bg)' : zone === 'press' ? 'var(--color-teal-bg)' : 'var(--color-pink-bg)';
    const catInfo = (state.seatColors && state.seatColors[seatId]) ||
      (typeof SeatCategoryColors !== 'undefined' ? SeatCategoryColors.getSeatCategoryInfo(guest.pic) : null);
    const catName = (catInfo && !catInfo.isDefault) ? catInfo.name : (guest.pic || 'อื่นๆ / ไม่ระบุ');
    const catColor = (catInfo && !catInfo.isDefault) ? catInfo.color : '#64748b';

    html = `
      <div class="hover-card-header">
        <span class="hover-seat-badge" style="background: ${zoneBadgeBg}; color: ${zoneBadgeColor};">
          ที่นั่ง ${seatId} ${tierLabel ? `· ${tierLabel}` : ''} · ${zoneLabel}
        </span>
        <span class="hover-checkin-badge ${isCheckedIn ? 'yes' : 'no'}">
          <i class="fa-solid ${isCheckedIn ? 'fa-circle-check' : 'fa-clock'}"></i>
          ${isCheckedIn ? 'เซ็นแล้ว ✓' : 'รอเซ็น'}
        </span>
      </div>
      <div class="hover-seat-cat-row" style="margin: 5px 0 6px 0; font-size: 11px; display: flex; align-items: center; gap: 6px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${catColor}; box-shadow: 0 0 4px ${catColor}; flex-shrink: 0;"></span>
        <span style="color: var(--text-muted);">หมวดหมู่ (PIC):</span>
        <strong style="color: #ffffff; background: rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-weight: 600;">${escapeHtml(catName)}</strong>
      </div>
      <div class="hover-guest-name">${escapeHtml(guest.name)}</div>
      <div class="hover-guest-org"><i class="fa-solid fa-building" style="font-size: 11px; margin-right: 4px; color: var(--color-gold);"></i>${escapeHtml(guest.organization || 'ไม่ระบุสื่อ')}</div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; display: flex; gap: 12px; flex-wrap: wrap;">
        <span><i class="fa-solid fa-users" style="color: var(--color-gold);"></i> ${guest.participant || 1} ท่าน</span>
        ${guest.seat ? `<span><i class="fa-solid fa-couch" style="color: var(--color-teal);"></i> ${escapeHtml(guest.seat)}</span>` : ''}
        ${guest.phone ? `<span><i class="fa-solid fa-phone" style="color: #60a5fa;"></i> ${escapeHtml(guest.phone)}</span>` : ''}
      </div>
    `;
  } else {
    html = `
      <div class="hover-card-header">
        <span class="hover-seat-badge" style="background: rgba(255,255,255,0.08); color: #fff;">
          ที่นั่ง ${seatId} ${tierLabel ? `· ${tierLabel}` : ''} · ${zoneLabel}
        </span>
        <span class="hover-checkin-badge no">ที่นั่งว่าง</span>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">คลิกเพื่อมอบหมายแขกให้ที่นั่งนี้</div>
    `;
  }

  card.innerHTML = html;
  card.classList.remove('hidden');
  card._currentSeatId = seatId;
  card._currentSeatBtn = seatBtn;

  if (!card._eventsAttached) {
    card._eventsAttached = true;
    card.addEventListener('mouseenter', () => {
      if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
      }
    });
    card.addEventListener('mouseleave', () => {
      hideSeatHoverTooltip(true);
    });
  }

  updateSeatHoverTooltipPosition(seatBtn || e);
}

function updateSeatHoverTooltipPosition(e) {
  const card = document.getElementById('seatHoverCard');
  if (!card || card.classList.contains('hidden')) return;

  // Portal Pattern check
  if (card.parentElement !== document.body) {
    document.body.appendChild(card);
  }

  const seatBtn = (e && e.nodeType === 1)
    ? (e.closest('.cinema-seat') || e)
    : (e && e.target && e.target.closest)
      ? e.target.closest('.cinema-seat')
      : card._currentSeatBtn;

  if (!seatBtn || typeof seatBtn.getBoundingClientRect !== 'function') return;

  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const OFFSET = 8;
  const PADDING = 10;

  const seatRect = seatBtn.getBoundingClientRect();

  // If seat has scrolled off screen, hide tooltip
  if (seatRect.bottom < 0 || seatRect.top > vpHeight || seatRect.right < 0 || seatRect.left > vpWidth) {
    hideSeatHoverTooltip(true);
    return;
  }

  const cardW = card.offsetWidth || 280;
  const cardH = card.offsetHeight || 130;

  const pos = computeTooltipPlacementAndCoords(
    seatRect,
    { width: cardW, height: cardH },
    { width: vpWidth, height: vpHeight },
    OFFSET,
    PADDING
  );

  if (pos.placement === 'top') {
    card.classList.remove('placement-bottom', 'arrow-top');
    card.classList.add('placement-top', 'arrow-bottom');
  } else {
    card.classList.remove('placement-top', 'arrow-bottom');
    card.classList.add('placement-bottom', 'arrow-top');
  }

  card.style.position = 'fixed';
  card.style.setProperty('--arrow-x', `${pos.arrowX}px`);
  card.style.left = `${pos.left}px`;
  card.style.top = `${pos.top}px`;
}

function hideSeatHoverTooltip(immediate = false) {
  const card = document.getElementById('seatHoverCard');
  if (!card) return;

  if (immediate) {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
    card.classList.add('hidden');
    card._currentSeatId = null;
    card._currentSeatBtn = null;
    return;
  }

  if (hideTooltipTimer) clearTimeout(hideTooltipTimer);
  hideTooltipTimer = setTimeout(() => {
    card.classList.add('hidden');
    card._currentSeatId = null;
    card._currentSeatBtn = null;
    hideTooltipTimer = null;
  }, 120);
}

// Seat Details Panel Display (Right Sidebar)
function showSeatDetails(seatId) {
  const placeholder = document.getElementById('seatPanelPlaceholder');
  const content = document.getElementById('seatPanelContent');
  if (!placeholder || !content) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const seatsMap = getSeatsMap();
  const guest = seatsMap[seatId];

  // Find seat metadata in pavalaiLayout
  let seatMeta = null;
  if (state.pavalaiLayout && state.pavalaiLayout.rows) {
    for (const r of state.pavalaiLayout.rows) {
      const found = r.seats.find(s => s.id === seatId);
      if (found) {
        seatMeta = { ...found, rowLabel: r.label, tier: r.tier, zone: r.zone };
        break;
      }
    }
  }

  const rowLabel = seatMeta ? seatMeta.row : seatId.charAt(0);
  const seatNum = seatMeta ? seatMeta.num : seatId.slice(1);
  const tierName = seatMeta ? (seatMeta.tier === 'balcony' ? 'ชั้นลอย Royal Balcony' : 'ชั้นล่าง Grand Stalls') : 'โรง 4 Pavalai';
  const zoneName = seatMeta ? seatMeta.zone : getSeatZoneLabel(getSeatZone(rowLabel));

  if (guest) {
    const isSeatChecked = !!(guest.isSeatCheckedIn !== undefined ? guest.isSeatCheckedIn : guest.attended);
    const hasMultipleSeats = (guest.participant > 1) || (Array.isArray(guest.seats) && guest.seats.length > 1);
    const totalCount = (Array.isArray(guest.seats) && guest.seats.length > 0) ? guest.seats.length : (guest.participant || 1);
    const attendedCount = (Array.isArray(guest.seats) && guest.seats.length > 0)
      ? guest.seats.filter(s => typeof s === 'object' ? s.checkedIn : false).length
      : (guest.attendedCount || (guest.attended ? totalCount : 0));

    const catInfo = (state.seatColors && state.seatColors[seatId]) ||
      (typeof SeatCategoryColors !== 'undefined' ? SeatCategoryColors.getSeatCategoryInfo(guest.pic) : null);
    const catName = (catInfo && !catInfo.isDefault) ? catInfo.name : (guest.pic || 'ไม่ระบุหมวดหมู่');
    const catColor = (catInfo && !catInfo.isDefault) ? catInfo.color : '#94a3b8';

    content.innerHTML = `
      <div class="panel-header">
        <span class="panel-seat-badge vip">
          ที่นั่ง ${seatId} · ${tierName}
        </span>
        <div style="font-size: 12px; color: var(--color-gold); margin-top: 4px; font-weight: 600;">
          <i class="fa-solid fa-couch"></i> โซน ${zoneName}
        </div>
        <div class="panel-guest-name" style="margin-top: 10px;">${escapeHtml(guest.name)}</div>
        <div class="panel-guest-org"><i class="fa-solid fa-building"></i> ${escapeHtml(guest.organization || 'ไม่ระบุสื่อ')}</div>
      </div>

      <!-- Quick Live Sign Check-In Action -->
      <div class="detail-section">
        <div class="section-label">Sign (สถานะเช็คอินที่นั่ง ${seatId})</div>
        <button class="btn-checkin-toggle ${isSeatChecked ? 'checked-in' : 'not-checked'}" onclick="toggleSeatCheckIn('${guest.id}', '${seatId}')" style="width: 100%; justify-content: center; padding: 10px; font-size: 13px;">
          <i class="fa-solid ${isSeatChecked ? 'fa-circle-check' : 'fa-circle-dot'}"></i>
          <span>${isSeatChecked ? `ที่นั่ง ${seatId} เช็คอินแล้ว ✓ (คลิกเพื่อยกเลิก)` : `คลิกเพื่อเช็คอินที่นั่ง ${seatId} (Sign)`}</span>
        </button>
        ${hasMultipleSeats ? `
          <button class="btn btn-secondary" onclick="openPartialCheckInModalById('${guest.id}')" style="width: 100%; justify-content: center; margin-top: 8px; font-size: 12px; color: var(--color-teal); border-color: rgba(45, 212, 191, 0.4);">
            <i class="fa-solid fa-users-viewfinder"></i> เช็คอินแบบเลือกที่นั่ง (${attendedCount}/${totalCount} ท่าน)
          </button>
        ` : ''}
      </div>

      <!-- Core Guest Info: Media, Name, Participant, Seat, Tel -->
      <div class="detail-section">
        <div class="section-label">ข้อมูลแขกและที่นั่ง</div>
        <div class="contact-item"><i class="fa-solid fa-building" style="color: var(--color-gold);"></i> <strong>Media:</strong> ${escapeHtml(guest.organization || '-')}</div>
        <div class="contact-item"><i class="fa-solid fa-user" style="color: #60a5fa;"></i> <strong>Name:</strong> ${escapeHtml(guest.name || '-')}</div>
        <div class="contact-item">
          <i class="fa-solid fa-tag" style="color: ${catColor};"></i> <strong>หมวดหมู่ (PIC):</strong>
          <span class="pic-badge" style="background: ${catColor}22; color: ${catColor}; border: 1px solid ${catColor}66; font-weight: 600;">
            ${escapeHtml(catName)}
          </span>
        </div>
        ${guest.follower !== null && guest.follower !== undefined ? `
          <div class="contact-item"><i class="fa-solid fa-users-viewfinder" style="color: #60a5fa;"></i> <strong>Follower:</strong> ${Number(guest.follower).toLocaleString()}</div>
        ` : ''}
        <div class="contact-item"><i class="fa-solid fa-users" style="color: var(--color-gold);"></i> <strong>Participant:</strong> ${guest.participant || 1} ท่าน</div>
        <div class="contact-item"><i class="fa-solid fa-couch" style="color: var(--color-teal);"></i> <strong>Seat ที่จัดไว้:</strong> ${escapeHtml(guest.seat || seatId)}</div>
        <div class="contact-item">
          <i class="fa-solid fa-phone" style="color: #34d399;"></i> <strong>Tel:</strong> 
          ${guest.phone ? `<a href="tel:${escapeHtml(guest.phone)}" class="tel-link">${escapeHtml(guest.phone)}</a>` : '<span style="color: var(--text-dim);">-</span>'}
        </div>
      </div>

      <!-- Actions -->
      <div class="panel-actions" style="margin-top: 14px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="viewGuestInList('${guest.id}')" style="flex: 1; justify-content: center;">
          <i class="fa-solid fa-table-list"></i> ดูในตาราง
        </button>
        <button class="btn btn-secondary" onclick="openMoveSeatModal('${guest.id}', '${seatId}')" style="flex: 1; justify-content: center; color: var(--color-gold); border-color: rgba(245, 158, 11, 0.4);">
          <i class="fa-solid fa-arrows-split-up-and-left"></i> ย้ายที่นั่ง
        </button>
        <button class="btn btn-danger" onclick="unassignSeat('${guest.id}', '${seatId}')" style="flex: 1; justify-content: center;">
          <i class="fa-solid fa-xmark"></i> ปลดที่นั่ง
        </button>
      </div>
    `;
  } else {
    // Unassigned guests for this screening
    const unassignedGuests = state.guests.filter(g => !g.seat);
    const guestOptions = unassignedGuests.map(g => `
      <option value="${g.id}">${escapeHtml(g.organization || 'ไม่ระบุสื่อ')} - ${escapeHtml(g.name)} (โควตา: ${g.participant || 1})</option>
    `).join('');

    content.innerHTML = `
      <div class="panel-header">
        <span class="panel-seat-badge" style="background: rgba(255,255,255,0.08); color: #fff;">
          ที่นั่ง ${seatId} · ${tierName}
        </span>
        <div style="font-size: 12px; color: var(--color-gold); margin-top: 4px; font-weight: 600;">
          <i class="fa-solid fa-couch"></i> โซน ${zoneName}
        </div>
        <div class="panel-guest-name" style="margin-top: 10px; color: var(--text-muted); font-size: 16px;">
          <i class="fa-solid fa-couch"></i> ที่นั่งว่าง
        </div>
      </div>

      <div class="detail-section" style="margin-top: 16px;">
        <button class="btn btn-primary" onclick="openWalkInModal('${seatId}')" style="width: 100%; justify-content: center; padding: 12px; font-size: 13.5px; background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); margin-bottom: 14px;">
          <i class="fa-solid fa-person-walking-dashed-line-arrow-right"></i> เพิ่มแขก Walk-in ที่นั่ง ${seatId}
        </button>

        <div class="section-label">หรือมอบหมายให้แขกเดิมที่ยังไม่มีที่นั่ง</div>
        ${unassignedGuests.length > 0 ? `
          <select id="selectAssignGuest" class="select-dropdown" style="width: 100%; margin-bottom: 12px;">
            <option value="">-- เลือกแขก (${unassignedGuests.length} ท่าน) --</option>
            ${guestOptions}
          </select>
          <button class="btn btn-secondary" onclick="assignSeatToGuest('${seatId}')" style="width: 100%; justify-content: center;">
            <i class="fa-solid fa-check"></i> ยืนยันการมอบหมาย
          </button>
        ` : `
          <p style="font-size: 13px; color: var(--text-dim);">ไม่มีแขกที่ยังไม่ได้รับที่นั่งในรอบนี้</p>
        `}
      </div>
    `;
  }
}

// Action: Quick Live Check-In Toggle
window.toggleGuestCheckIn = async function(guestId, overrideOptions = {}) {
  try {
    const guest = state.guests.find(g => g.id === guestId);
    if (!guest) return;

    // If guest has participant > 1 and not yet signed, and not explicitly skipping modal
    if (!overrideOptions.confirmedWarning && !overrideOptions.checkInAnyway && !overrideOptions.skipPartialModal && !guest.attended && (guest.participant || 1) > 1) {
      openPartialCheckInModal(guest);
      return;
    }

    const willBeAttended = overrideOptions.attended !== undefined ? overrideOptions.attended : !guest.attended;
    const res = await API.checkInGuest(guestId, {
      attended: willBeAttended,
      attendedCount: overrideOptions.attendedCount,
      confirmedWarning: overrideOptions.confirmedWarning,
      checkInAnyway: overrideOptions.checkInAnyway,
      action: willBeAttended ? 'check_in' : 'check_out'
    });

    if (res.requiresWarningConfirmation) {
      openPreCheckInModal(res.guest, res.missingWarning, false);
      return;
    }

    if (res.success) {
      showToast(willBeAttended ? `เช็คอินคุณ ${guest.name} เรียบร้อยแล้ว 🎬` : `ยกเลิกการเช็คอินคุณ ${guest.name}`);
      
      // Targeted DOM update for the guest's seats immediately without rebuilding 1,164 seats!
      const guestSeats = Array.isArray(guest.seats)
        ? guest.seats.map(s => typeof s === 'object' ? s.code : s)
        : (guest.seat ? expandSeatRanges(guest.seat) : []);
      updateSeatsCheckInDom(guestSeats, willBeAttended);

      // Refresh overview counters and guest list table, but skip destroying the 1,164-seat grid!
      await refreshData({ skipSeatsGrid: true });

      if (state.selectedSeat) showSeatDetails(state.selectedSeat);
      if (state.selectedGuestId) showGuestDetails(state.selectedGuestId);
    }
  } catch (err) {
    if (err.message && (err.message.includes('PRE_CHECKIN_VALIDATION_FAILED') || err.message.includes('ข้อมูลสำคัญไม่ครบ'))) {
      const guest = state.guests.find(g => g.id === guestId);
      if (guest) {
        openPreCheckInModal(guest, [], true);
        return;
      }
    }
    showToast('เกิดข้อผิดพลาดในการเช็คอิน: ' + err.message, 'error');
  }
};

// Action: 1-Click Single Seat Check-In Toggle from Map
window.toggleSeatCheckIn = async function(guestId, seatCode) {
  try {
    const res = await API.checkInSeat(guestId, seatCode);
    if (res.success) {
      // 1. Instant DOM mutation on seat element without full re-render
      updateSeatsCheckInDom(seatCode, res.checkedIn);

      // 2. Update local state
      const gIdx = state.guests.findIndex(g => g.id === guestId);
      if (gIdx !== -1) {
        state.guests[gIdx] = res.data;
      }

      // 3. Update cached seats map
      if (window._cachedSeatsMap && window._cachedSeatsMap[seatCode]) {
        window._cachedSeatsMap[seatCode].isSeatCheckedIn = res.checkedIn;
        window._cachedSeatsMap[seatCode].seatCheckedIn = res.checkedIn;
      }

      // 4. Update side panel if showing this seat
      if (state.selectedSeat === seatCode) {
        showSeatDetails(seatCode);
      }

      // 5. Update guest table row
      renderGuestTable();

      // 6. Refresh overview cinema stats in background
      API.fetchJSON(`/api/stats/overview-cinema${state.activeScreeningId ? '?screeningId=' + state.activeScreeningId : ''}`).then(oRes => {
        if (oRes.success) {
          state.overview = oRes.data;
          renderOverview();
        }
      });

      showToast(res.message || (res.checkedIn ? `เช็คอินที่นั่ง ${seatCode} สำเร็จ 🎬` : `ยกเลิกเช็คอินที่นั่ง ${seatCode}`));
    }
  } catch (err) {
    showToast('ไม่สามารถเช็คอินที่นั่งได้: ' + err.message, 'error');
  }
};

// Action: Unassign a seat
window.unassignSeat = async function(guestId, seatId) {
  try {
    const res = await API.releaseSeat({
      screeningId: state.activeScreeningId,
      guestId,
      seatId
    });
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
    const res = await API.assignSeat({
      screeningId: state.activeScreeningId,
      guestId,
      seatId
    });
    if (res.success) {
      showToast(`มอบหมายที่นั่ง ${seatId} สำเร็จ`);
      await refreshData();
      showSeatDetails(seatId);
    }
  } catch (err) {
    showToast('มอบหมายล้มเหลว: ' + err.message, 'error');
  }
};

window.viewGuestInList = function(guestId) {
  state.selectedGuestId = guestId;
  switchView('guests');
  showGuestDetails(guestId);
};

// ================= 3. GUEST LIST VIEW =================
function validatePhone(phoneStr) {
  if (!phoneStr || phoneStr.trim() === '') return { valid: true };
  const val = phoneStr.trim().replace(/[-\s]/g, '');
  if (!/^0\d{9}$/.test(val) && !/^\d{10}$/.test(val)) {
    return { valid: false, message: 'เบอร์โทรต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)' };
  }
  return { valid: true, cleanPhone: val };
}
function validatePhone12(phoneStr) {
  return validatePhone(phoneStr);
}
window.validatePhone = validatePhone;
window.validatePhone12 = validatePhone;

function renderGuestTable() {
  const tbody = document.getElementById('guestTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const isGuestChecked = (g) => {
    if (g.checkInStatus === 'complete' || g.checkInStatus === 'partial') return true;
    if (g.attended) return true;
    if (Array.isArray(g.seats) && g.seats.some(s => s.checkedIn)) return true;
    return (g.attendedCount > 0);
  };

  // 1. Update Tab Badge Counts across all guests in current screening
  const countAll = state.guests.length;
  const countUnassigned = state.guests.filter(g => !g.seat || g.seat.trim() === '').length;
  const countAssigned = state.guests.filter(g => !!g.seat && g.seat.trim() !== '').length;
  const countCheckedIn = state.guests.filter(isGuestChecked).length;
  const countNotChecked = state.guests.filter(g => !isGuestChecked(g)).length;

  const elCountAll = document.getElementById('tabCountAll');
  const elCountUnassigned = document.getElementById('tabCountUnassigned');
  const elCountAssigned = document.getElementById('tabCountAssigned');
  const elCountCheckedIn = document.getElementById('tabCountCheckedIn');
  const elCountNotChecked = document.getElementById('tabCountNotChecked');

  if (elCountAll) elCountAll.textContent = countAll;
  if (elCountUnassigned) elCountUnassigned.textContent = countUnassigned;
  if (elCountAssigned) elCountAssigned.textContent = countAssigned;
  if (elCountCheckedIn) elCountCheckedIn.textContent = countCheckedIn;
  if (elCountNotChecked) elCountNotChecked.textContent = countNotChecked;

  // 2. Filter Guests
  let filtered = [...state.guests];
  const { search, checkIn, seatStatus, tab, pic } = state.filters;

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(g =>
      (g.name && g.name.toLowerCase().includes(q)) ||
      (g.detail && g.detail.toLowerCase().includes(q)) ||
      (g.organization && g.organization.toLowerCase().includes(q)) ||
      (g.pic && g.pic.toLowerCase().includes(q)) ||
      (g.seat && g.seat.toLowerCase().includes(q)) ||
      (g.phone && g.phone.includes(q)) ||
      (g.participant && String(g.participant).includes(q))
    );
  }

  // Quick Tab Filter
  if (tab && tab !== 'all') {
    if (tab === 'unassigned') {
      filtered = filtered.filter(g => !g.seat || g.seat.trim() === '');
    } else if (tab === 'assigned') {
      filtered = filtered.filter(g => !!g.seat && g.seat.trim() !== '');
    } else if (tab === 'checked-in') {
      filtered = filtered.filter(isGuestChecked);
    } else if (tab === 'not-checked') {
      filtered = filtered.filter(g => !isGuestChecked(g));
    }
  }

  // Dropdown Check-In Filter
  if (checkIn && checkIn !== 'all') {
    if (checkIn === 'checked-in') {
      filtered = filtered.filter(isGuestChecked);
    } else if (checkIn === 'not-checked') {
      filtered = filtered.filter(g => !isGuestChecked(g));
    }
  }

  // Dropdown Seat Status Filter
  if (seatStatus && seatStatus !== 'all') {
    if (seatStatus === 'assigned') {
      filtered = filtered.filter(g => !!g.seat && g.seat.trim() !== '');
    } else if (seatStatus === 'unassigned') {
      filtered = filtered.filter(g => !g.seat || g.seat.trim() === '');
    }
  }

  // Dropdown PIC Filter
  if (pic && pic !== 'all') {
    filtered = filtered.filter(g => g.pic === pic);
  }

  // Follower Sorting (desc / asc)
  if (state.sortFollower === 'desc') {
    filtered.sort((a, b) => (parseInt(b.follower, 10) || 0) - (parseInt(a.follower, 10) || 0));
  } else if (state.sortFollower === 'asc') {
    filtered.sort((a, b) => (parseInt(a.follower, 10) || 0) - (parseInt(b.follower, 10) || 0));
  }

  // 3. Pagination calculation
  const totalItems = filtered.length;
  const isShowAll = state.guestPageSize === 'all';
  const pageSize = isShowAll ? totalItems : (state.guestPageSize || 25);
  const totalPages = pageSize <= 0 ? 1 : Math.ceil(totalItems / pageSize) || 1;

  if (state.guestPage > totalPages) state.guestPage = totalPages;
  if (state.guestPage < 1) state.guestPage = 1;

  const startIndex = isShowAll ? 0 : (state.guestPage - 1) * pageSize;
  const endIndex = isShowAll ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const pageItems = isShowAll ? filtered : filtered.slice(startIndex, endIndex);

  // Update Pagination Info Bar
  const paginationInfo = document.getElementById('paginationInfo');
  if (paginationInfo) {
    if (totalItems === 0) {
      paginationInfo.textContent = 'แสดงรายการที่ 0 - 0 จาก 0 รายการ';
    } else {
      paginationInfo.textContent = `แสดงรายการที่ ${startIndex + 1} - ${endIndex} จากทั้งหมด ${totalItems} รายการ`;
    }
  }

  // Render Pagination Controls
  renderGuestPagination(totalPages, state.guestPage);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-dim);">
          <i class="fa-solid fa-inbox" style="font-size: 28px; margin-bottom: 8px; display: block; opacity: 0.5;"></i>
          ไม่พบข้อมูลแขกตามเงื่อนไขที่ค้นหาสำหรับรอบนี้
        </td>
      </tr>
    `;
    return;
  }

  pageItems.forEach(guest => {
    const tr = document.createElement('tr');
    if (state.selectedGuestId === guest.id) {
      tr.classList.add('selected');
    }

    const hasSeat = guest.seat && guest.seat.trim() !== '';

    tr.innerHTML = `
      <td class="col-guest-name">
        <div class="guest-name-cell">
          <span class="guest-name" title="${escapeHtml(guest.name || '-')}">${escapeHtml(guest.name || '-')}</span>
          ${guest.organization ? `<span class="guest-org-subtitle" title="${escapeHtml(guest.organization)}">${escapeHtml(guest.organization)}</span>` : ''}
          ${guest.source === 'walk_in' ? '<span class="badge" style="background: rgba(45, 212, 191, 0.15); color: var(--color-teal); font-size: 10px; padding: 1px 5px; border-radius: 4px; display: inline-block; margin-top: 2px;">Walk-in</span>' : ''}
        </div>
      </td>
      <td class="col-guest-follower">
        ${guest.follower != null ? guest.follower.toLocaleString() : '<span style="color: var(--text-dim);">-</span>'}
      </td>
      <td class="col-guest-pic">
        ${guest.pic ? `<span class="pic-badge" title="ผู้ดูแล: ${escapeHtml(guest.pic)}">${escapeHtml(guest.pic)}</span>` : '<span style="color: var(--text-dim);">-</span>'}
      </td>
      <td class="col-guest-detail">
        <span class="guest-detail-chip" title="${escapeHtml(guest.detail || guest.organization || '-')} (คลิกเพื่อดูรายละเอียดเต็มในแผงด้านขวา)">
          <i class="fa-solid fa-align-left"></i>
          <span class="detail-text">${escapeHtml(guest.detail ? guest.detail.replace(/\r?\n/g, ' · ') : (guest.organization || '-'))}</span>
        </span>
      </td>
      <td class="col-guest-participant" style="text-align: center;">
        <span class="badge-participant">${guest.participant || 1}</span>
      </td>
      <td class="col-guest-seat">
        ${hasSeat ? `
          <span class="seat-badge assigned" title="ที่นั่งที่จัดสรร: ${escapeHtml(guest.seat)}">
            <i class="fa-solid fa-chair" style="font-size: 11px; margin-right: 3px;"></i>${escapeHtml(guest.seat)}
          </span>
        ` : `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="seat-badge unassigned">ยังไม่จัด</span>
            <button class="btn-table-assign" onclick="event.stopPropagation(); quickAssignGuest('${guest.id}')" title="จัดที่นั่งว่างติดกันให้แขกท่านนี้ด่วน">
              <i class="fa-solid fa-wand-magic-sparkles"></i> จัดที่
            </button>
          </div>
        `}
      </td>
      <td class="col-guest-tel">
        ${guest.phone ? `
          <a href="tel:${escapeHtml(guest.phone)}" class="tel-link" onclick="event.stopPropagation()">
            <i class="fa-solid fa-phone" style="font-size: 11px; margin-right: 4px; color: var(--color-gold);"></i>${escapeHtml(guest.phone)}
          </a>
        ` : '<span style="color: var(--text-dim);">-</span>'}
      </td>
      <td class="col-guest-sign" style="text-align: center;">
        ${renderCheckInButtonHtml(guest)}
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

function renderGuestPagination(totalPages, currentPage) {
  const container = document.getElementById('paginationControls');
  if (!container) return;
  container.innerHTML = '';

  if (totalPages <= 1) return;

  // Prev Button
  const btnPrev = document.createElement('button');
  btnPrev.className = 'pagination-btn';
  btnPrev.disabled = currentPage <= 1;
  btnPrev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
  btnPrev.title = 'หน้าก่อนหน้า';
  btnPrev.addEventListener('click', () => {
    if (state.guestPage > 1) {
      state.guestPage--;
      renderGuestTable();
    }
  });
  container.appendChild(btnPrev);

  // Smart Pagination Range
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    const btnFirst = document.createElement('button');
    btnFirst.className = 'pagination-btn';
    btnFirst.textContent = '1';
    btnFirst.addEventListener('click', () => {
      state.guestPage = 1;
      renderGuestTable();
    });
    container.appendChild(btnFirst);

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      container.appendChild(dots);
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    const btn = document.createElement('button');
    btn.className = `pagination-btn ${p === currentPage ? 'active' : ''}`;
    btn.textContent = p;
    const targetPage = p;
    btn.addEventListener('click', () => {
      state.guestPage = targetPage;
      renderGuestTable();
    });
    container.appendChild(btn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'pagination-dots';
      dots.textContent = '...';
      container.appendChild(dots);
    }
    const btnLast = document.createElement('button');
    btnLast.className = 'pagination-btn';
    btnLast.textContent = totalPages;
    btnLast.addEventListener('click', () => {
      state.guestPage = totalPages;
      renderGuestTable();
    });
    container.appendChild(btnLast);
  }

  // Next Button
  const btnNext = document.createElement('button');
  btnNext.className = 'pagination-btn';
  btnNext.disabled = currentPage >= totalPages;
  btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
  btnNext.title = 'หน้าถัดไป';
  btnNext.addEventListener('click', () => {
    if (state.guestPage < totalPages) {
      state.guestPage++;
      renderGuestTable();
    }
  });
  container.appendChild(btnNext);
}

// 1-Click Quick Contiguous Auto-Assign for single guest
window.quickAssignGuest = async function(guestId) {
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  const quota = guest.participant || 1;
  if (!confirm(`จัดที่นั่งว่างติดกันอัตโนมัติให้ "${guest.name || guest.detail}" (${quota} ที่นั่ง) หรือไม่?`)) {
    return;
  }

  try {
    const res = await API.autoAssignSeats(state.activeScreeningId, [guestId]);
    if (res.success && res.assignedCount > 0) {
      showToast(`จัดที่นั่งให้ ${guest.name} เรียบร้อยแล้ว 🎬`);
      await refreshData();
      state.selectedGuestId = guestId;
      showGuestDetails(guestId);
    } else {
      showToast(res.message || 'ไม่พบที่นั่งว่างติดกันเพียงพอ กรุณาเลือกที่นั่งในแผนผัง', 'error');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
};


function showGuestDetails(guestId) {
  const placeholder = document.getElementById('guestPanelPlaceholder');
  const content = document.getElementById('guestPanelContent');
  if (!placeholder || !content) return;

  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  placeholder.classList.add('hidden');
  content.classList.remove('hidden');

  const isCheckedIn = !!guest.attended;
  const isPartial = !guest.attended && (guest.attendedCount > 0);
  const quota = guest.participant || 1;

  content.innerHTML = `
    <div class="panel-header">
      <span class="panel-seat-badge vip" style="font-size: 12px;">
        <i class="fa-solid fa-tag"></i> ${escapeHtml(guest.detail || guest.organization || 'ทั่วไป')}
      </span>
      <div class="panel-guest-name" style="margin-top: 6px;">${escapeHtml(guest.name || '-')}</div>
      <div style="color: var(--color-gold); font-size: 13px; margin-top: 4px; font-weight: 600;">
        <i class="fa-solid fa-users"></i> Participant: ${quota} ท่าน
        ${guest.source === 'walk_in' ? '<span class="badge" style="background: rgba(45, 212, 191, 0.2); color: var(--color-teal); font-size: 10px; margin-left: 6px; padding: 2px 6px; border-radius: 4px;">Walk-in</span>' : ''}
      </div>
    </div>

    <!-- Quick Live Sign / Check-In Action -->
    <div class="detail-section">
      <div class="section-label">Sign (สถานะการเช็คอินหน้างาน)</div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-checkin-toggle ${isCheckedIn ? 'checked-in' : (isPartial ? 'partial' : 'not-checked')}" onclick="toggleGuestCheckIn('${guest.id}')" style="flex: 2; justify-content: center; padding: 10px; font-size: 13px;">
          <i class="fa-solid ${isCheckedIn ? 'fa-circle-check' : (isPartial ? 'fa-users-viewfinder' : 'fa-circle-dot')}"></i>
          <span>${isCheckedIn ? 'เซ็นชื่อครบแล้ว ✓' : (isPartial ? `มาบางส่วน (${guest.attendedCount}/${quota})` : 'คลิกเพื่อเซ็นชื่อ (Sign)')}</span>
        </button>
        ${quota > 1 ? `
          <button class="btn btn-secondary" onclick="openPartialCheckInModalById('${guest.id}')" title="ระบุจำนวนคนที่มาถึง" style="flex: 1; justify-content: center; font-size: 11.5px; border-color: rgba(45, 212, 191, 0.4); color: var(--color-teal);">
            <i class="fa-solid fa-users"></i> ระบุคนมา
          </button>
        ` : ''}
      </div>
    </div>

    <!-- Form: Edit Core Fields (Name, Detail, Participant, Seat, Tel) -->
    <div class="detail-section">
      <label class="section-label" for="guestDetailName">Name (ชื่อแขก / ผู้ติดต่อ)</label>
      <input type="text" id="guestDetailName" class="screening-select" style="width: 100%; max-width: 100%;" value="${escapeHtml(guest.name || '')}" placeholder="ชื่อแขก">
    </div>

    <div class="detail-section">
      <label class="section-label" for="guestDetailFollower">Follower (จำนวนผู้ติดตาม)</label>
      <input type="number" id="guestDetailFollower" class="screening-select" style="width: 100%; max-width: 100%;" value="${guest.follower != null ? guest.follower : ''}" placeholder="เช่น 1200000" min="0">
    </div>

    <div class="detail-section">
      <label class="section-label" for="guestDetailPic">PIC (ผู้ดูแล/ผู้ประสานงาน)</label>
      <input type="text" id="guestDetailPic" class="screening-select" style="width: 100%; max-width: 100%;" value="${escapeHtml(guest.pic || '')}" placeholder="เช่น Ani Network">
    </div>

    <div class="detail-section">
      <label class="section-label" for="guestDetailMedia">Detail (รายละเอียด / สังกัด)</label>
      <textarea id="guestDetailMedia" class="screening-select" style="width: 100%; max-width: 100%; min-height: 80px; resize: vertical; font-size: 12.5px; line-height: 1.5; padding: 8px;" placeholder="เช่น โกดังหนัง, สื่อมวลชน, บุคคลภายนอก">${escapeHtml(guest.detail || guest.organization || '')}</textarea>
    </div>

    <div class="detail-section">
      <label class="section-label" for="guestDetailParticipant">Participant (จำนวนโควตา/คน)</label>
      <input type="number" id="guestDetailParticipant" class="screening-select" style="width: 100%; max-width: 100%;" value="${quota}" min="1" max="50">
    </div>

    <div class="detail-section">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <label class="section-label" for="guestDetailSeatInput" style="margin-bottom: 0;">Seat (ที่นั่งที่จัดสรร)</label>
        ${guest.seat ? `
          <button type="button" class="btn btn-secondary" onclick="openMoveSeatModal('${guest.id}', '${escapeHtml(guest.seat.split(',')[0].trim())}')" style="padding: 2px 8px; font-size: 11px; color: var(--color-gold); border-color: rgba(245, 158, 11, 0.4);">
            <i class="fa-solid fa-arrows-split-up-and-left"></i> ย้ายที่นั่ง
          </button>
        ` : ''}
      </div>
      <input type="text" id="guestDetailSeatInput" class="screening-select" style="width: 100%; max-width: 100%; margin-top: 6px;" value="${escapeHtml(guest.seat || '')}" placeholder="เช่น B16-B17, E7-E8 หรือ F10">
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
        * รองรับการใส่ช่วงที่นั่ง เช่น B16-B17 ระบบจะแตกเป็น B16, B17 ให้อัตโนมัติ
      </div>
    </div>

    <div class="detail-section">
      <label class="section-label" for="guestDetailPhoneInput">Tel (เบอร์โทรศัพท์)</label>
      <input type="tel" id="guestDetailPhoneInput" class="screening-select" style="width: 100%; max-width: 100%;" value="${escapeHtml(guest.phone || '')}" placeholder="08x-xxx-xxxx">
      ${guest.phone ? `
        <div style="margin-top: 6px;">
          <a href="tel:${escapeHtml(guest.phone)}" class="tel-link">
            <i class="fa-solid fa-phone" style="color: var(--color-gold);"></i> โทรออก: ${escapeHtml(guest.phone)}
          </a>
        </div>
      ` : ''}
    </div>

    <div class="panel-actions" style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
      <button class="btn btn-primary" onclick="saveGuestChanges('${guest.id}')" style="justify-content: center;">
        <i class="fa-solid fa-floppy-disk"></i> บันทึกการแก้ไข
      </button>
      <button class="btn btn-danger" onclick="deleteGuestConfirm('${guest.id}')" style="justify-content: center;">
        <i class="fa-solid fa-trash"></i> ลบแขกท่านนี้
      </button>
    </div>
  `;
}

window.saveGuestChanges = async function(guestId) {
  const nameInput = document.getElementById('guestDetailName');
  const mediaInput = document.getElementById('guestDetailMedia');
  const followerInput = document.getElementById('guestDetailFollower');
  const picInput = document.getElementById('guestDetailPic');
  const participantInput = document.getElementById('guestDetailParticipant');
  const seatInput = document.getElementById('guestDetailSeatInput');
  const phoneInput = document.getElementById('guestDetailPhoneInput');

  // Phone 10-digit validation
  if (phoneInput) {
    const phoneVal = phoneInput.value.trim();
    const phoneValidation = validatePhone(phoneVal);
    // Show or hide inline error (inject dynamically under the phone input)
    let detailPhoneErr = document.getElementById('guestDetailPhoneError');
    if (!detailPhoneErr) {
      detailPhoneErr = document.createElement('div');
      detailPhoneErr.id = 'guestDetailPhoneError';
      detailPhoneErr.className = 'form-input-error hidden';
      detailPhoneErr.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> เบอร์โทรต้องเป็นตัวเลข 10 หลัก (เช่น 0812345678)';
      phoneInput.parentNode.insertBefore(detailPhoneErr, phoneInput.nextSibling);
    }
    if (!phoneValidation.valid) {
      detailPhoneErr.classList.remove('hidden');
      phoneInput.focus();
      return;
    } else {
      detailPhoneErr.classList.add('hidden');
    }
  }

  let seatVal = seatInput ? seatInput.value.trim() : '';
  if (seatVal && typeof expandSeatRanges === 'function') {
    seatVal = expandSeatRanges(seatVal);
  }

  let followerVal = null;
  if (followerInput && followerInput.value.trim() !== '') {
    const parsed = parseInt(followerInput.value.replace(/,/g, ''), 10);
    followerVal = isNaN(parsed) ? null : parsed;
  }

  const currentGuest = state.guests.find(g => g.id === guestId);

  const updates = {
    name: nameInput ? nameInput.value.trim() : undefined,
    detail: mediaInput ? mediaInput.value.trim() : undefined,
    organization: (currentGuest && currentGuest.organization) || (mediaInput ? mediaInput.value.trim() : undefined),
    follower: followerVal,
    pic: picInput ? (picInput.value.trim() || null) : null,
    participant: participantInput ? parseInt(participantInput.value, 10) || 1 : 1,
    seat: seatVal || null,
    phone: phoneInput ? phoneInput.value.trim() : undefined
  };

  try {
    const res = await API.updateGuest(guestId, updates);
    if (res.success) {
      showToast('บันทึกข้อมูลแขกเรียบร้อยแล้ว');
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

  if (state.pavalaiLayout && state.pavalaiLayout.rows) {
    state.pavalaiLayout.rows.forEach(r => {
      r.seats.forEach(s => {
        if (!seatsMap[s.id]) {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = `${s.id} (${s.zone} · ${r.tier === 'balcony' ? 'Balcony' : 'Stalls'})`;
          seatSelect.appendChild(opt);
        }
      });
    });
  }
}

async function handleAddGuestSubmit(e) {
  e.preventDefault();

  const detail = document.getElementById('addGuestOrg').value.trim();
  const name = document.getElementById('addGuestName').value.trim();
  const followerEl = document.getElementById('addGuestFollower');
  const picEl = document.getElementById('addGuestPic');
  const participant = parseInt(document.getElementById('addGuestParticipant').value, 10) || 1;
  const seatInputEl = document.getElementById('addGuestSeatText') || document.getElementById('addGuestSeat');
  let seat = seatInputEl ? seatInputEl.value.trim() : '';
  const phone = document.getElementById('addGuestPhone').value.trim();
  const attended = document.getElementById('addGuestAttended').value === 'true';

  let followerVal = null;
  if (followerEl && followerEl.value.trim() !== '') {
    const num = parseInt(followerEl.value.replace(/,/g, ''), 10);
    if (!isNaN(num)) followerVal = num;
  }
  const picVal = (picEl && picEl.value.trim() !== '') ? picEl.value.trim() : null;

  // Phone 10-digit validation
  const phoneErrEl = document.getElementById('addGuestPhoneError');
  const phoneValidation = validatePhone(phone);
  if (!phoneValidation.valid) {
    if (phoneErrEl) phoneErrEl.classList.remove('hidden');
    document.getElementById('addGuestPhone').focus();
    return;
  } else {
    if (phoneErrEl) phoneErrEl.classList.add('hidden');
  }

  if (seat && typeof expandSeatRanges === 'function') {
    seat = expandSeatRanges(seat);
  }

  const newGuestData = {
    screeningId: state.activeScreeningId,
    name: name || detail || 'แขกใหม่',
    detail: detail,
    organization: detail || 'ไม่ระบุสังกัด',
    follower: followerVal,
    pic: picVal,
    participant,
    seat: seat || null,
    phone,
    attended,
    status: 'accepted',
    guestType: 'press'
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

// ---------------- ADD GUEST SEAT HELPERS (SeatPicker, Autocomplete & Quick Suggestions) ----------------
function setupAddGuestHelpers() {
  const btnOpenPicker = document.getElementById('btnOpenSeatPickerForAddGuest');
  const partInput = document.getElementById('addGuestParticipant');

  if (btnOpenPicker) {
    btnOpenPicker.addEventListener('click', () => {
      const participant = parseInt(document.getElementById('addGuestParticipant')?.value, 10) || 1;
      let initialSeats = [];
      const currentVal = document.getElementById('addGuestSeatText')?.value.trim();
      if (currentVal) {
        const expanded = (typeof expandSeatRanges === 'function') ? expandSeatRanges(currentVal) : currentVal;
        initialSeats = expanded.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      }
      if (window.SeatPicker) {
        window.SeatPicker.open({
          mode: 'walkin',
          targetCount: participant,
          screeningId: state.activeScreeningId,
          initialSeats,
          parentModalId: 'modalAddGuest',
          onConfirm: (selectedSeats) => {
            const input = document.getElementById('addGuestSeatText');
            if (input) input.value = selectedSeats.join(', ');
            updateAddGuestSeatSuggestions();
          }
        });
      }
    });
  }

  if (partInput) {
    partInput.addEventListener('input', () => updateAddGuestSeatSuggestions());
    partInput.addEventListener('change', () => updateAddGuestSeatSuggestions());
  }

  setupAddGuestSeatAutocomplete();
}

async function updateAddGuestSeatSuggestions() {
  const container = document.getElementById('addGuestQuickSeatSuggestions');
  if (!container) return;
  const participant = parseInt(document.getElementById('addGuestParticipant')?.value, 10) || 1;

  container.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-spinner fa-spin"></i> กำลังค้นหาที่นั่งว่างแนะนำ...</span>';

  try {
    const res = await API.recommendSeatGroups(state.activeScreeningId, participant);
    if (res && res.success && res.groups && res.groups.length > 0) {
      container.innerHTML = '<span style="font-size: 11px; color: var(--text-muted); margin-right: 2px; display: flex; align-items: center;">แนะนำที่นั่งติดกัน:</span>';
      res.groups.slice(0, 4).forEach(grp => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'seat-quick-chip';
        const label = grp.seats.length > 1 
          ? `${grp.seats[0]}-${grp.seats[grp.seats.length - 1]}`
          : grp.seats[0];
        chip.innerHTML = `<i class="fa-solid fa-chair"></i> ${label} <span style="font-size: 10px; opacity: 0.8;">(${grp.tierLabel})</span>`;
        chip.title = `คลิกเพื่อเลือก ${grp.seats.join(', ')}`;
        chip.onclick = () => {
          const input = document.getElementById('addGuestSeatText');
          if (input) {
            input.value = grp.seats.join(', ');
            input.focus();
          }
        };
        container.appendChild(chip);
      });
    } else {
      container.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">ไม่มีกลุ่มที่นั่งว่างติดกัน ' + participant + ' ที่</span>';
    }
  } catch (err) {
    container.innerHTML = '';
  }
}

function setupAddGuestSeatAutocomplete() {
  const seatInput = document.getElementById('addGuestSeatText');
  const dropdown = document.getElementById('addGuestSeatAutocomplete');
  if (!seatInput || !dropdown) return;

  function renderDropdown() {
    const fullText = seatInput.value;
    const tokens = fullText.split(/[,;/+]+/).map(t => t.trim()).filter(Boolean);
    const lastToken = (fullText.endsWith(',') || fullText.endsWith(' ') || tokens.length === 0) 
      ? '' 
      : tokens[tokens.length - 1].toUpperCase();

    const availableSeats = getAllAvailableSeats();
    let matches = [];

    if (!lastToken) {
      matches = availableSeats.slice(0, 20);
    } else {
      matches = availableSeats.filter(s => s.id.startsWith(lastToken) || s.id.includes(lastToken)).slice(0, 25);
    }

    if (matches.length === 0) {
      dropdown.innerHTML = '<div style="padding: 8px 12px; color: var(--text-muted); font-size: 12px;">ไม่พบที่นั่งว่างที่ตรงกับคำค้นหา</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    dropdown.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'padding: 6px 12px; font-size: 11px; font-weight: 700; color: var(--color-teal); background: rgba(0,0,0,0.5); border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between;';
    header.innerHTML = `<span><i class="fa-solid fa-couch"></i> ที่นั่งว่างที่พร้อมจัดสรร (${matches.length})</span><span style="font-size: 10px; color: var(--text-muted);">คลิกเพื่อเลือก</span>`;
    dropdown.appendChild(header);

    matches.forEach(seat => {
      const item = document.createElement('div');
      item.className = 'seat-autocomplete-item';
      item.innerHTML = `
        <div>
          <span style="font-family: monospace; font-weight: 700; color: #fff;">${seat.id}</span>
          <span style="font-size: 11px; color: var(--text-muted); margin-left: 8px;">แถว ${seat.row} (${seat.tier === 'balcony' ? 'ชั้น 2 Balcony' : 'ชั้น 1 Stalls'})</span>
        </div>
        <span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 11px;">+ เลือก</span>
      `;

      item.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const curTokens = seatInput.value.split(/[,;/+]+/).map(t => t.trim()).filter(Boolean);
        if (curTokens.length > 0 && lastToken) {
          curTokens.pop();
        }
        if (!curTokens.includes(seat.id)) {
          curTokens.push(seat.id);
        }
        seatInput.value = curTokens.join(', ');
        dropdown.classList.add('hidden');
        seatInput.focus();
      };
      dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
  }

  seatInput.addEventListener('focus', renderDropdown);
  seatInput.addEventListener('input', renderDropdown);

  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target) && e.target !== seatInput) {
      dropdown.classList.add('hidden');
    }
  });
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
window.escapeHtml = escapeHtml;

// ================= OPERATIONS SUITE FUNCTIONS =================

function renderCheckInButtonHtml(guest) {
  const quota = guest.participant || 1;

  // Compute from new seats array first, fall back to legacy attended/attendedCount
  let checkedInCount = 0;
  let totalSeats = 0;
  if (Array.isArray(guest.seats) && guest.seats.length > 0) {
    totalSeats = guest.seats.length;
    checkedInCount = guest.seats.filter(s => typeof s === 'object' ? s.checkedIn : false).length;
  } else {
    totalSeats = quota;
    checkedInCount = guest.attendedCount !== undefined ? guest.attendedCount : (guest.attended ? quota : 0);
  }

  const status = guest.checkInStatus || (checkedInCount === 0 ? 'not-checked' : (checkedInCount >= totalSeats ? 'complete' : 'partial'));

  if (quota > 1 || totalSeats > 1) {
    if (status === 'complete') {
      return `
        <button class="btn-checkin-toggle checked-in" onclick="event.stopPropagation(); toggleGuestCheckIn('${guest.id}')" title="เซ็นครบแล้ว (${checkedInCount}/${totalSeats} ท่าน) คลิกเพื่อยกเลิก">
          <i class="fa-solid fa-check"></i>
          <span>เซ็นครบ (${totalSeats})</span>
        </button>
      `;
    } else if (status === 'partial') {
      return `
        <button class="btn-checkin-toggle partial" onclick="event.stopPropagation(); openPartialCheckInModalById('${guest.id}')" title="มาบางส่วน คลิกเพื่อเปลี่ยนจำนวน">
          <i class="fa-solid fa-users-viewfinder"></i>
          <span>มา ${checkedInCount}/${totalSeats}</span>
        </button>
      `;
    } else {
      return `
        <button class="btn-checkin-toggle not-checked" onclick="event.stopPropagation(); toggleGuestCheckIn('${guest.id}')" title="คลิกเพื่อเซ็นชื่อเช็คอิน">
          <i class="fa-solid fa-circle-dot"></i>
          <span>รอเซ็น (${totalSeats})</span>
        </button>
      `;
    }
  }

  const isComplete = (status === 'complete' || guest.attended);
  return `
    <button class="btn-checkin-toggle ${isComplete ? 'checked-in' : 'not-checked'}" onclick="event.stopPropagation(); toggleGuestCheckIn('${guest.id}')" title="${isComplete ? 'เซ็นแล้ว (คลิกเพื่อยกเลิก)' : 'คลิกเพื่อเซ็นชื่อเช็คอิน'}">
      <i class="fa-solid ${isComplete ? 'fa-check' : 'fa-circle-dot'}"></i>
      <span>${isComplete ? 'เซ็นแล้ว ✓' : 'รอเซ็น'}</span>
    </button>
  `;
}

let undoCountdownInterval = null;
let activeUndoSnapshotId = null;

function setupOperationsModals() {
  // 1. Walk-in Modal setup
  const modalWalkIn = document.getElementById('modalWalkInSeat');
  const btnCloseWalkIn = document.getElementById('btnCloseWalkInModal');
  const btnCancelWalkIn = document.getElementById('btnCancelWalkIn');
  const formWalkIn = document.getElementById('formWalkIn');
  const walkInPhone = document.getElementById('walkInPhone');
  const walkInName = document.getElementById('walkInName');
  const walkInPartInput = document.getElementById('walkInParticipant');
  const btnOpenPickerWalkIn = document.getElementById('btnOpenSeatPickerForWalkIn');
  const btnAddDirectSeat = document.getElementById('btnAddDirectSeatToWalkIn');
  const inputDirectSeat = document.getElementById('walkInDirectSeatInput');

  const closeWalkIn = () => modalWalkIn && modalWalkIn.classList.add('hidden');
  if (btnCloseWalkIn) btnCloseWalkIn.addEventListener('click', closeWalkIn);
  if (btnCancelWalkIn) btnCancelWalkIn.addEventListener('click', closeWalkIn);
  if (modalWalkIn) modalWalkIn.addEventListener('click', (e) => { if (e.target === modalWalkIn) closeWalkIn(); });

  // Open Walk-in Modal buttons
  const openWalkInButtons = document.querySelectorAll(
    '#btnOpenGroupWalkInFromSeats, #btnOpenGroupWalkInFromGuests, .btn-open-walkin, .btn-header-walkin'
  );
  openWalkInButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof window.openWalkInModal === 'function') {
        window.openWalkInModal();
      }
    });
  });

  let dupTimer = null;
  const triggerDupCheck = () => {
    clearTimeout(dupTimer);
    dupTimer = setTimeout(checkWalkInDuplicates, 350);
  };
  if (walkInPhone) walkInPhone.addEventListener('input', triggerDupCheck);
  if (walkInName) walkInName.addEventListener('input', triggerDupCheck);
  if (formWalkIn) formWalkIn.addEventListener('submit', handleWalkInSubmit);

  // Parity reactivity on participant change
  if (walkInPartInput) {
    walkInPartInput.addEventListener('input', () => renderWalkInSelectedSeats());
    walkInPartInput.addEventListener('change', () => renderWalkInSelectedSeats());
  }

  // Open SeatPicker for Walk-in
  if (btnOpenPickerWalkIn) {
    btnOpenPickerWalkIn.addEventListener('click', () => {
      const targetCount = parseInt(document.getElementById('walkInParticipant')?.value, 10) || 1;
      if (window.SeatPicker) {
        window.SeatPicker.open({
          mode: 'walkin',
          targetCount,
          screeningId: state.activeScreeningId,
          initialSeats: window._walkInSelectedSeats || [],
          parentModalId: 'modalWalkInSeat',
          onConfirm: (selectedSeats) => {
            window._walkInSelectedSeats = selectedSeats;
            renderWalkInSelectedSeats();
          }
        });
      }
    });
  }

  // Direct seat input handler
  const handleDirectSeatAdd = () => {
    if (!inputDirectSeat) return;
    const raw = inputDirectSeat.value.trim().toUpperCase();
    if (!raw) return;

    let seatList = [];
    if (typeof expandSeatRanges === 'function') {
      const expanded = expandSeatRanges(raw);
      seatList = expanded.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    } else {
      seatList = raw.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    }

    const seatsMap = getSeatsMap();
    for (const s of seatList) {
      if (seatsMap[s]) {
        alert(`ที่นั่ง ${s} ถูกจัดให้แขกท่านอื่นแล้ว (${seatsMap[s].name || ''}) ไม่สามารถเลือกได้`);
        return;
      }
      if (!isValidSeatId(s)) {
        alert(`ไม่พบที่นั่ง ${s} ในโรงภาพยนตร์`);
        return;
      }
      if (!window._walkInSelectedSeats.includes(s)) {
        window._walkInSelectedSeats.push(s);
      }
    }

    inputDirectSeat.value = '';
    renderWalkInSelectedSeats();
  };

  if (btnAddDirectSeat) btnAddDirectSeat.addEventListener('click', handleDirectSeatAdd);
  if (inputDirectSeat) {
    inputDirectSeat.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDirectSeatAdd();
      }
    });
  }

  // 2. Move Seat Modal setup
  const modalMove = document.getElementById('modalMoveSeat');
  const btnCloseMove = document.getElementById('btnCloseMoveSeatModal');
  const btnCancelMove = document.getElementById('btnCancelMoveSeat');
  const formMove = document.getElementById('formMoveSeat');

  const closeMove = () => modalMove && modalMove.classList.add('hidden');
  if (btnCloseMove) btnCloseMove.addEventListener('click', closeMove);
  if (btnCancelMove) btnCancelMove.addEventListener('click', closeMove);
  if (modalMove) modalMove.addEventListener('click', (e) => { if (e.target === modalMove) closeMove(); });
  if (formMove) formMove.addEventListener('submit', handleMoveSeatSubmit);

  const scopeRadios = document.querySelectorAll('input[name="moveSeatScope"]');
  scopeRadios.forEach(r => {
    r.addEventListener('change', updateMoveScopeUI);
  });

  const btnOpenPickerMove = document.getElementById('btnOpenSeatPickerForMove');
  if (btnOpenPickerMove) {
    btnOpenPickerMove.addEventListener('click', () => {
      const targetCount = getSelectedMoveSeatsCount();
      const guest = state.guests.find(g => g.id === document.getElementById('moveSeatGuestId').value);
      const preferred = guest && guest.seat ? guest.seat.split(',')[0].trim() : null;
      window.SeatPicker.open({
        mode: 'move',
        targetCount,
        preferredSeat: preferred,
        screeningId: state.activeScreeningId,
        onConfirm: (selectedSeats) => {
          document.getElementById('moveSeatToInput').value = selectedSeats.join(', ');
        }
      });
    });
  }

  // 3. Pre Check-in Modal setup
  const modalPre = document.getElementById('modalPreCheckIn');
  const btnClosePre = document.getElementById('btnClosePreCheckInModal');
  const btnCancelPre = document.getElementById('btnCancelPreCheckIn');
  const btnConfirmPre = document.getElementById('btnConfirmPreCheckIn');

  const closePre = () => modalPre && modalPre.classList.add('hidden');
  if (btnClosePre) btnClosePre.addEventListener('click', closePre);
  if (btnCancelPre) btnCancelPre.addEventListener('click', closePre);
  if (modalPre) modalPre.addEventListener('click', (e) => { if (e.target === modalPre) closePre(); });
  if (btnConfirmPre) btnConfirmPre.addEventListener('click', handleConfirmPreCheckIn);

  // 4. Partial Check-in Modal setup
  const modalPartial = document.getElementById('modalPartialCheckIn');
  const btnClosePartial = document.getElementById('btnClosePartialCheckInModal');
  const btnCancelPartial = document.getElementById('btnCancelPartialCheckIn');
  const btnSubmitPartial = document.getElementById('btnSubmitPartialCheckIn');
  const partialRange = document.getElementById('partialCountRange');

  const closePartial = () => modalPartial && modalPartial.classList.add('hidden');
  if (btnClosePartial) btnClosePartial.addEventListener('click', closePartial);
  if (btnCancelPartial) btnCancelPartial.addEventListener('click', closePartial);
  if (modalPartial) modalPartial.addEventListener('click', (e) => { if (e.target === modalPartial) closePartial(); });

  if (partialRange) {
    partialRange.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const disp = document.getElementById('partialCountDisplay');
      const max = parseInt(partialRange.max, 10);
      if (disp) disp.textContent = val;
      const lbl = document.getElementById('partialStatusLabel');
      if (lbl) {
        if (val === 0) {
          lbl.textContent = 'ยังไม่มาถึง (0 ท่าน)';
          lbl.style.color = 'var(--text-muted)';
        } else if (val >= max) {
          lbl.textContent = `มาครบแล้ว (${val}/${max} ท่าน ✓)`;
          lbl.style.color = '#34d399';
        } else {
          lbl.textContent = `มาบางส่วน (${val}/${max} ท่าน)`;
          lbl.style.color = 'var(--color-teal)';
        }
      }
    });
  }
  if (btnSubmitPartial) btnSubmitPartial.addEventListener('click', handlePartialCheckInSubmit);

  // 5. Safe Bulk Delete Modal setup
  const btnOpenBulk = document.getElementById('btnOpenBulkDeleteModal');
  const modalBulk = document.getElementById('modalBulkDelete');
  const btnCloseBulk = document.getElementById('btnCloseBulkDeleteModal');
  const btnCancelBulk = document.getElementById('btnCancelBulkDelete');
  const btnSubmitBulk = document.getElementById('btnSubmitBulkDelete');
  const inputConfirmBulk = document.getElementById('bulkDeleteConfirmInput');

  const closeBulk = () => modalBulk && modalBulk.classList.add('hidden');
  if (btnOpenBulk) btnOpenBulk.addEventListener('click', openBulkDeleteModal);
  if (btnCloseBulk) btnCloseBulk.addEventListener('click', closeBulk);
  if (btnCancelBulk) btnCancelBulk.addEventListener('click', closeBulk);
  if (modalBulk) modalBulk.addEventListener('click', (e) => { if (e.target === modalBulk) closeBulk(); });

  if (inputConfirmBulk) {
    inputConfirmBulk.addEventListener('input', (e) => {
      const val = e.target.value.trim().toUpperCase();
      const expected = (inputConfirmBulk.dataset.expected || 'DELETE').toUpperCase();
      btnSubmitBulk.disabled = (val !== 'DELETE' && val !== expected);
    });
  }
  if (btnSubmitBulk) btnSubmitBulk.addEventListener('click', handleBulkDeleteSubmit);

  // 6. Floating Undo Banner setup
  const btnTriggerUndo = document.getElementById('btnTriggerUndo');
  const btnCloseUndo = document.getElementById('btnCloseUndoBanner');
  if (btnTriggerUndo) btnTriggerUndo.addEventListener('click', handleUndoRestore);
  if (btnCloseUndo) btnCloseUndo.addEventListener('click', () => {
    document.getElementById('floatingUndoBanner')?.classList.add('hidden');
    clearInterval(undoCountdownInterval);
  });
}

// ---------------- WALK-IN FUNCTIONS (Multi-Guest & Group Parity) ----------------
window._walkInSelectedSeats = [];

window.openWalkInModal = function(seatId = null) {
  const modal = document.getElementById('modalWalkInSeat');
  if (!modal) return;

  const cleanSeatId = (typeof seatId === 'string' && seatId.trim()) ? seatId.trim().toUpperCase() : null;

  if (cleanSeatId) {
    window._walkInSelectedSeats = [cleanSeatId];
  } else {
    window._walkInSelectedSeats = [];
  }

  // Update modal title depending on whether opened for a specific seat or generally
  const titleEl = document.getElementById('walkInModalTitle');
  if (titleEl) {
    titleEl.innerHTML = cleanSeatId
      ? `<i class="fa-solid fa-person-walking-dashed-line-arrow-right" style="color: var(--color-teal);"></i> เพิ่มแขก Walk-in สำหรับที่นั่ง ${escapeHtml(cleanSeatId)}`
      : `<i class="fa-solid fa-person-walking-dashed-line-arrow-right" style="color: var(--color-teal);"></i> เพิ่มแขก Walk-in (เดี่ยว / กลุ่ม)`;
  }

  // Reset inputs
  document.getElementById('walkInName').value = '';
  document.getElementById('walkInMedia').value = 'Walk-in แขกทั่วไป';
  document.getElementById('walkInParticipant').value = window._walkInSelectedSeats.length > 0 ? window._walkInSelectedSeats.length : 1;
  document.getElementById('walkInPhone').value = '';
  document.getElementById('walkInImmediateCheckIn').checked = true;

  document.getElementById('walkInDuplicateWarning')?.classList.add('hidden');
  const dupList = document.getElementById('walkInDuplicateList');
  if (dupList) dupList.innerHTML = '';
  document.getElementById('walkInPhoneError')?.classList.add('hidden');

  renderWalkInSelectedSeats();

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('walkInName')?.focus(), 50);
};

function renderWalkInSelectedSeats() {
  const participant = parseInt(document.getElementById('walkInParticipant')?.value, 10) || 1;
  const seats = window._walkInSelectedSeats || [];
  const displayEl = document.getElementById('walkInSeatDisplay');
  const pillsEl = document.getElementById('walkInSeatsPillsContainer');
  const warningEl = document.getElementById('walkInParityWarning');
  const btnSubmit = document.getElementById('btnSubmitWalkIn');
  const adjContainer = document.getElementById('walkInAdjacentSuggestions');

  if (displayEl) {
    displayEl.textContent = seats.length > 0 ? seats.join(', ') : 'ยังไม่ได้เลือกที่นั่ง';
  }

  if (pillsEl) {
    pillsEl.innerHTML = '';
    seats.forEach(s => {
      const pill = document.createElement('span');
      pill.className = 'badge';
      pill.style.cssText = 'background: rgba(45, 212, 191, 0.15); border: 1px solid rgba(45, 212, 191, 0.3); color: var(--color-teal); font-family: monospace; font-size: 13px; font-weight: 700; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 6px;';
      pill.innerHTML = s + ' <i class="fa-solid fa-xmark" style="cursor: pointer; opacity: 0.7;" title="เอาออก"></i>';
      pill.querySelector('.fa-xmark').onclick = () => {
        window._walkInSelectedSeats = window._walkInSelectedSeats.filter(x => x !== s);
        renderWalkInSelectedSeats();
      };
      pillsEl.appendChild(pill);
    });
  }

  // Render Adjacent / Quick Seat Suggestions
  if (adjContainer) {
    adjContainer.innerHTML = '';
    const seatsMap = getSeatsMap();
    const needed = participant - seats.length;

    if (needed > 0 && seats.length > 0) {
      const candidates = new Set();
      seats.forEach(seatId => {
        const m = seatId.match(/^([A-Za-z]+)(\d+)$/);
        if (m) {
          const row = m[1].toUpperCase();
          const num = parseInt(m[2], 10);
          const leftSeat = `${row}${num - 1}`;
          const rightSeat = `${row}${num + 1}`;
          if (!seats.includes(leftSeat) && !seatsMap[leftSeat] && isValidSeatId(leftSeat)) {
            candidates.add(leftSeat);
          }
          if (!seats.includes(rightSeat) && !seatsMap[rightSeat] && isValidSeatId(rightSeat)) {
            candidates.add(rightSeat);
          }
        }
      });

      const candList = Array.from(candidates).slice(0, 4);
      if (candList.length > 0) {
        candList.forEach(adjSeat => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'seat-quick-chip';
          chip.innerHTML = `<i class="fa-solid fa-plus"></i> เพิ่ม ${adjSeat}`;
          chip.title = `เพิ่มที่นั่งติดกัน ${adjSeat}`;
          chip.onclick = () => {
            if (!window._walkInSelectedSeats.includes(adjSeat)) {
              window._walkInSelectedSeats.push(adjSeat);
              renderWalkInSelectedSeats();
            }
          };
          adjContainer.appendChild(chip);
        });
      } else {
        adjContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">ไม่มีที่นั่งว่างติดกันในแถวนี้</span>';
      }
    } else if (seats.length === 0) {
      adjContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-arrow-left"></i> พิมพ์เลขที่นั่ง หรือกดเลือกที่นั่ง (SeatPicker)</span>';
    }
  }

  const isParity = seats.length === participant;
  if (warningEl) {
    if (isParity) {
      warningEl.innerHTML = '<span style="color: #34d399;"><i class="fa-solid fa-circle-check"></i> เลือกที่นั่งครบตามจำนวนแขกแล้ว (' + seats.length + '/' + participant + ' ที่นั่ง)</span>';
    } else if (seats.length < participant) {
      warningEl.innerHTML = '<span style="color: #fbbf24;"><i class="fa-solid fa-circle-info"></i> จำนวนที่นั่งต้องตรงกับจำนวนแขก (ขาดอีก ' + (participant - seats.length) + ' ที่นั่ง)</span>';
    } else {
      warningEl.innerHTML = '<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> เลือกที่นั่งเกินจำนวนแขก (' + (seats.length - participant) + ' ที่นั่ง)</span>';
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = !isParity;
  }
}

async function checkWalkInDuplicates() {
  const name = document.getElementById('walkInName')?.value.trim();
  const phone = document.getElementById('walkInPhone')?.value.trim();
  const warnBox = document.getElementById('walkInDuplicateWarning');
  const listEl = document.getElementById('walkInDuplicateList');
  if (!warnBox || !listEl || (!name && !phone)) {
    if (warnBox) warnBox.classList.add('hidden');
    return;
  }

  try {
    const res = await API.checkDuplicates(state.activeScreeningId, { name, phone });
    if (res.success && res.duplicates.length > 0) {
      warnBox.classList.remove('hidden');
      listEl.innerHTML = res.duplicates.map(d => `
        <div class="walkin-duplicate-item">
          <strong>${escapeHtml(d.guest.name)}</strong> (${escapeHtml(d.guest.organization || 'ไม่ระบุสื่อ')}) 
          - ที่นั่ง: <span style="color: var(--color-gold); font-family: monospace;">${escapeHtml(d.guest.seat || 'ยังไม่จัด')}</span>
          · สาเหตุ: <em>${d.matchType}</em>
        </div>
      `).join('');
    } else {
      warnBox.classList.add('hidden');
      listEl.innerHTML = '';
    }
  } catch (err) {
    console.warn('Duplicate check failed', err);
  }
}

async function handleWalkInSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('walkInName').value.trim();
  const detail = document.getElementById('walkInMedia').value.trim() || 'Walk-in แขกทั่วไป';
  const participant = parseInt(document.getElementById('walkInParticipant').value, 10) || 1;
  const phone = document.getElementById('walkInPhone').value.trim();
  const attended = document.getElementById('walkInImmediateCheckIn').checked;
  const seats = window._walkInSelectedSeats || [];

  // Phone 10-digit validation
  const walkInPhoneErrEl = document.getElementById('walkInPhoneError');
  const walkInPhoneValidation = validatePhone(phone);
  if (!walkInPhoneValidation.valid) {
    if (walkInPhoneErrEl) walkInPhoneErrEl.classList.remove('hidden');
    document.getElementById('walkInPhone').focus();
    return;
  } else {
    if (walkInPhoneErrEl) walkInPhoneErrEl.classList.add('hidden');
  }

  if (seats.length !== participant) {
    alert('กรุณาเลือกที่นั่งให้ครบ ' + participant + ' ที่นั่ง (ขณะนี้เลือก ' + seats.length + ' ที่)');
    return;
  }

  const btnSubmit = document.getElementById('btnSubmitWalkIn');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';

  try {
    const res = await API.walkIn({
      screeningId: state.activeScreeningId,
      name,
      detail,
      organization: detail,
      participant,
      seats,
      phone,
      attended
    });

    if (res.success) {
      showToast(`เพิ่มแขก Walk-in ${name} (${participant} ท่าน: ${seats.join(', ')}) สำเร็จ 🎬`);
      document.getElementById('modalWalkInSeat').classList.add('hidden');
      await refreshData();
      if (seats.length > 0) showSeatDetails(seats[0]);
    } else {
      showToast(res.message || 'บันทึก Walk-in ไม่สำเร็จ', 'error');
    }
  } catch (err) {
    // Senior Non-destructive 409 Conflict Recovery
    if (err.code === 'SEAT_CONFLICT' && err.conflictedSeats) {
      showToast(`ที่นั่ง ${err.conflictedSeats.join(', ')} ถูกจองแล้ว กรุณาเลือกที่นั่งทดแทน`, 'error');
      window._walkInSelectedSeats = err.validSeats || [];
      renderWalkInSelectedSeats();
      
      window.SeatPicker.handleConflictRecovery(err, (newSeats) => {
        window._walkInSelectedSeats = newSeats;
        renderWalkInSelectedSeats();
      });
    } else {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> ยืนยัน Walk-in';
  }
}

// ---------------- MOVE SEAT FUNCTIONS (Group & Partial Reassignment) ----------------
window.openMoveSeatModal = async function(guestId, fromSeat = null) {
  const modal = document.getElementById('modalMoveSeat');
  if (!modal) return;

  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  document.getElementById('moveSeatGuestId').value = guestId;
  document.getElementById('moveSeatGuestName').textContent = guest.name || 'ไม่ระบุชื่อ';
  document.getElementById('moveSeatGuestOrg').textContent = guest.organization || 'ไม่ระบุสื่อ';
  
  const guestSeats = guest.seat ? guest.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];
  document.getElementById('moveSeatCurrentSeatsDisplay').textContent = guestSeats.join(', ') || 'ยังไม่มีที่นั่ง';

  // Default to entire move if multiple seats
  const scopeEntire = document.getElementById('moveScopeEntire');
  if (scopeEntire) scopeEntire.checked = true;
  updateMoveScopeUI();

  // Populate partial checklist
  const checklistEl = document.getElementById('moveSeatPartialChecklist');
  if (checklistEl) {
    checklistEl.innerHTML = '';
    guestSeats.forEach(s => {
      const isInitial = fromSeat ? s === fromSeat.trim().toUpperCase() : true;
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; font-family: monospace; font-size: 13px; font-weight: 700; color: #fff; cursor: pointer; background: rgba(255,255,255,0.06); padding: 4px 10px; border-radius: 4px;';
      lbl.innerHTML = `<input type="checkbox" class="chk-move-partial-seat" value="${s}" ${isInitial ? 'checked' : ''} style="accent-color: var(--color-gold);"> ${s}`;
      lbl.querySelector('input').addEventListener('change', updateMoveInputsFromScope);
      checklistEl.appendChild(lbl);
    });
  }

  updateMoveInputsFromScope();

  document.getElementById('moveSeatConflictAlert').classList.add('hidden');
  document.getElementById('moveSeatConflictText').innerHTML = '';

  const altContainer = document.getElementById('moveSeatAlternativesList');
  altContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-dim);"><i class="fa-solid fa-spinner fa-spin"></i> กำลังหาที่นั่งว่างใกล้เคียง...</span>';

  modal.classList.remove('hidden');

  const refSeat = fromSeat || (guestSeats.length > 0 ? guestSeats[0] : 'E12');
  try {
    const res = await API.getSeatSuggestions(state.activeScreeningId, refSeat, 1);
    if (res.success && res.data.length > 0) {
      altContainer.innerHTML = res.data.map(alt => `
        <button type="button" class="alternative-seat-chip" onclick="selectAlternativeSeat('${alt.seatId}')">
          <span>${alt.seatId}</span>
          <span class="chip-reason">(${alt.reason})</span>
        </button>
      `).join('');
    } else {
      altContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-dim);">ไม่พบที่นั่งว่างในแถวใกล้เคียง</span>';
    }
  } catch (err) {
    altContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-dim);">-</span>';
  }

  setTimeout(() => document.getElementById('moveSeatToInput')?.focus(), 50);
};

function updateMoveScopeUI() {
  const isPartial = document.getElementById('moveScopePartial')?.checked;
  const container = document.getElementById('moveSeatPartialChecklistContainer');
  if (container) {
    if (isPartial) container.classList.remove('hidden');
    else container.classList.add('hidden');
  }
  updateMoveInputsFromScope();
}

function getSelectedMoveSeatsCount() {
  const isPartial = document.getElementById('moveScopePartial')?.checked;
  if (!isPartial) {
    const guest = state.guests.find(g => g.id === document.getElementById('moveSeatGuestId')?.value);
    const guestSeats = guest && guest.seat ? guest.seat.split(',').map(s => s.trim()).filter(Boolean) : [];
    return guestSeats.length || 1;
  } else {
    const checked = Array.from(document.querySelectorAll('.chk-move-partial-seat:checked')).map(c => c.value);
    return checked.length || 1;
  }
}

function updateMoveInputsFromScope() {
  const isPartial = document.getElementById('moveScopePartial')?.checked;
  const guest = state.guests.find(g => g.id === document.getElementById('moveSeatGuestId')?.value);
  const guestSeats = guest && guest.seat ? guest.seat.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : [];

  const fromInput = document.getElementById('moveSeatFromInput');
  if (!isPartial) {
    if (fromInput) fromInput.value = guestSeats.join(', ');
  } else {
    const checked = Array.from(document.querySelectorAll('.chk-move-partial-seat:checked')).map(c => c.value);
    if (fromInput) fromInput.value = checked.join(', ');
  }
}

window.selectAlternativeSeat = function(seatId) {
  const targetInput = document.getElementById('moveSeatToInput');
  if (targetInput) {
    targetInput.value = seatId;
    targetInput.focus();
  }
};

async function handleMoveSeatSubmit(e) {
  e.preventDefault();
  const guestId = document.getElementById('moveSeatGuestId').value;
  const fromSeats = document.getElementById('moveSeatFromInput').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const toSeats = document.getElementById('moveSeatToInput').value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  if (fromSeats.length === 0 || toSeats.length === 0) {
    alert('กรุณาระบุที่นั่งเดิมและที่นั่งเป้าหมาย');
    return;
  }

  if (fromSeats.length !== toSeats.length) {
    alert('จำนวนที่นั่งปลายทาง (' + toSeats.length + ' ที่) ต้องเท่ากับจำนวนที่นั่งเดิมที่เลือกย้าย (' + fromSeats.length + ' ที่)');
    return;
  }

  const moves = fromSeats.map((from, idx) => ({ from, to: toSeats[idx] }));

  const conflictAlert = document.getElementById('moveSeatConflictAlert');
  const conflictText = document.getElementById('moveSeatConflictText');
  conflictAlert.classList.add('hidden');

  try {
    const res = await API.movePartialSeats({
      screeningId: state.activeScreeningId,
      guestId,
      moves
    });

    if (res.success) {
      showToast(`ย้ายที่นั่ง ${moves.map(m => m.from + ' -> ' + m.to).join(', ')} สำเร็จ 🎬`);
      document.getElementById('modalMoveSeat').classList.add('hidden');
      state.selectedSeat = toSeats[0];
      await refreshData();
      showSeatDetails(toSeats[0]);
    }
  } catch (err) {
    conflictAlert.classList.remove('hidden');
    conflictText.textContent = err.message || 'ที่นั่งเป้าหมายไม่ว่าง';

    try {
      const sugg = await API.getSeatSuggestions(state.activeScreeningId, toSeats[0], 1);
      const altContainer = document.getElementById('moveSeatAlternativesList');
      if (sugg.success && sugg.data.length > 0 && altContainer) {
        altContainer.innerHTML = sugg.data.map(alt => `
          <button type="button" class="alternative-seat-chip" onclick="selectAlternativeSeat('${alt.seatId}')">
            <span>${alt.seatId}</span>
            <span class="chip-reason">(${alt.reason})</span>
          </button>
        `).join('');
      }
    } catch (_) {}
  }
}

// ---------------- PRE CHECK-IN FUNCTIONS ----------------
window.openPreCheckInModal = function(guest, missingWarning = [], isCritical = false) {
  const modal = document.getElementById('modalPreCheckIn');
  if (!modal) return;

  document.getElementById('preCheckInGuestId').value = guest.id;
  const summaryBox = document.getElementById('preCheckInSummaryBox');
  summaryBox.innerHTML = `
    <div style="font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(guest.name || 'ไม่ระบุชื่อ')}</div>
    <div style="font-size: 12.5px; color: var(--color-gold); margin-top: 2px;">
      <i class="fa-solid fa-building"></i> ${escapeHtml(guest.organization || 'ไม่ระบุสื่อ')} · โควตา: ${guest.participant || 1} ท่าน
    </div>
    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
      ที่นั่ง: <span style="color: var(--color-teal); font-family: monospace; font-weight: 600;">${escapeHtml(guest.seat || 'ยังไม่ได้จัดที่นั่ง')}</span>
    </div>
  `;

  const critAlert = document.getElementById('preCheckInCriticalAlert');
  const critList = document.getElementById('preCheckInCriticalList');
  const quickFix = document.getElementById('preCheckInQuickFixInputs');
  const warnAlert = document.getElementById('preCheckInWarningAlert');
  const warnText = document.getElementById('preCheckInWarningText');
  const phoneRow = document.getElementById('preCheckInPhoneInputRow');

  critAlert.classList.add('hidden');
  warnAlert.classList.add('hidden');
  critList.innerHTML = '';
  quickFix.innerHTML = '';

  const missingCritical = [];
  if (!guest.name || guest.name.trim() === '' || guest.name === '-') missingCritical.push('ชื่อ (Name)');
  if (!guest.seat || guest.seat.trim() === '') missingCritical.push('ที่นั่ง (Seat)');

  if (missingCritical.length > 0) {
    critAlert.classList.remove('hidden');
    critList.innerHTML = missingCritical.map(m => `<li>${m}</li>`).join('');

    let fixHtml = '';
    if (missingCritical.includes('ชื่อ (Name)')) {
      fixHtml += `
        <div>
          <label style="font-size: 11.5px; color: var(--text-muted);">ระบุชื่อแขก:</label>
          <input type="text" id="preCheckInFixName" class="screening-select" style="width: 100%; max-width: 100%;" placeholder="ชื่อแขก">
        </div>
      `;
    }
    if (missingCritical.includes('ที่นั่ง (Seat)')) {
      fixHtml += `
        <div>
          <label style="font-size: 11.5px; color: var(--text-muted);">ระบุที่นั่ง (เช่น E10 หรือ B16-B17):</label>
          <input type="text" id="preCheckInFixSeat" class="screening-select" style="width: 100%; max-width: 100%; font-family: monospace;" placeholder="เช่น E10">
        </div>
      `;
    }
    quickFix.innerHTML = fixHtml;
  }

  if (missingWarning && missingWarning.length > 0) {
    warnAlert.classList.remove('hidden');
    warnText.textContent = `แขกยังไม่ได้ระบุ: ${missingWarning.join(', ')} แต่สามารถเช็คอินได้`;
    if (phoneRow) {
      phoneRow.classList.remove('hidden');
      document.getElementById('preCheckInPhoneInput').value = '';
    }
  }

  modal.classList.remove('hidden');
};

async function handleConfirmPreCheckIn() {
  const guestId = document.getElementById('preCheckInGuestId').value;
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  const fixName = document.getElementById('preCheckInFixName')?.value.trim();
  const fixSeat = document.getElementById('preCheckInFixSeat')?.value.trim();
  const phoneVal = document.getElementById('preCheckInPhoneInput')?.value.trim();

  const updates = {};
  if (fixName) updates.name = fixName;
  if (fixSeat) updates.seat = (typeof expandSeatRanges === 'function') ? expandSeatRanges(fixSeat) : fixSeat;
  if (phoneVal) {
    const phoneValidation = validatePhone(phoneVal);
    const phoneErrEl = document.getElementById('preCheckInPhoneError');
    if (!phoneValidation.valid) {
      if (phoneErrEl) phoneErrEl.classList.remove('hidden');
      document.getElementById('preCheckInPhoneInput')?.focus();
      return;
    } else {
      if (phoneErrEl) phoneErrEl.classList.add('hidden');
      updates.phone = phoneVal;
    }
  }

  if (Object.keys(updates).length > 0) {
    try {
      await API.updateGuest(guestId, updates);
    } catch (err) {
      showToast('ไม่สามารถอัปเดตข้อมูลได้: ' + err.message, 'error');
      return;
    }
  }

  document.getElementById('modalPreCheckIn').classList.add('hidden');
  await window.toggleGuestCheckIn(guestId, { confirmedWarning: true, checkInAnyway: true, skipPartialModal: true });
}

// ---------------- PARTIAL CHECK-IN FUNCTIONS ----------------
window.openPartialCheckInModalById = function(guestId) {
  const guest = state.guests.find(g => g.id === guestId);
  if (guest) openPartialCheckInModal(guest);
};

window.openPartialCheckInModal = function(guest) {
  const modal = document.getElementById('modalPartialCheckIn');
  if (!modal) return;

  document.getElementById('partialCheckInGuestId').value = guest.id;
  const summaryBox = document.getElementById('partialGuestSummaryBox');
  summaryBox.innerHTML = `
    <div style="font-size: 15px; font-weight: 700; color: #fff;">${escapeHtml(guest.name)}</div>
    <div style="font-size: 12.5px; color: var(--color-gold); margin-top: 2px;">
      <i class="fa-solid fa-building"></i> ${escapeHtml(guest.detail || guest.organization || 'ไม่ระบุสื่อ')} · โควตาทั้งหมด: <strong>${guest.participant || 1} ท่าน</strong>
    </div>
    <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
      ที่นั่ง: <span style="color: var(--color-teal); font-family: monospace;">${escapeHtml(guest.seat || '-')}</span>
    </div>
  `;

  const quota = guest.participant || 1;
  const seats = Array.isArray(guest.seats) && guest.seats.length > 0 ? guest.seats : [];

  const seatsSection = document.getElementById('partialSeatsSection');
  const countSection = document.getElementById('partialCountSection');
  const checklist = document.getElementById('partialSeatsChecklist');
  const statusLbl = document.getElementById('partialStatusLabel');
  const btnSelectAll = document.getElementById('btnPartialSelectAll');
  const btnDeselectAll = document.getElementById('btnPartialDeselectAll');

  const updateStatusLabel = () => {
    if (!checklist || !statusLbl) return;
    const allBoxes = checklist.querySelectorAll('input[type="checkbox"]');
    const checkedCount = Array.from(allBoxes).filter(cb => cb.checked).length;
    const total = allBoxes.length || quota;
    if (checkedCount === 0) {
      statusLbl.textContent = 'ยังไม่มาถึง (0 ท่าน)';
      statusLbl.style.color = 'var(--text-muted)';
    } else if (checkedCount >= total) {
      statusLbl.textContent = `มาครบแล้ว (${checkedCount}/${total} ท่าน ✓)`;
      statusLbl.style.color = '#34d399';
    } else {
      statusLbl.textContent = `มาบางส่วน (${checkedCount}/${total} ท่าน)`;
      statusLbl.style.color = 'var(--color-teal)';
    }
  };

  if (seats.length > 0) {
    // Show seat checkboxes, hide range slider
    if (seatsSection) seatsSection.classList.remove('hidden');
    if (countSection) countSection.classList.add('hidden');

    checklist.innerHTML = '';
    seats.forEach(sObj => {
      const code = typeof sObj === 'object' ? sObj.code : String(sObj);
      const isChecked = typeof sObj === 'object' ? !!sObj.checkedIn : false;
      const item = document.createElement('label');
      item.className = `partial-seat-item${isChecked ? ' is-checked' : ''}`;
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" class="partial-seat-checkbox" value="${escapeHtml(code)}" ${isChecked ? 'checked' : ''}>
          <span style="font-size: 13px; font-weight: 600; font-family: monospace; color: #fff;">${escapeHtml(code)}</span>
          <span style="font-size: 11px; color: ${isChecked ? '#34d399' : 'var(--text-muted)'};">${isChecked ? '✓ เช็คอินแล้ว' : 'ยังไม่มา'}</span>
        </div>
        <i class="fa-solid ${isChecked ? 'fa-circle-check' : 'fa-circle'}" style="color: ${isChecked ? '#34d399' : 'var(--border-color)'}; font-size: 16px;"></i>
      `;
      const checkbox = item.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          item.classList.add('is-checked');
        } else {
          item.classList.remove('is-checked');
        }
        updateStatusLabel();
      });
      checklist.appendChild(item);
    });

    // Bind select/deselect all buttons
    if (btnSelectAll) {
      btnSelectAll.onclick = () => {
        checklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = true;
          cb.closest('.partial-seat-item')?.classList.add('is-checked');
        });
        updateStatusLabel();
      };
    }
    if (btnDeselectAll) {
      btnDeselectAll.onclick = () => {
        checklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          cb.checked = false;
          cb.closest('.partial-seat-item')?.classList.remove('is-checked');
        });
        updateStatusLabel();
      };
    }

    updateStatusLabel();
  } else {
    // Fallback: show range slider if no specific seats assigned
    if (seatsSection) seatsSection.classList.add('hidden');
    if (countSection) countSection.classList.remove('hidden');

    const range = document.getElementById('partialCountRange');
    const countDisp = document.getElementById('partialCountDisplay');
    const totalDisp = document.getElementById('partialQuotaTotalDisplay');
    const curAttendedCount = guest.attendedCount !== undefined ? guest.attendedCount : (guest.attended ? quota : 1);

    if (range) { range.max = quota; range.value = curAttendedCount; }
    if (countDisp) countDisp.textContent = curAttendedCount;
    if (totalDisp) totalDisp.textContent = `/ ${quota} ท่าน`;
    if (statusLbl) {
      if (curAttendedCount === 0) { statusLbl.textContent = 'ยังไม่มาถึง (0 ท่าน)'; statusLbl.style.color = 'var(--text-muted)'; }
      else if (curAttendedCount >= quota) { statusLbl.textContent = `มาครบแล้ว (${curAttendedCount}/${quota} ท่าน ✓)`; statusLbl.style.color = '#34d399'; }
      else { statusLbl.textContent = `มาบางส่วน (${curAttendedCount}/${quota} ท่าน)`; statusLbl.style.color = 'var(--color-teal)'; }
    }
  }

  modal.classList.remove('hidden');
};

async function handlePartialCheckInSubmit() {
  const guestId = document.getElementById('partialCheckInGuestId').value;
  const guest = state.guests.find(g => g.id === guestId);
  if (!guest) return;

  const quota = guest.participant || 1;
  const seats = Array.isArray(guest.seats) && guest.seats.length > 0 ? guest.seats : [];
  const checklist = document.getElementById('partialSeatsChecklist');

  let payload;

  if (seats.length > 0 && checklist && !document.getElementById('partialSeatsSection')?.classList.contains('hidden')) {
    // Seat-checkbox mode: send explicit seatCodes array
    const selectedCodes = Array.from(checklist.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    const checkedCount = selectedCodes.length;
    payload = {
      seatCodes: selectedCodes,
      attended: checkedCount >= seats.length,
      confirmedWarning: true,
      checkInAnyway: true
    };

    try {
      const res = await API.checkInGuest(guestId, payload);
      if (res.success) {
        const allCodes = seats.map(s => typeof s === 'object' ? s.code : s);
        // DOM update: checked seats → green, unchecked → remove green
        const selectedSet = new Set(selectedCodes.map(c => c.toUpperCase()));
        allCodes.forEach(code => {
          updateSeatsCheckInDom(code, selectedSet.has(code.toUpperCase()));
        });

        showToast(checkedCount > 0
          ? `บันทึกคุณ ${guest.name} (${checkedCount}/${seats.length} ที่นั่ง) เรียบร้อย`
          : `ยกเลิกการเช็คอินคุณ ${guest.name}`);
        document.getElementById('modalPartialCheckIn').classList.add('hidden');
        await refreshData({ skipSeatsGrid: true });
        if (state.selectedSeat) showSeatDetails(state.selectedSeat);
        if (state.selectedGuestId) showGuestDetails(state.selectedGuestId);
      }
    } catch (err) {
      showToast('บันทึกล้มเหลว: ' + err.message, 'error');
    }
  } else {
    // Fallback: range slider mode
    const count = parseInt(document.getElementById('partialCountRange').value, 10);
    try {
      const res = await API.checkInGuest(guestId, {
        attendedCount: count,
        attended: count >= quota,
        confirmedWarning: true,
        checkInAnyway: true
      });

      if (res.success) {
        showToast(count > 0 ? `บันทึกคุณ ${guest.name} (${count}/${quota} ท่าน) เรียบร้อย` : `ยกเลิกการเช็คอินคุณ ${guest.name}`);
        document.getElementById('modalPartialCheckIn').classList.add('hidden');
        await refreshData();
        if (state.selectedSeat) showSeatDetails(state.selectedSeat);
        if (state.selectedGuestId) showGuestDetails(state.selectedGuestId);
      }
    } catch (err) {
      showToast('บันทึกล้มเหลว: ' + err.message, 'error');
    }
  }
}

// ---------------- SAFE BULK DELETE & UNDO FUNCTIONS ----------------
window.openBulkDeleteModal = function() {
  const modal = document.getElementById('modalBulkDelete');
  if (!modal) return;

  const currentScreening = state.screenings.find(s => s.id === state.activeScreeningId);
  const screeningTitle = currentScreening ? currentScreening.title : 'รอบปัจจุบัน';

  const guestCount = state.guests.length;
  let seatCount = 0;
  let checkedCount = 0;

  state.guests.forEach(g => {
    if (g.seat) seatCount += g.seat.split(',').map(s => s.trim()).filter(Boolean).length;
    if (g.attended) checkedCount++;
  });

  const summaryBox = document.getElementById('bulkDeleteSummaryBox');
  summaryBox.innerHTML = `
    <div style="font-weight: 700; color: #fff; font-size: 14.5px; margin-bottom: 6px;">
      <i class="fa-solid fa-film" style="color: var(--color-gold);"></i> ${escapeHtml(screeningTitle)}
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; text-align: center;">
      <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: var(--text-muted);">จำนวนแขก</div>
        <div style="font-size: 18px; font-weight: 700; color: #fff;">${guestCount}</div>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: var(--text-muted);">ที่นั่งที่จัดไว้</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--color-gold);">${seatCount}</div>
      </div>
      <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;">
        <div style="font-size: 11px; color: var(--text-muted);">เช็คอินแล้ว</div>
        <div style="font-size: 18px; font-weight: 700; color: #34d399;">${checkedCount}</div>
      </div>
    </div>
  `;

  const expectedCode = `DELETE ${guestCount}`;
  const codeEl = document.getElementById('bulkDeleteExpectedCode');
  if (codeEl) codeEl.textContent = expectedCode;

  const input = document.getElementById('bulkDeleteConfirmInput');
  if (input) {
    input.value = '';
    input.dataset.expected = expectedCode;
    input.placeholder = `พิมพ์ ${expectedCode} เพื่อยืนยัน`;
  }

  document.getElementById('btnSubmitBulkDelete').disabled = true;
  modal.classList.remove('hidden');
  setTimeout(() => input?.focus(), 50);
};

async function handleBulkDeleteSubmit() {
  const input = document.getElementById('bulkDeleteConfirmInput');
  const confirmation = input ? input.value.trim().toUpperCase() : '';

  const btnSubmit = document.getElementById('btnSubmitBulkDelete');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังลบและสร้าง Snapshot...';

  try {
    const res = await API.bulkDeleteGuests(state.activeScreeningId, confirmation);
    if (res.success) {
      document.getElementById('modalBulkDelete').classList.add('hidden');
      showToast(`ล้างรายชื่อแขก ${res.data.deletedCount} รายการเรียบร้อยแล้ว 🗑️`);
      
      // Trigger Undo floating banner for 60 seconds
      activeUndoSnapshotId = res.data.snapshotId;
      showFloatingUndoBanner(res.data.deletedCount, 60);

      await refreshData();
      state.selectedGuestId = null;
      state.selectedSeat = null;
    }
  } catch (err) {
    showToast('ล้างข้อมูลล้มเหลว: ' + err.message, 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="fa-solid fa-trash"></i> ยืนยันการล้างข้อมูล';
  }
}

function showFloatingUndoBanner(count, seconds = 60) {
  const banner = document.getElementById('floatingUndoBanner');
  const text = document.getElementById('undoBannerText');
  const timer = document.getElementById('undoTimerCountdown');
  if (!banner) return;

  banner.classList.remove('hidden');
  if (text) text.textContent = `ลบรายชื่อแขก ${count} รายการแล้ว`;

  let timeLeft = seconds;
  if (timer) timer.textContent = `${timeLeft}s`;

  clearInterval(undoCountdownInterval);
  undoCountdownInterval = setInterval(() => {
    timeLeft--;
    if (timer) timer.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(undoCountdownInterval);
      banner.classList.add('hidden');
      activeUndoSnapshotId = null;
    }
  }, 1000);
}

async function handleUndoRestore() {
  if (!activeUndoSnapshotId || !state.activeScreeningId) return;

  const btnUndo = document.getElementById('btnTriggerUndo');
  if (btnUndo) {
    btnUndo.disabled = true;
    btnUndo.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังกู้คืนข้อมูล...';
  }

  try {
    const res = await API.restoreSnapshot(state.activeScreeningId, activeUndoSnapshotId);
    if (res.success) {
      showToast(`กู้คืนข้อมูลแขกสำเร็จ ${res.data.restoredCount} รายการ 🎉`);
      document.getElementById('floatingUndoBanner')?.classList.add('hidden');
      clearInterval(undoCountdownInterval);
      activeUndoSnapshotId = null;
      await refreshData();
    }
  } catch (err) {
    showToast('กู้คืนข้อมูลล้มเหลว: ' + err.message, 'error');
  } finally {
    if (btnUndo) {
      btnUndo.disabled = false;
      btnUndo.innerHTML = '<i class="fa-solid fa-rotate-left"></i> กู้คืนข้อมูล (Undo)';
    }
  }
}
