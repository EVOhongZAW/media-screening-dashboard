// -- Screening Modal --
function openScreeningModal(screening = null) {
  document.getElementById('screeningModal').classList.add('active');
  const form = document.getElementById('screeningForm');
  form.reset();
  
  if (screening) {
    document.getElementById('screeningModalTitle').textContent = 'แก้ไขรอบฉาย';
    document.getElementById('screeningId').value = screening.id;
    document.getElementById('scrTitle').value = screening.title;
    document.getElementById('scrBranch').value = screening.branchId;
    document.getElementById('scrMediaType').value = screening.mediaType;
    document.getElementById('scrDate').value = screening.date;
    document.getElementById('scrTime').value = screening.time;
    document.getElementById('scrTheater').value = screening.theater;
    document.getElementById('scrCapacity').value = screening.capacity;
    document.getElementById('scrStatus').value = screening.status;
  } else {
    document.getElementById('screeningModalTitle').textContent = 'เพิ่มรอบฉายใหม่';
    document.getElementById('screeningId').value = '';
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scrDate').value = today;
  }
}

function closeScreeningModal() {
  document.getElementById('screeningModal').classList.remove('active');
}

async function handleScreeningSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('screeningId').value;
  const data = {
    title: document.getElementById('scrTitle').value,
    branchId: parseInt(document.getElementById('scrBranch').value),
    mediaType: document.getElementById('scrMediaType').value,
    date: document.getElementById('scrDate').value,
    time: document.getElementById('scrTime').value,
    theater: document.getElementById('scrTheater').value,
    capacity: parseInt(document.getElementById('scrCapacity').value),
    status: document.getElementById('scrStatus').value
  };
  
  try {
    if (id) {
      await API.updateScreening(id, data);
      showToast('อัปเดตข้อมูลรอบฉายสำเร็จ', 'success');
    } else {
      await API.createScreening(data);
      showToast('เพิ่มรอบฉายใหม่สำเร็จ', 'success');
    }
    closeScreeningModal();
    if(window.onFilterChange) onFilterChange(); // reload table and charts
  } catch (error) {
    showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
  }
}

// -- Guest Modal --
async function openGuestModal(screeningId) {
  document.getElementById('guestScreeningId').value = screeningId;
  document.getElementById('guestForm').reset();
  document.getElementById('guestModal').classList.add('active');
  await loadGuestList(screeningId);
}

function closeGuestModal() {
  document.getElementById('guestModal').classList.remove('active');
  // Refresh table when guest modal is closed to update counts
  if(window.onFilterChange) window.onFilterChange();
}

async function loadGuestList(screeningId) {
  const tbody = document.getElementById('guestListBody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">กำลังโหลด...</td></tr>';
  
  try {
    const guests = await API.getGuests({ screeningId });
    tbody.innerHTML = '';
    
    if (guests.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">ยังไม่มีแขกในรอบนี้</td></tr>';
      return;
    }
    
    guests.forEach(guest => {
      const typeThai = window.formatGuestType(guest.guestType);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${guest.name}</strong>
          ${guest.note ? `<br><small class="text-secondary">${guest.note}</small>` : ''}
        </td>
        <td>${typeThai}</td>
        <td>${guest.organization || '-'}</td>
        <td>
          <label class="switch">
            <input type="checkbox" ${guest.attended ? 'checked' : ''} onchange="handleGuestToggleAttendance(${guest.id}, this.checked)">
            <span class="slider"></span>
          </label>
        </td>
        <td>
          <button class="btn btn-sm btn-danger btn-icon" onclick="handleGuestDelete(${guest.id}, ${screeningId})">
            <i class="fas fa-times"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">โหลดข้อมูลผิดพลาด</td></tr>';
  }
}

async function handleGuestSubmit(e) {
  e.preventDefault();
  const screeningId = document.getElementById('guestScreeningId').value;
  
  const data = {
    screeningId: parseInt(screeningId),
    name: document.getElementById('gName').value,
    guestType: document.getElementById('gType').value,
    organization: document.getElementById('gOrg').value,
    note: document.getElementById('gNote').value,
    attended: false
  };
  
  try {
    await API.createGuest(data);
    showToast('เพิ่มรายชื่อแขกสำเร็จ', 'success');
    document.getElementById('guestForm').reset();
    await loadGuestList(screeningId);
  } catch (error) {
    showToast('เกิดข้อผิดพลาดในการเพิ่มรายชื่อแขก', 'error');
  }
}

async function handleGuestToggleAttendance(guestId, attended) {
  try {
    await API.updateGuest(guestId, { attended });
    showToast(attended ? 'เช็คอินสำเร็จ' : 'ยกเลิกเช็คอินสำเร็จ', 'success');
  } catch (error) {
    showToast('เกิดข้อผิดพลาด', 'error');
    // Revert visually on error
    const screeningId = document.getElementById('guestScreeningId').value;
    loadGuestList(screeningId);
  }
}

async function handleGuestDelete(guestId, screeningId) {
  if (confirm('ยืนยันการลบรายชื่อแขก?')) {
    try {
      await API.deleteGuest(guestId);
      showToast('ลบรายชื่อแขกสำเร็จ', 'success');
      await loadGuestList(screeningId);
    } catch (error) {
      showToast('เกิดข้อผิดพลาดในการลบ', 'error');
    }
  }
}

// -- Toasts --
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  
  toast.innerHTML = `
    <i class="fas ${icon} toast-icon"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease-in forwards';
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Init Form Listeners
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('screeningForm').addEventListener('submit', handleScreeningSubmit);
  document.getElementById('guestForm').addEventListener('submit', handleGuestSubmit);
  
  document.getElementById('btnAddScreening').addEventListener('click', () => openScreeningModal());
});
