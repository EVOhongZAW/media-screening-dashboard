/**
 * Unified SeatPicker Engine
 * Supports Tri-Modal Seat Selection:
 * 1. Auto Recommend (Contiguous Group Blocks with Heuristic Scoring)
 * 2. Interactive Seat Map (Multi-select staging mode with floating live parity bar)
 * 3. Manual Search Dropdown (Search by name/number, filter by tier/status, full status display)
 * 
 * Features:
 * - Group Parity Lock (Selected count === Target count)
 * - Non-destructive 409 Conflict Recovery
 * - Single vs Entire Group Move Proximity Matching
 */

window.SeatPicker = (function () {
  const state = {
    isOpen: false,
    isMapPicking: false,
    mode: 'walkin', // 'walkin' | 'move' | 'general'
    targetCount: 1,
    selectedSeats: new Set(),
    conflictedSeats: new Set(),
    screeningId: null,
    preferredSeat: null,
    parentModalId: null,
    onConfirm: null,
    onCancel: null,
    allSeatsCache: null,
    activeTab: 'recommend' // 'recommend' | 'dropdown'
  };

  // DOM Elements cache
  let modalEl, floatingBarEl, tabsEl, recContainerEl, dropdownContainerEl, searchInputEl, tierFilterEl, statusFilterEl;

  function init() {
    modalEl = document.getElementById('modalSeatPicker');
    floatingBarEl = document.getElementById('floatingMapSelectionBar');
    tabsEl = document.getElementById('seatPickerTabs');
    recContainerEl = document.getElementById('seatPickerRecList');
    dropdownContainerEl = document.getElementById('seatPickerDropdownList');
    searchInputEl = document.getElementById('seatPickerSearchInput');
    tierFilterEl = document.getElementById('seatPickerTierFilter');
    statusFilterEl = document.getElementById('seatPickerStatusFilter');

    // Event listeners
    const btnClose = document.getElementById('btnCloseSeatPickerModal');
    const btnCancel = document.getElementById('btnCancelSeatPicker');
    const btnConfirm = document.getElementById('btnConfirmSeatPicker');

    if (btnClose) btnClose.addEventListener('click', cancel);
    if (btnCancel) btnCancel.addEventListener('click', cancel);
    if (btnConfirm) btnConfirm.addEventListener('click', confirmSelection);

    if (searchInputEl) searchInputEl.addEventListener('input', renderDropdownList);
    if (tierFilterEl) tierFilterEl.addEventListener('change', renderDropdownList);
    if (statusFilterEl) statusFilterEl.addEventListener('change', renderDropdownList);

    // Tab buttons
    const btnTabRec = document.getElementById('btnTabSeatRec');
    const btnTabDropdown = document.getElementById('btnTabSeatDropdown');
    const btnSwitchToMap = document.getElementById('btnSwitchToMapPick');

    if (btnTabRec) btnTabRec.addEventListener('click', () => switchTab('recommend'));
    if (btnTabDropdown) btnTabDropdown.addEventListener('click', () => switchTab('dropdown'));
    if (btnSwitchToMap) btnSwitchToMap.addEventListener('click', enterMapPickingMode);

    // Floating map bar buttons
    const btnFinishMapPick = document.getElementById('btnFinishMapPick');
    const btnCancelMapPick = document.getElementById('btnCancelMapPick');
    if (btnFinishMapPick) btnFinishMapPick.addEventListener('click', exitMapPickingModeConfirm);
    if (btnCancelMapPick) btnCancelMapPick.addEventListener('click', exitMapPickingModeCancel);
  }

  /**
   * Open SeatPicker
   */
  async function open(options = {}) {
    state.mode = options.mode || 'walkin';
    state.targetCount = Math.max(1, parseInt(options.targetCount, 10) || 1);
    state.screeningId = options.screeningId || (window.currentScreening ? window.currentScreening.id : 'scr-01');
    state.preferredSeat = options.preferredSeat || null;
    state.parentModalId = options.parentModalId || null;
    state.onConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
    state.onCancel = typeof options.onCancel === 'function' ? options.onCancel : null;
    state.conflictedSeats = new Set(options.conflictedSeats || []);

    // Initial selected seats
    state.selectedSeats = new Set();
    if (Array.isArray(options.initialSeats)) {
      options.initialSeats.forEach(s => state.selectedSeats.add(s.trim().toUpperCase()));
    }

    state.isOpen = true;
    state.isMapPicking = false;

    if (!modalEl) init();

    // Set title and subtitle
    const titleEl = document.getElementById('seatPickerModalTitle');
    const descEl = document.getElementById('seatPickerModalDesc');
    if (titleEl) {
      titleEl.innerHTML = state.mode === 'move'
        ? '<i class="fa-solid fa-arrows-split-up-and-left" style="color: var(--color-gold);"></i> เลือกที่นั่งใหม่สำหรับย้าย (' + state.targetCount + ' ที่นั่ง)'
        : '<i class="fa-solid fa-chair" style="color: var(--color-teal);"></i> จัดที่นั่ง (' + state.targetCount + ' ท่าน)';
    }
    if (descEl) {
      descEl.textContent = 'ต้องการเลือกทั้งหมด ' + state.targetCount + ' ที่นั่ง (เลือกแล้ว ' + state.selectedSeats.size + ' ที่)';
    }

    updateParityUI();
    modalEl.classList.remove('hidden');

    // Default to auto-recommend tab
    switchTab('recommend');
    await loadRecommendations();
    loadAllSeatsInventory();
  }

  function close() {
    state.isOpen = false;
    state.isMapPicking = false;
    if (modalEl) modalEl.classList.add('hidden');
    if (floatingBarEl) floatingBarEl.classList.add('hidden');
    if (state.parentModalId) {
      const pEl = document.getElementById(state.parentModalId);
      if (pEl) pEl.classList.remove('hidden');
    }
    removeMapHighlights();
  }

  function cancel() {
    if (state.onCancel) state.onCancel();
    close();
  }

  function confirmSelection() {
    if (state.selectedSeats.size !== state.targetCount) {
      alert('กรุณาเลือกที่นั่งให้ครบ ' + state.targetCount + ' ที่นั่ง (ขณะนี้เลือก ' + state.selectedSeats.size + ' ที่)');
      return;
    }
    const chosen = Array.from(state.selectedSeats);
    close();
    if (state.onConfirm) {
      state.onConfirm(chosen);
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    const tabRec = document.getElementById('seatPickerTabContentRec');
    const tabDropdown = document.getElementById('seatPickerTabContentDropdown');
    const btnTabRec = document.getElementById('btnTabSeatRec');
    const btnTabDropdown = document.getElementById('btnTabSeatDropdown');

    if (tab === 'recommend') {
      if (tabRec) tabRec.classList.remove('hidden');
      if (tabDropdown) tabDropdown.classList.add('hidden');
      if (btnTabRec) btnTabRec.classList.add('active');
      if (btnTabDropdown) btnTabDropdown.classList.remove('active');
    } else {
      if (tabRec) tabRec.classList.add('hidden');
      if (tabDropdown) tabDropdown.classList.remove('hidden');
      if (btnTabRec) btnTabRec.classList.remove('active');
      if (btnTabDropdown) btnTabDropdown.classList.add('active');
      renderDropdownList();
    }
  }

  /**
   * Update Progress & Parity Counter UI
   */
  function updateParityUI() {
    const count = state.selectedSeats.size;
    const target = state.targetCount;
    const isComplete = count === target;

    const countDisplay = document.getElementById('seatPickerParityCount');
    const statusText = document.getElementById('seatPickerParityStatus');
    const pillsContainer = document.getElementById('seatPickerSelectedPills');
    const btnConfirm = document.getElementById('btnConfirmSeatPicker');

    if (countDisplay) {
      countDisplay.textContent = count + ' / ' + target;
      countDisplay.style.color = isComplete ? '#34d399' : (count > target ? '#ef4444' : 'var(--color-gold)');
    }

    if (statusText) {
      if (isComplete) {
        statusText.innerHTML = '<span style="color: #34d399;"><i class="fa-solid fa-circle-check"></i> ครบตามจำนวนแล้ว</span>';
      } else if (count < target) {
        statusText.innerHTML = '<span style="color: #fbbf24;"><i class="fa-solid fa-clock"></i> ขาดอีก ' + (target - count) + ' ที่นั่ง</span>';
      } else {
        statusText.innerHTML = '<span style="color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> เกิน ' + (count - target) + ' ที่นั่ง</span>';
      }
    }

    if (btnConfirm) {
      btnConfirm.disabled = !isComplete;
    }

    // Render Pills
    if (pillsContainer) {
      pillsContainer.innerHTML = '';
      state.selectedSeats.forEach(seatId => {
        const pill = document.createElement('span');
        const isConflicted = state.conflictedSeats.has(seatId);
        pill.className = 'seat-selected-pill' + (isConflicted ? ' pill-conflict' : '');
        pill.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-family: monospace; font-weight: 700; margin: 2px; background: ' + (isConflicted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(45, 212, 191, 0.18)') + '; color: ' + (isConflicted ? '#fca5a5' : '#2dd4bf') + '; border: 1px solid ' + (isConflicted ? '#ef4444' : 'rgba(45, 212, 191, 0.4)') + ';';
        pill.innerHTML = (isConflicted ? '<i class="fa-solid fa-triangle-exclamation"></i> ' : '<i class="fa-solid fa-check"></i> ') + seatId + ' <i class="fa-solid fa-xmark" style="cursor: pointer; opacity: 0.7; margin-left: 4px;" title="เอาออก"></i>';
        pill.querySelector('.fa-xmark').onclick = (e) => {
          e.stopPropagation();
          deselectSeat(seatId);
        };
        pillsContainer.appendChild(pill);
      });
    }

    // Also update floating map bar if active
    updateFloatingMapBar();
  }

  function selectSeat(seatId) {
    const norm = seatId.trim().toUpperCase();
    if (state.selectedSeats.size >= state.targetCount && !state.selectedSeats.has(norm)) {
      // If already full, replace oldest or notify
      if (state.targetCount === 1) {
        state.selectedSeats.clear();
      } else {
        alert('เลือกที่นั่งครบ ' + state.targetCount + ' ที่แล้ว หากต้องการเปลี่ยน ให้คลิกเอาที่นั่งเดิมออกก่อน');
        return;
      }
    }
    state.selectedSeats.add(norm);
    state.conflictedSeats.delete(norm);
    updateParityUI();
    syncMapHighlights();
  }

  function deselectSeat(seatId) {
    const norm = seatId.trim().toUpperCase();
    state.selectedSeats.delete(norm);
    state.conflictedSeats.delete(norm);
    updateParityUI();
    syncMapHighlights();
  }

  function toggleSeat(seatId) {
    const norm = seatId.trim().toUpperCase();
    if (state.selectedSeats.has(norm)) {
      deselectSeat(norm);
    } else {
      selectSeat(norm);
    }
  }

  /**
   * Auto Recommend Tab: Fetch & Render
   */
  async function loadRecommendations() {
    if (!recContainerEl) return;
    recContainerEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> กำลังคำนวณกลุ่มที่นั่งที่ดีที่สุดตามหลัก Heuristic...</div>';

    try {
      const res = await API.recommendSeatGroups(state.screeningId, state.targetCount, state.preferredSeat);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        renderRecommendations(res.data);
      } else {
        recContainerEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-circle-exclamation"></i> ไม่พบกลุ่มที่นั่งว่างติดกัน ' + state.targetCount + ' ที่นั่งในแถวเดียวกัน แนะนำให้เลือกจากผังโรงภาพยนตร์</div>';
      }
    } catch (err) {
      recContainerEl.innerHTML = '<div style="padding: 16px; color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> เกิดข้อผิดพลาดในการดึงข้อมูลแนะนำ: ' + (err.message || '') + '</div>';
    }
  }

  function renderRecommendations(groups) {
    recContainerEl.innerHTML = '';
    groups.forEach((g, idx) => {
      const card = document.createElement('div');
      card.className = 'seat-rec-card';
      card.style.cssText = 'background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: all 0.2s ease;';
      card.onmouseenter = () => card.style.borderColor = 'var(--color-teal)';
      card.onmouseleave = () => card.style.borderColor = 'var(--border-color)';

      const isCurrentSelection = g.seats.length === state.selectedSeats.size && g.seats.every(s => state.selectedSeats.has(s));
      if (isCurrentSelection) {
        card.style.borderColor = 'var(--color-teal)';
        card.style.background = 'rgba(45, 212, 191, 0.08)';
      }

      card.innerHTML = `
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px; font-weight: 700; font-family: monospace; color: var(--color-teal);">${g.display}</span>
            <span class="badge badge-media" style="font-size: 11px; background: rgba(255,255,255,0.08);">${g.tier} (แถว ${g.row})</span>
            ${idx === 0 ? '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-size: 10.5px;"><i class="fa-solid fa-star"></i> แนะนำสูงสุด</span>' : ''}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            <i class="fa-solid fa-circle-check" style="color: #34d399; margin-right: 4px;"></i> ${g.reason} (คะแนน: ${g.score})
          </div>
          <div style="font-size: 11px; font-family: monospace; color: var(--text-dim); margin-top: 2px;">
            ที่นั่งในกลุ่ม: ${g.seats.join(', ')}
          </div>
        </div>
        <button type="button" class="btn ${isCurrentSelection ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 14px; font-size: 12px;">
          ${isCurrentSelection ? '<i class="fa-solid fa-check"></i> เลือกแล้ว' : 'เลือกกลุ่มนี้'}
        </button>
      `;

      card.onclick = () => {
        state.selectedSeats.clear();
        state.conflictedSeats.clear();
        g.seats.forEach(s => state.selectedSeats.add(s));
        updateParityUI();
        renderRecommendations(groups);
        syncMapHighlights();
      };

      recContainerEl.appendChild(card);
    });
  }

  /**
   * Dropdown Inventory Tab: Load & Render
   */
  async function loadAllSeatsInventory() {
    try {
      const res = await API.getAllSeatsStatus(state.screeningId);
      if (res && res.success) {
        state.allSeatsCache = res.data || [];
        if (state.activeTab === 'dropdown') {
          renderDropdownList();
        }
      }
    } catch (err) {
      console.error('Failed to load all seats inventory', err);
    }
  }

  function renderDropdownList() {
    if (!dropdownContainerEl) return;
    if (!state.allSeatsCache || state.allSeatsCache.length === 0) {
      dropdownContainerEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดผังที่นั่งทั้งหมด 1,164 ที่นั่ง...</div>';
      return;
    }

    const search = searchInputEl ? searchInputEl.value.trim().toUpperCase() : '';
    const tier = tierFilterEl ? tierFilterEl.value : 'all';
    const status = statusFilterEl ? statusFilterEl.value : 'all';

    let filtered = state.allSeatsCache.filter(s => {
      if (search && !s.id.toUpperCase().includes(search) && !s.row.toUpperCase().includes(search)) return false;
      if (tier !== 'all' && s.tier !== tier) return false;
      if (status !== 'all' && s.status !== status) return false;
      return true;
    });

    // Limit render to first 120 matches for fast DOM performance
    const renderLimit = 120;
    const toShow = filtered.slice(0, renderLimit);

    dropdownContainerEl.innerHTML = '';
    if (toShow.length === 0) {
      dropdownContainerEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">ไม่พบที่นั่งที่ตรงกับเงื่อนไขการค้นหา</div>';
      return;
    }

    toShow.forEach(seat => {
      const isSelected = state.selectedSeats.has(seat.id);
      const isAvailable = seat.status === 'available';

      const item = document.createElement('div');
      item.className = 'seat-dropdown-item' + (isSelected ? ' selected' : '') + (!isAvailable ? ' disabled-seat' : '');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: ' + (isAvailable || isSelected ? 'pointer' : 'not-allowed') + '; background: ' + (isSelected ? 'rgba(45, 212, 191, 0.1)' : 'transparent') + ';';

      let statusBadge = '<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; font-size: 11px;">✓ ว่าง</span>';
      if (seat.status === 'attended') {
        statusBadge = '<span class="badge" style="background: rgba(16, 185, 129, 0.25); color: #10b981; font-size: 11px;"><i class="fa-solid fa-check"></i> เช็คอินแล้ว</span>';
      } else if (seat.status === 'assigned') {
        statusBadge = '<span class="badge" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; font-size: 11px;">● จัดแล้ว (' + (seat.occupant?.name || '') + ')</span>';
      }

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" ${isSelected ? 'checked' : ''} ${!isAvailable && !isSelected ? 'disabled' : ''} style="cursor: pointer; accent-color: var(--color-teal); width: 16px; height: 16px;">
          <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: ${isSelected ? 'var(--color-teal)' : '#fff'};">${seat.id}</span>
          <span style="font-size: 11.5px; color: var(--text-muted);">${seat.tierLabel} (แถว ${seat.row} No.${seat.num})</span>
        </div>
        <div>
          ${statusBadge}
        </div>
      `;

      if (isAvailable || isSelected) {
        item.onclick = (e) => {
          if (e.target.tagName !== 'INPUT') {
            toggleSeat(seat.id);
            renderDropdownList();
          }
        };
        const chk = item.querySelector('input');
        if (chk) {
          chk.onchange = () => {
            toggleSeat(seat.id);
            renderDropdownList();
          };
        }
      }

      dropdownContainerEl.appendChild(item);
    });

    if (filtered.length > renderLimit) {
      const footer = document.createElement('div');
      footer.style.cssText = 'padding: 8px; text-align: center; font-size: 11px; color: var(--text-dim); background: rgba(0,0,0,0.2);';
      footer.textContent = 'แสดง ' + renderLimit + ' จากทั้งหมด ' + filtered.length + ' ที่นั่ง (กรุณาพิมพ์ค้นหาเพื่อจำกัดผลลัพธ์)';
      dropdownContainerEl.appendChild(footer);
    }
  }

  /**
   * Mode B: Interactive Map Multi-Select Mode
   */
  function enterMapPickingMode() {
    if (modalEl) modalEl.classList.add('hidden');
    if (state.parentModalId) {
      const pEl = document.getElementById(state.parentModalId);
      if (pEl) pEl.classList.add('hidden');
    }
    state.isMapPicking = true;

    // Switch to seats view if not already there
    if (typeof window.switchView === 'function') {
      window.switchView('seats');
    }

    if (floatingBarEl) {
      floatingBarEl.classList.remove('hidden');
    }

    updateFloatingMapBar();
    syncMapHighlights();
  }

  function updateFloatingMapBar() {
    if (!floatingBarEl) return;
    const count = state.selectedSeats.size;
    const target = state.targetCount;
    const isComplete = count === target;

    const countEl = document.getElementById('mapPickCountText');
    const seatsListEl = document.getElementById('mapPickSelectedList');
    const btnFinish = document.getElementById('btnFinishMapPick');

    if (countEl) {
      countEl.innerHTML = 'กำลังเลือกที่นั่ง <strong>' + count + ' / ' + target + ' ที่</strong> ' + (isComplete ? '<span style="color: #34d399;">(ครบแล้ว ✓)</span>' : '<span style="color: #fbbf24;">(ขาดอีก ' + (target - count) + ' ที่)</span>');
    }

    if (seatsListEl) {
      seatsListEl.textContent = count > 0 ? Array.from(state.selectedSeats).join(', ') : 'ยังไม่ได้เลือกเก้าอี้ (คลิกบนผัง)';
    }

    if (btnFinish) {
      btnFinish.disabled = !isComplete;
    }
  }

  function exitMapPickingModeConfirm() {
    if (state.selectedSeats.size !== state.targetCount) {
      alert('กรุณาเลือกที่นั่งให้ครบ ' + state.targetCount + ' ที่นั่ง');
      return;
    }
    state.isMapPicking = false;
    if (floatingBarEl) floatingBarEl.classList.add('hidden');
    removeMapHighlights();

    // Reopen modal to let user review and confirm or finalize
    if (modalEl) modalEl.classList.remove('hidden');
    updateParityUI();
  }

  function exitMapPickingModeCancel() {
    state.isMapPicking = false;
    if (floatingBarEl) floatingBarEl.classList.add('hidden');
    removeMapHighlights();
    if (modalEl) modalEl.classList.remove('hidden');
    updateParityUI();
  }

  /**
   * Sync visual highlighting on Pavalai DOM seat elements
   */
  function syncMapHighlights() {
    // Remove previous staged classes
    document.querySelectorAll('.seat-staged-picker').forEach(el => {
      el.classList.remove('seat-staged-picker');
    });

    state.selectedSeats.forEach(seatId => {
      const el = document.getElementById('seat-' + seatId);
      if (el) {
        el.classList.add('seat-staged-picker');
      }
    });
  }

  function removeMapHighlights() {
    document.querySelectorAll('.seat-staged-picker').forEach(el => {
      el.classList.remove('seat-staged-picker');
    });
  }

  /**
   * Called when a seat on the map is clicked
   * Returns true if handled by SeatPicker, false otherwise
   */
  function handleMapSeatClick(seatId, isOccupied) {
    if (!state.isMapPicking) return false;

    if (isOccupied && !state.selectedSeats.has(seatId)) {
      alert('ที่นั่ง ' + seatId + ' ถูกจัดให้แขกท่านอื่นแล้ว ไม่สามารถเลือกได้');
      return true;
    }

    toggleSeat(seatId);
    return true;
  }

  /**
   * Non-destructive 409 Conflict Recovery Handler
   */
  function handleConflictRecovery(conflictResponse, onRetry) {
    const conflicted = conflictResponse.conflictedSeats || [];
    const valid = conflictResponse.validSeats || [];
    const replacements = conflictResponse.suggestedReplacements || [];

    // Keep valid seats, set conflicted seats
    state.conflictedSeats = new Set(conflicted);

    // Open SeatPicker in conflict recovery mode
    open({
      mode: state.mode,
      targetCount: state.targetCount,
      screeningId: state.screeningId,
      initialSeats: valid,
      conflictedSeats: conflicted,
      onConfirm: (newSeats) => {
        if (typeof onRetry === 'function') {
          onRetry(newSeats);
        }
      }
    });
  }

  return {
    init,
    open,
    close,
    cancel,
    selectSeat,
    deselectSeat,
    toggleSeat,
    confirmSelection,
    handleMapSeatClick,
    handleConflictRecovery,
    getState: () => ({ ...state, selectedSeats: Array.from(state.selectedSeats) })
  };
})();
